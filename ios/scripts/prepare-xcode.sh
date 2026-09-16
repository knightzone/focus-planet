#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IOS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$IOS_DIR/.." && pwd)"
EXPECTED_RUNTIME_VERSION="5.25"
HBUILDERX_CLI="${HBUILDERX_CLI:-/Applications/HBuilderX-Alpha.app/Contents/MacOS/cli}"

if [[ ! -x "$HBUILDERX_CLI" ]]; then
  echo "HBuilderX CLI not found: $HBUILDERX_CLI" >&2
  echo "Set HBUILDERX_CLI to the 5.25 CLI path and retry." >&2
  exit 1
fi

cli_version_raw="$($HBUILDERX_CLI version 2>/dev/null || true)"
cli_version="$(printf '%s' "$cli_version_raw" | grep -Eo '[0-9]+\.[0-9]+(\.[0-9]+)?(-[[:alnum:]]+)?' | head -1 || true)"
if [[ -z "$cli_version" ]]; then
  hbuilderx_app="$(cd "$(dirname "$HBUILDERX_CLI")/../.." && pwd)"
  cli_version="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$hbuilderx_app/Contents/Info.plist" 2>/dev/null || true)"
fi
if [[ "$cli_version" != "$EXPECTED_RUNTIME_VERSION"* ]]; then
  echo "Expected HBuilderX $EXPECTED_RUNTIME_VERSION, got ${cli_version:-unknown}." >&2
  echo "Open HBuilderX 5.25, or set HBUILDERX_CLI to its CLI path." >&2
  exit 1
fi

echo "[1/4] Exporting iOS Vapor resources with HBuilderX $cli_version..."
"$HBUILDERX_CLI" publish --platform app-ios --project "$PROJECT_ROOT" --type appResource

echo "[2/4] Syncing resources into the Xcode host..."
"$SCRIPT_DIR/sync-resources.sh"

plugin_binary="$IOS_DIR/Plugins/unimoduleFocusFaceDetector.framework/unimoduleFocusFaceDetector"
plugin_source="$IOS_DIR/Plugins/Source/unimoduleFocusFaceDetector/unimoduleFocusFaceDetector/index.swift"
native_source="$IOS_DIR/Plugins/Source/unimoduleFocusFaceDetector/unimoduleFocusFaceDetector/FocusFaceDetectorNative.swift"
gradient_source="$IOS_DIR/Plugins/Source/unimoduleFocusFaceDetector/unimoduleFocusFaceDetector/FocusGradientNative.swift"
if [[ ! -f "$plugin_binary" || "$plugin_source" -nt "$plugin_binary" || "$native_source" -nt "$plugin_binary" || "$gradient_source" -nt "$plugin_binary" ]]; then
  echo "[3/4] Rebuilding the iOS detector plugin..."
  "$SCRIPT_DIR/build-plugin.sh"
else
  echo "[3/4] Detector plugin unchanged; keeping the current build."
fi

if [[ ! -d "$IOS_DIR/CustomFrameworks/DCloudUTSExtAPI.xcframework" ]]; then
  echo "Building the required ExtAPI framework..."
  "$SCRIPT_DIR/build-extapi.sh"
fi

echo "[4/4] Verifying Xcode inputs and resource freshness..."
"$SCRIPT_DIR/verify.sh"
echo "iOS resources are synchronized. Xcode can now Run or Archive the UniAppX scheme."
