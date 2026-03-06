# app/services/rules.py

def spacing_rule(zone_label: int, moisture_percent: float):
    """
    Determines intra-row plant spacing (meters) for Scotch Bonnet peppers.
    
    zone_label: 0=rich, 1=medium, 2=poor
    moisture_percent: soil moisture or relative humidity
    """

    zone_map = {
        0: "rich",
        1: "medium",
        2: "poor"
    }

    zone_quality = zone_map.get(zone_label, "medium")

    # Rich soil promotes vigorous foliage growth (lush canopy).
    # This requires more airflow, especially when moisture is high.
    if zone_quality == "rich":
        # Base is 0.50m due to canopy vigor; 0.65m if moisture poses a disease risk.
        return 0.50 if moisture_percent < 75 else 0.65

    # Medium soil follows standard Sri Lankan DOA field recommendations.
    if zone_quality == "medium":
        # 0.40m is the standard for varieties like CA-8 and Gannoruwa Prarthana.
        return 0.40

    # Poor/Sandy soil requires wider spacing for root foraging.
    if zone_quality == "poor":
        # Increasing base spacing by ~20% to reduce inter-plant nutrient competition.
        return 0.60

    return 0.40  # Fallback to standard commercial spacing