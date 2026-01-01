#!/bin/bash

# Build script for Griddit Chrome Extension
# Creates a ZIP file ready for Chrome Web Store upload

VERSION=$(grep '"version"' manifest.json | sed 's/.*: "\(.*\)".*/\1/')
OUTPUT="griddit-v${VERSION}.zip"

echo "Building Griddit v${VERSION}..."

# Remove old build
rm -f "$OUTPUT"

# Create ZIP with only necessary files
zip -r "$OUTPUT" \
    manifest.json \
    background/ \
    content/ \
    popup/ \
    icons/*.png \
    -x "*.DS_Store" \
    -x "*/.git/*"

echo ""
echo "✅ Build complete: $OUTPUT"
echo ""
echo "File size: $(du -h "$OUTPUT" | cut -f1)"
echo ""
echo "Next steps:"
echo "1. Go to https://chrome.google.com/webstore/devconsole"
echo "2. Click 'New Item' or update existing"
echo "3. Upload $OUTPUT"
echo "4. Fill in store listing details from store/description.txt"
echo "5. Upload screenshots from store/ folder"
