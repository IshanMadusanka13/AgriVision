"""
Smart Advice Service
====================
Benchmarks a plant's growth and sensor readings against top-performing peer
plants in the same growth stage, then generates actionable tips.

All configuration is read from the DB — no hardcoded values:
  • system_settings       → benchmark_top_percentile, deviation_threshold, history_days
  • growth_stage_config   → optimal ph/humidity/temp ranges per stage (fallback benchmark)
  • condition_messages    → advisory message templates (benchmark_ph_below, etc.)
"""

from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta, timezone

try:
    from services.supabase_service import SupabaseService
except ImportError:
    from services.supabase_service import SupabaseService

_supabase = SupabaseService()


# ── DB loaders ────────────────────────────────────────────────────────────────

def _fetch_settings() -> Optional[Dict]:
    """
    Load benchmark settings from system_settings table.
    Returns None if the table is empty (admin hasn't configured it yet).
    """
    try:
        resp = _supabase.client.table("system_settings") \
            .select("benchmark_top_percentile, deviation_threshold, history_days") \
            .limit(1).execute()
        return resp.data[0] if resp.data else None
    except Exception as e:
        print(f"[smart_advice] system_settings fetch failed: {e}")
        return None


def _fetch_stage_optimal(growth_stage: str) -> Dict[str, float]:
    """
    Read the midpoint of ph/humidity/temp optimal ranges from growth_stage_config.
    These are used as the benchmark when no peer plant data exists.
    Maps display stage names to the snake_case keys stored in the DB.
    """
    stage_key_map = {
        "Early Vegetative Stage":    "early_vegetative",
        "Vegetative Stage":          "vegetative",
        "Flowering Stage":           "flowering",
        "Fruiting Stage":            "fruiting",
        "Ripening/Harvesting Stage": "ripening",
    }
    stage_key = stage_key_map.get(growth_stage)
    if not stage_key:
        return {}

    try:
        resp = _supabase.client.table("growth_stage_config") \
            .select("ph_min, ph_max, humidity_min, humidity_max, temp_min, temp_max") \
            .eq("stage", stage_key) \
            .limit(1).execute()

        if not resp.data:
            return {}

        row = resp.data[0]
        result: Dict[str, float] = {}

        if row.get("ph_min") is not None and row.get("ph_max") is not None:
            result["ph"] = (float(row["ph_min"]) + float(row["ph_max"])) / 2

        if row.get("humidity_min") is not None and row.get("humidity_max") is not None:
            result["humidity"] = (float(row["humidity_min"]) + float(row["humidity_max"])) / 2

        if row.get("temp_min") is not None and row.get("temp_max") is not None:
            result["temperature"] = (float(row["temp_min"]) + float(row["temp_max"])) / 2

        return result
    except Exception as e:
        print(f"[smart_advice] growth_stage_config fetch failed: {e}")
        return {}


def _load_benchmark_messages() -> Dict[str, str]:
    """
    Read advisory message templates from the existing condition_messages table.
    Only rows whose condition_key starts with 'benchmark_' are loaded.
    Returns {condition_key: message_text} using the first (lowest sort_order) message per key.
    """
    try:
        resp = _supabase.client.table("condition_messages") \
            .select("condition_key, message") \
            .like("condition_key", "benchmark_%") \
            .order("condition_key") \
            .order("sort_order") \
            .execute()

        result: Dict[str, str] = {}
        for row in resp.data:
            key = row["condition_key"]
            if key not in result:          # keep only sort_order 1
                result[key] = row["message"]
        return result
    except Exception as e:
        print(f"[smart_advice] condition_messages (benchmark) fetch failed: {e}")
        return {}


# ── Session helpers ───────────────────────────────────────────────────────────

def _fmt(template: str, **kwargs) -> str:
    try:
        return template.format(**kwargs)
    except (KeyError, ValueError):
        return template


def _get_latest_session(plant_id: int) -> Optional[Dict]:
    """Most-recent analysis_session that has a height reading."""
    try:
        resp = _supabase.client.table("analysis_sessions") \
            .select("plant_id, plant_height_cm, ph, humidity, temperature, created_at") \
            .eq("plant_id", plant_id) \
            .not_.is_("plant_height_cm", "null") \
            .order("created_at", desc=True) \
            .limit(1).execute()
        return resp.data[0] if resp.data else None
    except Exception as e:
        print(f"[smart_advice] _get_latest_session error plant={plant_id}: {e}")
        return None


def _get_session_near_date(plant_id: int, target_dt: datetime) -> Optional[Dict]:
    """Session on-or-before target_dt — the 'old' record for growth-rate calc."""
    try:
        resp = _supabase.client.table("analysis_sessions") \
            .select("plant_id, plant_height_cm, ph, humidity, temperature, created_at") \
            .eq("plant_id", plant_id) \
            .not_.is_("plant_height_cm", "null") \
            .lte("created_at", target_dt.isoformat()) \
            .order("created_at", desc=True) \
            .limit(1).execute()
        return resp.data[0] if resp.data else None
    except Exception as e:
        print(f"[smart_advice] _get_session_near_date error plant={plant_id}: {e}")
        return None


def _calc_growth_rate(plant_id: int, history_days: int) -> Optional[float]:
    """
    Growth rate = (current_height - old_height) / history_days  (cm/day).
    Returns None when there is insufficient data.
    """
    latest = _get_latest_session(plant_id)
    if not latest:
        return None

    target_dt = datetime.now(timezone.utc) - timedelta(days=history_days)
    old = _get_session_near_date(plant_id, target_dt)
    if not old:
        return None

    if old["created_at"] == latest["created_at"]:
        return None

    height_diff = float(latest["plant_height_cm"]) - float(old["plant_height_cm"])
    return height_diff / history_days


# ── Public API ────────────────────────────────────────────────────────────────

def generate_smart_advice(plant_id: str, growth_stage: str) -> Dict:
    """
    Generate smart cultivation tips for a plant by comparing it to the
    top-performing peer plants in the same growth stage.

    Parameters
    ----------
    plant_id    : ArUco marker ID (string representation of the integer).
    growth_stage: Display name, e.g. "Vegetative Stage".

    Returns
    -------
    Dict:
        status                           "ok" | "insufficient_data" | "no_peers" | "not_configured"
        tips                             List[str]
        benchmark_used                   "peers" | "optimal_values" | None
        user_growth_rate_cm_per_day      float | None
        benchmark_growth_rate_cm_per_day float | None
        benchmark_averages               {ph, humidity, temperature}
    """
    pid = int(plant_id)

    # ── 1. Fetch admin settings from DB ──────────────────────────────────────
    settings = _fetch_settings()
    if settings is None:
        return {
            "status": "not_configured",
            "tips": ["Smart advice is not configured yet. Please set up the benchmark settings in the admin panel."],
            "benchmark_used": None,
            "user_growth_rate_cm_per_day": None,
            "benchmark_growth_rate_cm_per_day": None,
            "benchmark_averages": {},
        }

    top_pct      = float(settings["benchmark_top_percentile"]) / 100.0
    dev_thresh   = float(settings["deviation_threshold"])
    history_days = int(settings["history_days"])

    # ── 2. Calculate this plant's growth rate ─────────────────────────────────
    user_rate = _calc_growth_rate(pid, history_days)
    if user_rate is None:
        return {
            "status": "insufficient_data",
            "tips": [
                f"Not enough historical data yet. Scan your plant at least twice "
                f"within {history_days} days to unlock personalised advice."
            ],
            "benchmark_used": None,
            "user_growth_rate_cm_per_day": None,
            "benchmark_growth_rate_cm_per_day": None,
            "benchmark_averages": {},
        }

    # ── 3. Find peer plant IDs in the same growth stage ───────────────────────
    try:
        peer_resp = _supabase.client.table("analysis_sessions") \
            .select("plant_id") \
            .eq("growth_stage", growth_stage) \
            .neq("plant_id", pid) \
            .not_.is_("plant_id", "null") \
            .execute()
        peer_ids: List[int] = list({
            int(r["plant_id"])
            for r in peer_resp.data
            if r.get("plant_id") is not None
        })
    except Exception as e:
        print(f"[smart_advice] peer lookup error: {e}")
        peer_ids = []

    # ── 4. Calculate growth rate for every peer ───────────────────────────────
    peer_rates: List[Tuple[int, float]] = []
    for peer_id in peer_ids:
        rate = _calc_growth_rate(peer_id, history_days)
        if rate is not None:
            peer_rates.append((peer_id, rate))

    # ── 5 & 6. Identify top performers and benchmark sensor averages ──────────
    benchmark_avg_rate: Optional[float] = None
    benchmark_averages: Dict[str, float] = {}
    benchmark_used = "optimal_values"

    if peer_rates:
        peer_rates.sort(key=lambda x: x[1], reverse=True)
        top_n = max(1, int(len(peer_rates) * top_pct))
        top_performers = peer_rates[:top_n]
        benchmark_avg_rate = sum(r for _, r in top_performers) / top_n

        sensor_vals: Dict[str, List[float]] = {"ph": [], "humidity": [], "temperature": []}
        for tp_id, _ in top_performers:
            sess = _get_latest_session(tp_id)
            if sess:
                for key in sensor_vals:
                    if sess.get(key) is not None:
                        sensor_vals[key].append(float(sess[key]))

        for key, lst in sensor_vals.items():
            if lst:
                benchmark_averages[key] = sum(lst) / len(lst)

        if benchmark_averages:
            benchmark_used = "peers"

    # Fallback: read optimal midpoints from growth_stage_config (admin-managed)
    if not benchmark_averages:
        benchmark_averages = _fetch_stage_optimal(growth_stage)

    # ── 7. Get the user's latest sensor readings ──────────────────────────────
    user_session = _get_latest_session(pid)
    user_vals: Dict[str, float] = {}
    if user_session:
        for key in ("ph", "humidity", "temperature"):
            if user_session.get(key) is not None:
                user_vals[key] = float(user_session[key])

    # ── 8. Load advisory message templates from condition_messages ────────────
    messages = _load_benchmark_messages()

    # ── 9. Rule engine: generate tips for sensors that deviate too much ───────
    tips: List[str] = []
    for condition, bench_val in benchmark_averages.items():
        if bench_val == 0:
            continue
        user_val = user_vals.get(condition)
        if user_val is None:
            continue

        deviation = abs(user_val - bench_val) / bench_val
        if deviation > dev_thresh:
            direction = "above" if user_val > bench_val else "below"
            msg_key   = f"benchmark_{condition}_{direction}"
            template  = messages.get(msg_key)
            if template:
                tips.append(_fmt(
                    template,
                    user_val=round(user_val, 1),
                    bench_val=round(bench_val, 1),
                    deviation_pct=round(deviation * 100, 1),
                ))

    status = "ok" if peer_rates else "no_peers"

    return {
        "status": status,
        "tips": tips,
        "benchmark_used": benchmark_used,
        "user_growth_rate_cm_per_day": round(user_rate, 3),
        "benchmark_growth_rate_cm_per_day": round(benchmark_avg_rate, 3) if benchmark_avg_rate is not None else None,
        "benchmark_averages": {k: round(v, 2) for k, v in benchmark_averages.items()},
    }
