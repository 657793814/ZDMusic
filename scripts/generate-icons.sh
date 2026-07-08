#!/usr/bin/env bash
set -euo pipefail

ICONS_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE="$ICONS_DIR/source.svg"
TMP_PNG="/tmp/aura-icon-1024.png"

echo "→ Rendering SVG to 1024x1024 PNG..."
qlmanage -t -s 1024 -o /tmp "$SOURCE" >/dev/null 2>&1
# qlmanage outputs source.svg.png
if [ -f "/tmp/source.svg.png" ]; then
  mv /tmp/source.svg.png "$TMP_PNG"
else
  # fallback: try with full path
  qlmanage -t -s 1024 -o /tmp "$SOURCE" >/dev/null 2>&1
  BASENAME=$(basename "$SOURCE")
  if [ -f "/tmp/${BASENAME}.png" ]; then
    mv "/tmp/${BASENAME}.png" "$TMP_PNG"
  else
    echo "❌ qlmanage failed to generate PNG"
    exit 1
  fi
fi

echo "✓ Generated 1024x1024 PNG"

# Resize to required sizes
declare -A SIZES=(
  ["32x32.png"]=32
  ["128x128.png"]=128
  ["128x128@2x.png"]=256
  ["Square30x30Logo.png"]=30
  ["Square44x44Logo.png"]=44
  ["Square71x71Logo.png"]=71
  ["Square89x89Logo.png"]=89
  ["Square107x107Logo.png"]=107
  ["Square142x142Logo.png"]=142
  ["Square150x150Logo.png"]=150
  ["Square284x284Logo.png"]=284
  ["Square310x310Logo.png"]=310
  ["StoreLogo.png"]=50
  ["icon.png"]=512
)

echo "→ Resizing PNGs..."
for FILE in "${!SIZES[@]}"; do
  SIZE="${SIZES[$FILE]}"
  sips -z "$SIZE" "$SIZE" "$TMP_PNG" --out "$ICONS_DIR/$FILE" >/dev/null 2>&1
  echo "  ✓ $FILE (${SIZE}x${SIZE})"
done

# Generate icon.ico (just use the 32x32 or 256x256 for now - sips doesn't do ico well)
# Copy the 256x256 as ico placeholder
cp "$ICONS_DIR/128x128@2x.png" "$ICONS_DIR/icon.ico"
echo "  ✓ icon.ico"

# Generate icon.icns via iconset
echo "→ Generating icon.icns..."
ICONSET_DIR="/tmp/aura-icon.iconset"
mkdir -p "$ICONSET_DIR"

sips -z 16 16 "$TMP_PNG" --out "$ICONSET_DIR/icon_16x16.png" >/dev/null 2>&1
sips -z 32 32 "$TMP_PNG" --out "$ICONSET_DIR/icon_16x16@2x.png" >/dev/null 2>&1
sips -z 32 32 "$TMP_PNG" --out "$ICONSET_DIR/icon_32x32.png" >/dev/null 2>&1
sips -z 64 64 "$TMP_PNG" --out "$ICONSET_DIR/icon_32x32@2x.png" >/dev/null 2>&1
sips -z 128 128 "$TMP_PNG" --out "$ICONSET_DIR/icon_128x128.png" >/dev/null 2>&1
sips -z 256 256 "$TMP_PNG" --out "$ICONSET_DIR/icon_128x128@2x.png" >/dev/null 2>&1
sips -z 256 256 "$TMP_PNG" --out "$ICONSET_DIR/icon_256x256.png" >/dev/null 2>&1
sips -z 512 512 "$TMP_PNG" --out "$ICONSET_DIR/icon_256x256@2x.png" >/dev/null 2>&1
sips -z 512 512 "$TMP_PNG" --out "$ICONSET_DIR/icon_512x512.png" >/dev/null 2>&1
cp "$TMP_PNG" "$ICONSET_DIR/icon_512x512@2x.png"

iconutil -c icns "$ICONSET_DIR" -o "$ICONS_DIR/icon.icns"
echo "  ✓ icon.icns"

# Cleanup
rm -f "$TMP_PNG"
rm -rf "$ICONSET_DIR"
rm -f /tmp/source.svg.png

echo "✅ All icons generated in $ICONS_DIR"
