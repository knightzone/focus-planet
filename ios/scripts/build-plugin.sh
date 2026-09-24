#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IOS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PLUGIN_ROOT="$IOS_DIR/Plugins/Source/unimoduleFocusFaceDetector"
DERIVED_DIR="$IOS_DIR/.derived/plugin-5.26"
PRODUCT="$DERIVED_DIR/Build/Products/Release-iphoneos/unimoduleFocusFaceDetector.framework"
DESTINATION="$IOS_DIR/Plugins/unimoduleFocusFaceDetector.framework"

if [[ ! -d "$IOS_DIR/SDK" || ! -d "$IOS_DIR/CustomFrameworks/DCloudUTSExtAPI.xcframework" ]]; then
  echo "Missing uni-app x iOS SDK or custom ExtAPI. Run install-sdk.sh and build-extapi.sh first." >&2
  exit 1
fi

xcodebuild clean \
  -project "$PLUGIN_ROOT/unimoduleFocusFaceDetector.xcodeproj" \
  -scheme unimoduleFocusFaceDetector \
  -configuration Release \
  -derivedDataPath "$DERIVED_DIR" \
  CODE_SIGNING_ALLOWED=NO \
  COMPILER_INDEX_STORE_ENABLE=NO

xcodebuild build \
  -project "$PLUGIN_ROOT/unimoduleFocusFaceDetector.xcodeproj" \
  -scheme unimoduleFocusFaceDetector \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -derivedDataPath "$DERIVED_DIR" \
  CODE_SIGNING_ALLOWED=NO \
  COMPILER_INDEX_STORE_ENABLE=NO

mkdir -p "$DESTINATION"
rsync -a --delete "$PRODUCT/" "$DESTINATION/"
echo "Built $DESTINATION"
