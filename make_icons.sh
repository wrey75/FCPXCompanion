#!/bin/bash

ORIGINAL_ICON=src/renderer/application-logo.png
mkdir AppIcon.iconset
sips -z 16 16     "$ORIGINAL_ICON" --out AppIcon.iconset/icon_16x16.png
sips -z 32 32     "$ORIGINAL_ICON" --out AppIcon.iconset/icon_16x16@2x.png
sips -z 32 32     "$ORIGINAL_ICON" --out AppIcon.iconset/icon_32x32.png
sips -z 64 64     "$ORIGINAL_ICON" --out AppIcon.iconset/icon_32x32@2x.png
sips -z 128 128   "$ORIGINAL_ICON" --out AppIcon.iconset/icon_128x128.png
sips -z 256 256   "$ORIGINAL_ICON" --out AppIcon.iconset/icon_128x128@2x.png
sips -z 256 256   "$ORIGINAL_ICON" --out AppIcon.iconset/icon_256x256.png
sips -z 512 512   "$ORIGINAL_ICON" --out AppIcon.iconset/icon_256x256@2x.png
sips -z 512 512   "$ORIGINAL_ICON" --out AppIcon.iconset/icon_512x512.png
sips -z 1024 1024 "$ORIGINAL_ICON" --out AppIcon.iconset/icon_512x512@2x.png
iconutil -c icns AppIcon.iconset
rm -R AppIcon.iconset
