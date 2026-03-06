"""
Service for handling batch analysis and storage
"""
from typing import Dict, List, Optional
from datetime import datetime
from configs.supabase import get_supabase_client


async def save_batch_to_supabase(
    batch_id: str,
    total_peppers: int,
    grade_counts: Dict[str, int],
    user_id: str = "public_user"
) -> Dict:
    """
    Save batch analysis results to Supabase
    
    Args:
        batch_id: Unique batch identifier
        total_peppers: Total number of peppers analyzed
        grade_counts: Dictionary with grade counts (e.g., {"Category A": 5, ...})
        user_id: User ID (default: "public_user" for public access)
    
    Returns:
        Dictionary with success status and batch UUID
    """
    try:
        supabase = get_supabase_client()
        
        # Prepare batch data
        batch_data = {
            "user_id": user_id,
            "batch_id": batch_id,
            "total_peppers": total_peppers,
            "grade_a": grade_counts.get("Category A", 0),
            "grade_b": grade_counts.get("Category B", 0),
            "grade_c": grade_counts.get("Category C", 0),
            "grade_d": grade_counts.get("Category D", 0),
            "created_at": datetime.utcnow().isoformat(),  # Explicit timestamp when data is received
        }
        
        # Insert into Supabase
        response = supabase.table("batches").insert(batch_data).execute()
        
        if response.data:
            batch_uuid = response.data[0]["id"]
            return {
                "success": True,
                "batch_uuid": batch_uuid,
                "message": "Batch saved successfully"
            }
        else:
            return {
                "success": False,
                "error": "Failed to insert batch data"
            }
    
    except Exception as e:
        print(f"Error saving batch: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }


async def get_all_batches(user_id: str = "public_user", limit: int = 50) -> Dict:
    """
    Get all batches, ordered by most recent first
    
    Args:
        user_id: User ID filter (default: "public_user")
        limit: Maximum number of batches to return
    
    Returns:
        Dictionary with success status and list of batches
    """
    try:
        supabase = get_supabase_client()
        
        response = supabase.table("batches")\
            .select("*")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .limit(limit)\
            .execute()
        
        return {
            "success": True,
            "batches": response.data or []
        }
    
    except Exception as e:
        print(f"Error fetching batches: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "batches": []
        }


async def get_batch_by_id(batch_uuid: str) -> Dict:
    """
    Get a specific batch by UUID
    
    Args:
        batch_uuid: Batch UUID
    
    Returns:
        Dictionary with batch details
    """
    try:
        supabase = get_supabase_client()
        
        response = supabase.table("batches")\
            .select("*")\
            .eq("id", batch_uuid)\
            .single()\
            .execute()
        
        return {
            "success": True,
            "batch": response.data
        }
    
    except Exception as e:
        print(f"Error fetching batch: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }


async def get_latest_batches(user_id: str = "public_user", count: int = 2) -> List[Dict]:
    """
    Get the most recent batches for comparison
    
    Args:
        user_id: User ID filter
        count: Number of batches to return (default: 2 for comparison)
    
    Returns:
        List of batch dictionaries
    """
    try:
        supabase = get_supabase_client()
        
        response = supabase.table("batches")\
            .select("*")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .limit(count)\
            .execute()
        
        return response.data or []
    
    except Exception as e:
        print(f"Error fetching latest batches: {str(e)}")
        return []


async def delete_batch(batch_uuid: str, user_id: str = "public_user") -> Dict:
    """
    Delete a specific batch by UUID
    
    Args:
        batch_uuid: Batch UUID to delete
        user_id: User ID for verification
    
    Returns:
        Dictionary with success status
    """
    try:
        supabase = get_supabase_client()
        
        # Delete the batch (verify user_id for security)
        response = supabase.table("batches")\
            .delete()\
            .eq("id", batch_uuid)\
            .eq("user_id", user_id)\
            .execute()
        
        return {
            "success": True,
            "message": "Batch deleted successfully"
        }
    
    except Exception as e:
        print(f"Error deleting batch: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }
