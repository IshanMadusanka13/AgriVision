#!/usr/bin/env python3
"""
ArUco Marker Generator for Plant Tracking
Generates printable ArUco markers with specified IDs and sizes

Usage:
    # Generate a single marker
    python generate_aruco_markers.py --id 1 --size 5

    # Generate multiple markers
    python generate_aruco_markers.py --start 1 --end 10 --size 5

    # Generate markers with labels
    python generate_aruco_markers.py --start 1 --end 5 --size 5 --with-label
"""

import cv2
import cv2.aruco as aruco
import numpy as np
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


def generate_aruco_marker(
    marker_id: int,
    marker_size_cm: float = 5.0,
    dpi: int = 300,
    aruco_dict_type: int = cv2.aruco.DICT_4X4_50,
    border_bits: int = 1
) -> np.ndarray:
    """
    Generate an ArUco marker with specified ID and size.

    Args:
        marker_id: Unique marker ID (0-49 for DICT_4X4_50)
        marker_size_cm: Physical marker size in centimeters
        dpi: Dots per inch for printing
        aruco_dict_type: ArUco dictionary type
        border_bits: Number of border bits (white space around marker)

    Returns:
        Generated marker as numpy array
    """
    # Calculate pixel size based on DPI and physical size
    # 1 inch = 2.54 cm
    marker_size_pixels = int((marker_size_cm / 2.54) * dpi)

    # Get ArUco dictionary
    aruco_dict = aruco.getPredefinedDictionary(aruco_dict_type)

    # Generate marker
    marker_image = aruco.generateImageMarker(aruco_dict, marker_id, marker_size_pixels)

    return marker_image


def create_labeled_marker(
    marker_image: np.ndarray,
    marker_id: int,
    marker_size_cm: float,
    add_cutting_guides: bool = True
) -> Image.Image:
    """
    Create a labeled marker with ID and size information.

    Args:
        marker_image: Generated marker image
        marker_id: Marker ID
        marker_size_cm: Physical size in cm
        add_cutting_guides: Add cutting guide lines

    Returns:
        PIL Image with label
    """
    # Add padding for label
    padding = 150
    new_height = marker_image.shape[0] + padding
    new_width = marker_image.shape[1]

    # Create white background
    labeled_image = np.ones((new_height, new_width), dtype=np.uint8) * 255

    # Place marker
    labeled_image[0:marker_image.shape[0], 0:marker_image.shape[1]] = marker_image

    # Convert to PIL for text rendering
    pil_image = Image.fromarray(labeled_image)
    draw = ImageDraw.Draw(pil_image)

    # Try to load a font, fallback to default if not available
    try:
        font_large = ImageFont.truetype("arial.ttf", 40)
        font_small = ImageFont.truetype("arial.ttf", 24)
    except:
        font_large = ImageFont.load_default()
        font_small = ImageFont.load_default()

    # Add text labels
    text_y = marker_image.shape[0] + 20

    # Plant ID
    text = f"Plant ID: {marker_id}"
    draw.text((10, text_y), text, fill=0, font=font_large)

    # Size information
    text_y += 50
    text = f"Size: {marker_size_cm} cm x {marker_size_cm} cm"
    draw.text((10, text_y), text, fill=0, font=font_small)

    # Instructions
    text_y += 35
    text = "Place at soil level"
    draw.text((10, text_y), text, fill=0, font=font_small)

    # Add cutting guides if requested
    if add_cutting_guides:
        # Draw corner marks
        mark_length = 20
        mark_color = 128  # Gray

        # Top-left
        draw.line([(0, 0), (mark_length, 0)], fill=mark_color, width=1)
        draw.line([(0, 0), (0, mark_length)], fill=mark_color, width=1)

        # Top-right
        draw.line([(new_width - mark_length, 0), (new_width, 0)], fill=mark_color, width=1)
        draw.line([(new_width - 1, 0), (new_width - 1, mark_length)], fill=mark_color, width=1)

        # Bottom-left
        draw.line([(0, marker_image.shape[0] - 1), (mark_length, marker_image.shape[0] - 1)], fill=mark_color, width=1)
        draw.line([(0, marker_image.shape[0] - mark_length), (0, marker_image.shape[0])], fill=mark_color, width=1)

        # Bottom-right
        draw.line([(new_width - mark_length, marker_image.shape[0] - 1), (new_width, marker_image.shape[0] - 1)], fill=mark_color, width=1)
        draw.line([(new_width - 1, marker_image.shape[0] - mark_length), (new_width - 1, marker_image.shape[0])], fill=mark_color, width=1)

    return pil_image


def create_marker_sheet(
    marker_ids: list,
    marker_size_cm: float = 5.0,
    markers_per_row: int = 3,
    dpi: int = 300
) -> Image.Image:
    """
    Create a sheet with multiple markers for printing.

    Args:
        marker_ids: List of marker IDs to generate
        marker_size_cm: Physical marker size
        markers_per_row: Number of markers per row
        dpi: Print resolution

    Returns:
        PIL Image containing all markers
    """
    markers = []

    # Generate all markers
    for marker_id in marker_ids:
        marker_img = generate_aruco_marker(marker_id, marker_size_cm, dpi)
        labeled_img = create_labeled_marker(marker_img, marker_id, marker_size_cm)
        markers.append(labeled_img)

    # Calculate sheet dimensions
    if not markers:
        return None

    marker_width = markers[0].width
    marker_height = markers[0].height
    spacing = 50

    num_rows = (len(markers) + markers_per_row - 1) // markers_per_row

    sheet_width = (marker_width + spacing) * markers_per_row + spacing
    sheet_height = (marker_height + spacing) * num_rows + spacing

    # Create white sheet
    sheet = Image.new('L', (sheet_width, sheet_height), 255)

    # Place markers on sheet
    for i, marker in enumerate(markers):
        row = i // markers_per_row
        col = i % markers_per_row

        x = spacing + col * (marker_width + spacing)
        y = spacing + row * (marker_height + spacing)

        sheet.paste(marker, (x, y))

    return sheet


def main():
    parser = argparse.ArgumentParser(
        description="Generate ArUco markers for plant tracking system"
    )

    # Single marker or range
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--id",
        type=int,
        help="Generate a single marker with this ID"
    )
    group.add_argument(
        "--start",
        type=int,
        help="Starting ID for marker range (use with --end)"
    )

    parser.add_argument(
        "--end",
        type=int,
        help="Ending ID for marker range (use with --start)"
    )
    parser.add_argument(
        "--size",
        type=float,
        default=5.0,
        help="Marker physical size in cm (default: 5.0)"
    )
    parser.add_argument(
        "--dpi",
        type=int,
        default=300,
        help="Print resolution in DPI (default: 300)"
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="aruco_markers",
        help="Output directory (default: aruco_markers)"
    )
    parser.add_argument(
        "--with-label",
        action="store_true",
        help="Add label with ID and size information"
    )
    parser.add_argument(
        "--sheet",
        action="store_true",
        help="Generate a single sheet with all markers"
    )
    parser.add_argument(
        "--markers-per-row",
        type=int,
        default=3,
        help="Markers per row in sheet mode (default: 3)"
    )

    args = parser.parse_args()

    # Determine marker IDs to generate
    if args.id is not None:
        marker_ids = [args.id]
    else:
        if args.end is None:
            parser.error("--end is required when using --start")
        marker_ids = list(range(args.start, args.end + 1))

    # Validate marker IDs (DICT_4X4_50 supports IDs 0-49)
    max_id = 49
    invalid_ids = [mid for mid in marker_ids if mid < 0 or mid > max_id]
    if invalid_ids:
        print(f"Error: Invalid marker IDs: {invalid_ids}")
        print(f"DICT_4X4_50 supports IDs 0-{max_id}")
        return

    # Create output directory
    output_dir = Path(args.output_dir)
    output_dir.mkdir(exist_ok=True)

    print("=" * 80)
    print("ARUCO MARKER GENERATOR")
    print("=" * 80)
    print(f"\nGenerating {len(marker_ids)} marker(s)")
    print(f"Marker IDs: {marker_ids}")
    print(f"Physical Size: {args.size} cm x {args.size} cm")
    print(f"Resolution: {args.dpi} DPI")
    print(f"Output Directory: {output_dir}")
    print(f"With Label: {'Yes' if args.with_label else 'No'}")
    print(f"Sheet Mode: {'Yes' if args.sheet else 'No'}")
    print()

    if args.sheet:
        # Generate single sheet with all markers
        print("Generating marker sheet...")
        sheet = create_marker_sheet(
            marker_ids,
            marker_size_cm=args.size,
            markers_per_row=args.markers_per_row,
            dpi=args.dpi
        )

        if sheet:
            output_path = output_dir / f"aruco_sheet_{min(marker_ids)}-{max(marker_ids)}.png"
            sheet.save(str(output_path), dpi=(args.dpi, args.dpi))
            print(f"[OK] Marker sheet saved: {output_path}")
            print(f"\nSheet contains {len(marker_ids)} markers")
            print(f"Print at {args.dpi} DPI for accurate {args.size}cm sizing")
    else:
        # Generate individual markers
        for marker_id in marker_ids:
            print(f"Generating marker {marker_id}...")

            marker_img = generate_aruco_marker(
                marker_id=marker_id,
                marker_size_cm=args.size,
                dpi=args.dpi
            )

            if args.with_label:
                final_img = create_labeled_marker(
                    marker_img,
                    marker_id,
                    args.size
                )
                output_path = output_dir / f"aruco_marker_{marker_id}_labeled.png"
                final_img.save(str(output_path), dpi=(args.dpi, args.dpi))
            else:
                output_path = output_dir / f"aruco_marker_{marker_id}.png"
                cv2.imwrite(str(output_path), marker_img)

            print(f"  [OK] Saved: {output_path}")

    print("\n" + "=" * 80)
    print("GENERATION COMPLETE")
    print("=" * 80)
    print(f"\nAll markers saved to: {output_dir.absolute()}")
    print("\nPrinting Instructions:")
    print(f"  1. Print at exactly {args.dpi} DPI")
    print(f"  2. Verify printed size is {args.size} cm x {args.size} cm")
    print(f"  3. Use a ruler to confirm dimensions before cutting")
    print(f"  4. Laminate markers for durability (optional)")
    print(f"  5. Place markers at soil level, facing the camera")
    print(f"\nTips:")
    print(f"  • Use white paper for best detection")
    print(f"  • Ensure good contrast (black marker on white background)")
    print(f"  • Keep markers flat and avoid creasing")
    print(f"  • Clean markers regularly for optimal detection")
    print()


if __name__ == "__main__":
    main()
