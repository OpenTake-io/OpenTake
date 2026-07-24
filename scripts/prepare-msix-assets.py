#!/usr/bin/env python3
"""
Prepare MSIX assets from the application icon.
Generates required logo and splash screen images for MSIX packaging.
"""

import os
from PIL import Image

# Source icon
SOURCE_ICON = os.path.join(os.path.dirname(__file__), '..', 'icons', 'icons', 'win', 'icon.ico')

# Output directory for MSIX assets
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'build', 'msix-assets')

# Required MSIX image sizes
MSIX_SIZES = {
    'Square44x44Logo': (44, 44),
    'Square150x150Logo': (150, 150),
    'Wide310x150Logo': (310, 150),
    'Square310x310Logo': (310, 310),
    'StoreLogo': (50, 50),
    'SplashScreen': (620, 300),
}


def create_msix_image(source_img, size, output_path, background_color=(0, 0, 0, 0)):
    """Create an MSIX image with proper sizing and padding."""
    # Create a new image with the target size
    img = Image.new('RGBA', size, background_color)

    # Calculate scaling to fit within the target size while maintaining aspect ratio
    source_ratio = source_img.width / source_img.height
    target_ratio = size[0] / size[1]

    if source_ratio > target_ratio:
        # Source is wider, scale by width
        new_width = int(size[0] * 0.8)  # 80% of target width
        new_height = int(new_width / source_ratio)
    else:
        # Source is taller, scale by height
        new_height = int(size[1] * 0.8)  # 80% of target height
        new_width = int(new_height * source_ratio)

    # Resize the source image
    resized = source_img.resize((new_width, new_height), Image.Resampling.LANCZOS)

    # Calculate position to center the image
    x = (size[0] - new_width) // 2
    y = (size[1] - new_height) // 2

    # Paste the resized image onto the background
    img.paste(resized, (x, y), resized if resized.mode == 'RGBA' else None)

    # Save the image
    img.save(output_path, 'PNG')
    print(f"  Created: {output_path}")


def main():
    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Load source icon
    print(f"Loading source icon: {SOURCE_ICON}")
    source_img = Image.open(SOURCE_ICON)
    print(f"  Size: {source_img.size}, Mode: {source_img.mode}")

    # Convert to RGBA if needed
    if source_img.mode != 'RGBA':
        source_img = source_img.convert('RGBA')

    # Generate all required MSIX images
    print("\nGenerating MSIX assets...")
    for name, size in MSIX_SIZES.items():
        output_path = os.path.join(OUTPUT_DIR, f'{name}.png')
        create_msix_image(source_img, size, output_path)

    print(f"\n✅ MSIX assets generated in: {OUTPUT_DIR}")
    print("\nGenerated files:")
    for name in MSIX_SIZES.keys():
        print(f"  - {name}.png")

    print("\nUsage in electron-builder.json5:")
    print('  "msix": {')
    print('    "logo": "build/msix-assets/Square150x150Logo.png",')
    print('    "splashScreen": "build/msix-assets/SplashScreen.png",')
    print('    ...')
    print('  }')


if __name__ == '__main__':
    main()
