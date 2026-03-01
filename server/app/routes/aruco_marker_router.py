from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import io
import base64
from datetime import datetime

router = APIRouter()


class MarkerGenerateRequest(BaseModel):
    start_id: int = 1
    end_id: int = 5
    marker_size_cm: float = 5.0
    with_label: bool = True
    save_to_db: bool = True
    user_email: Optional[str] = None


class MarkerResponse(BaseModel):
    marker_id: int
    image_base64: str
    size_cm: float
    created_at: str


class BatchMarkerResponse(BaseModel):
    success: bool
    markers: List[MarkerResponse]
    total_generated: int
    warning: Optional[str] = None


def generate_aruco_marker(
    marker_id: int,
    marker_size_cm: float = 5.0,
    with_label: bool = True,
    dpi: int = 300
) -> str:
    """
    Generate a single ArUco marker and return as base64 encoded image

    Args:
        marker_id: ID of the marker (1-50 for DICT_4X4_50)
        marker_size_cm: Physical size in centimeters
        with_label: Whether to include ID label
        dpi: DPI for printing (300 recommended)

    Returns:
        Base64 encoded PNG image
    """
    # Calculate pixel size based on DPI
    pixels_per_cm = dpi / 2.54
    marker_size_px = int(marker_size_cm * pixels_per_cm)

    # Use larger dictionary for more markers (supports up to 1000 IDs)
    aruco_dict = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_ARUCO_ORIGINAL)

    # Generate marker
    marker_img = np.zeros((marker_size_px, marker_size_px), dtype=np.uint8)
    marker_img = cv2.aruco.generateImageMarker(aruco_dict, marker_id, marker_size_px, marker_img, 1)

    if with_label:
        # Add white border and label
        border_size = int(marker_size_px * 0.15)
        total_size = marker_size_px + 2 * border_size

        # Create white background
        labeled_img = np.ones((total_size, total_size), dtype=np.uint8) * 255

        # Place marker in center
        labeled_img[border_size:border_size + marker_size_px,
                   border_size:border_size + marker_size_px] = marker_img

        # Convert to PIL for text
        pil_img = Image.fromarray(labeled_img)
        draw = ImageDraw.Draw(pil_img)

        # Add text label
        try:
            font_size = int(border_size * 0.6)
            font = ImageFont.truetype("arial.ttf", font_size)
        except:
            font = ImageFont.load_default()

        text = f"Plant ID: {marker_id}"

        # Get text bounding box
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]

        # Center text at bottom
        text_x = (total_size - text_width) // 2
        text_y = total_size - border_size + (border_size - text_height) // 2

        draw.text((text_x, text_y), text, fill=0, font=font)

        # Add size label at top
        size_text = f"{marker_size_cm}cm x {marker_size_cm}cm"
        bbox2 = draw.textbbox((0, 0), size_text, font=font)
        size_width = bbox2[2] - bbox2[0]
        size_x = (total_size - size_width) // 2
        size_y = (border_size - text_height) // 2

        draw.text((size_x, size_y), size_text, fill=0, font=font)

        marker_img = np.array(pil_img)

    # Convert to PNG and encode as base64
    pil_final = Image.fromarray(marker_img)
    buffer = io.BytesIO()
    pil_final.save(buffer, format='PNG', dpi=(dpi, dpi))
    img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

    return img_base64


@router.post("/generate", response_model=BatchMarkerResponse)
async def generate_markers(request: MarkerGenerateRequest):
    """
    Generate multiple ArUco markers with duplicate prevention

    Example:
        POST /api/aruco/generate
        {
            "start_id": 1,
            "end_id": 10,
            "marker_size_cm": 5.0,
            "with_label": true,
            "save_to_db": true,
            "user_email": "user@example.com"
        }
    """
    try:
        # Updated range to support 0-1000
        if request.start_id < 0 or request.end_id > 1000:
            raise HTTPException(
                status_code=400,
                detail="Marker IDs must be between 0 and 1000"
            )

        if request.start_id > request.end_id:
            raise HTTPException(
                status_code=400,
                detail="start_id must be less than or equal to end_id"
            )

        if request.end_id - request.start_id > 100:
            raise HTTPException(
                status_code=400,
                detail="Cannot generate more than 100 markers at once"
            )

        markers = []
        skipped_ids = []
        supabase_service = None
        user_id = None

        # Initialize database service if needed
        if request.save_to_db and request.user_email:
            try:
                from app.services.supabase_service import SupabaseService
                supabase_service = SupabaseService()

                # Get user
                user = supabase_service.get_user_by_email(request.user_email)
                if user:
                    user_id = user['id']
                else:
                    raise HTTPException(status_code=404, detail="User not found")
            except Exception as db_error:
                raise HTTPException(
                    status_code=500,
                    detail=f"Database connection error: {str(db_error)}"
                )

        for marker_id in range(request.start_id, request.end_id + 1):
            # Check for duplicates if saving to database
            if request.save_to_db and supabase_service and user_id:
                try:
                    if supabase_service.check_marker_exists(user_id, marker_id):
                        skipped_ids.append(marker_id)
                        print(f"⚠ Marker {marker_id} already exists for user, skipping")
                        continue
                except Exception as check_error:
                    # Table might not exist, continue without duplicate check
                    print(f"⚠ Duplicate check failed (table may not exist): {check_error}")

            # Generate marker image
            img_base64 = generate_aruco_marker(
                marker_id=marker_id,
                marker_size_cm=request.marker_size_cm,
                with_label=request.with_label
            )

            marker_response = MarkerResponse(
                marker_id=marker_id,
                image_base64=img_base64,
                size_cm=request.marker_size_cm,
                created_at=datetime.now().isoformat()
            )

            markers.append(marker_response)

            # Save to database
            if request.save_to_db and supabase_service and user_id:
                try:
                    supabase_service.create_aruco_marker(
                        user_id=user_id,
                        marker_id=marker_id,
                        size_cm=request.marker_size_cm,
                        status="generated"
                    )
                    print(f"✓ Marker {marker_id} saved to database")
                except Exception as db_error:
                    print(f"⚠ Database save error for marker {marker_id}: {db_error}")
                    print(f"   Hint: Make sure aruco_markers table exists in database")

        response_data = {
            "success": True,
            "markers": markers,
            "total_generated": len(markers)
        }

        # Add warning about skipped markers
        if skipped_ids:
            response_data["warning"] = f"Skipped {len(skipped_ids)} duplicate marker(s): {skipped_ids}"

        return BatchMarkerResponse(**response_data)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Marker generation error: {str(e)}")


@router.get("/preview/{marker_id}")
async def preview_marker(marker_id: int, size_cm: float = 5.0, with_label: bool = True):
    """
    Preview a single marker

    Example:
        GET /api/aruco/preview/5?size_cm=5.0&with_label=true
    """
    try:
        if marker_id < 0 or marker_id > 49:
            raise HTTPException(
                status_code=400,
                detail="Marker ID must be between 0 and 49"
            )

        img_base64 = generate_aruco_marker(
            marker_id=marker_id,
            marker_size_cm=size_cm,
            with_label=with_label
        )

        return MarkerResponse(
            marker_id=marker_id,
            image_base64=img_base64,
            size_cm=size_cm,
            created_at=datetime.now().isoformat()
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preview error: {str(e)}")


@router.get("/print-sheet")
async def generate_print_sheet(
    start_id: int = 1,
    count: int = 6,
    marker_size_cm: float = 5.0,
    markers_per_row: int = 3,
    with_labels: bool = True
):
    """
    Generate a printable sheet with multiple markers

    Example:
        GET /api/aruco/print-sheet?start_id=1&count=6&markers_per_row=3
    """
    try:
        if count > 50:
            raise HTTPException(
                status_code=400,
                detail="Cannot generate more than 50 markers in a sheet"
            )

        dpi = 300
        pixels_per_cm = dpi / 2.54
        marker_size_px = int(marker_size_cm * pixels_per_cm)

        # Add margins
        margin_px = int(1 * pixels_per_cm)  # 1cm margin
        spacing_px = int(0.5 * pixels_per_cm)  # 0.5cm spacing

        # Calculate sheet dimensions
        markers_per_column = (count + markers_per_row - 1) // markers_per_row

        if with_labels:
            marker_size_px = int(marker_size_px * 1.3)  # Account for label space

        sheet_width = 2 * margin_px + markers_per_row * marker_size_px + (markers_per_row - 1) * spacing_px
        sheet_height = 2 * margin_px + markers_per_column * marker_size_px + (markers_per_column - 1) * spacing_px

        # Create white sheet
        sheet = np.ones((sheet_height, sheet_width), dtype=np.uint8) * 255

        # Place markers
        for idx in range(count):
            marker_id = start_id + idx

            if marker_id > 49:
                break

            row = idx // markers_per_row
            col = idx % markers_per_row

            x = margin_px + col * (marker_size_px + spacing_px)
            y = margin_px + row * (marker_size_px + spacing_px)

            # Generate individual marker
            marker_base64 = generate_aruco_marker(
                marker_id=marker_id,
                marker_size_cm=marker_size_cm,
                with_label=with_labels,
                dpi=dpi
            )

            # Decode and place on sheet
            marker_bytes = base64.b64decode(marker_base64)
            marker_img = Image.open(io.BytesIO(marker_bytes))
            marker_array = np.array(marker_img)

            h, w = marker_array.shape[:2]
            sheet[y:y+h, x:x+w] = marker_array

        # Convert to PNG and encode
        pil_sheet = Image.fromarray(sheet)
        buffer = io.BytesIO()
        pil_sheet.save(buffer, format='PNG', dpi=(dpi, dpi))
        sheet_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

        return {
            "success": True,
            "image_base64": sheet_base64,
            "markers": list(range(start_id, start_id + count)),
            "sheet_info": {
                "markers_per_row": markers_per_row,
                "total_rows": markers_per_column,
                "total_markers": count,
                "dpi": dpi
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sheet generation error: {str(e)}")


@router.get("/user-markers/{user_email}")
async def get_user_markers(user_email: str):
    """
    Get all markers generated by a user

    Example:
        GET /api/aruco/user-markers/user@example.com
    """
    try:
        from app.services.supabase_service import SupabaseService
        supabase_service = SupabaseService()

        user = supabase_service.get_user_by_email(user_email)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        markers = supabase_service.get_user_markers(user['id'])
        stats = supabase_service.get_marker_statistics(user['id'])

        return {
            "success": True,
            "user_email": user_email,
            "markers": markers,
            "statistics": stats
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/available-ids/{user_email}")
async def get_available_ids(user_email: str, limit: int = 50):
    """
    Get available (not yet generated) marker IDs for a user

    Example:
        GET /api/aruco/available-ids/user@example.com?limit=50
    """
    try:
        from app.services.supabase_service import SupabaseService
        supabase_service = SupabaseService()

        user = supabase_service.get_user_by_email(user_email)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        available_ids = supabase_service.get_available_marker_ids(user['id'], max_id=1000)

        # Limit response
        if limit:
            available_ids = available_ids[:limit]

        return {
            "success": True,
            "user_email": user_email,
            "available_ids": available_ids,
            "total_available": len(available_ids),
            "next_available_id": available_ids[0] if available_ids else None
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/health")
async def health_check():
    """Check if ArUco marker generation is working"""
    try:
        # Try to generate a test marker
        test_marker = generate_aruco_marker(marker_id=0, marker_size_cm=5.0)

        return {
            "status": "healthy",
            "aruco_available": True,
            "max_markers": 1000,
            "dictionary": "DICT_ARUCO_ORIGINAL"
        }
    except Exception as e:
        return {
            "status": "error",
            "aruco_available": False,
            "error": str(e)
        }
