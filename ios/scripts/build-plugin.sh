#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IOS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PLUGIN_ROOT="$IOS_DIR/Plugins/Source/unimoduleFocusFaceDetector"
PROJECT="$PLUGIN_ROOT/unimoduleFocusFaceDetector.xcodeproj"
DERIVED_DIR="$IOS_DIR/.derived/plugin-5.26"
DEVICE_PRODUCT="$DERIVED_DIR/Build/Products/Release-iphoneos/unimoduleFocusFaceDetector.framework"
SIMULATOR_PRODUCT="$DERIVED_DIR/Build/Products/Release-iphonesimulator/unimoduleFocusFaceDetector.framework"
DESTINATION="$IOS_DIR/Plugins/unimoduleFocusFaceDetector.xcframework"

if [[ ! -d "$IOS_DIR/SDK" || ! -d "$IOS_DIR/CustomFrameworks/DCloudUTSExtAPI.xcframework" ]]; then
  echo "Missing uni-app x iOS SDK or custom ExtAPI. Run install-sdk.sh and build-extapi.sh first." >&2
  exit 1
fi

xcodebuild clean \
  -project "$PROJECT" \
  -scheme unimoduleFocusFaceDetector \
  -configuration Release \
  -derivedDataPath "$DERIVED_DIR" \
  CODE_SIGNING_ALLOWED=NO \
  COMPILER_INDEX_STORE_ENABLE=NO

# 真机与模拟器都要出切片：宿主两个平台都链接这个插件，只出真机切片会在模拟器启动时
# 报 "incompatible platform (have 'iOS', need 'iOS-simulator')" 并闪退。
for destination in 'generic/platform=iOS' 'generic/platform=iOS Simulator'; do
  xcodebuild build \
    -project "$PROJECT" \
    -scheme unimoduleFocusFaceDetector \
    -configuration Release \
    -destination "$destination" \
    -derivedDataPath "$DERIVED_DIR" \
    CODE_SIGNING_ALLOWED=NO \
    COMPILER_INDEX_STORE_ENABLE=NO
done

for product in "$DEVICE_PRODUCT" "$SIMULATOR_PRODUCT"; do
  [[ -f "$product/unimoduleFocusFaceDetector" ]] || {
    echo "Missing plugin slice: $product" >&2
    exit 1
  }
done

device_platform="$(vtool -show-build "$DEVICE_PRODUCT/unimoduleFocusFaceDetector" 2>/dev/null | awk '/platform/ {print $2; exit}')"
simulator_platform="$(vtool -show-build "$SIMULATOR_PRODUCT/unimoduleFocusFaceDetector" 2>/dev/null | awk '/platform/ {print $2; exit}')"
[[ "$device_platform" == "IOS" ]] || { echo "Unexpected device slice platform: ${device_platform:-unknown}" >&2; exit 1; }
[[ "$simulator_platform" == "IOSSIMULATOR" ]] || { echo "Unexpected simulator slice platform: ${simulator_platform:-unknown}" >&2; exit 1; }

# 同为 arm64 但平台不同，单个 .framework 装不下两份切片，必须用 xcframework。
rm -rf "$DESTINATION" "$IOS_DIR/Plugins/unimoduleFocusFaceDetector.framework"
xcodebuild -create-xcframework \
  -framework "$DEVICE_PRODUCT" \
  -framework "$SIMULATOR_PRODUCT" \
  -output "$DESTINATION"

echo "Built $DESTINATION ($(du -sh "$DESTINATION" | awk '{print $1}'))"
