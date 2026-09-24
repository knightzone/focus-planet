#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IOS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$IOS_DIR/.." && pwd)"
APP_ID="__UNI__B5780B0"
EXPECTED_RUNTIME_VERSION="5.26"
source_dir="${1:-$PROJECT_ROOT/unpackage/resources/app-ios/$APP_ID}"
target_dir="$IOS_DIR/FocusPlanet/FocusPlanet/uni-app-x/apps/$APP_ID"
generated_plugin="$PROJECT_ROOT/unpackage/resources/app-ios/uni_modules/focus-face-detector/utssdk/app-ios/src/index.swift"
generated_gradient="$PROJECT_ROOT/unpackage/resources/app-ios/uni_modules/focus-gradient/utssdk/app-ios/src/index.swift"
plugin_source="$IOS_DIR/Plugins/Source/unimoduleFocusFaceDetector/unimoduleFocusFaceDetector"

if [[ ! -f "$source_dir/www/manifest.json" ]]; then
  echo "Missing exported iOS app resources: $source_dir" >&2
  echo "In HBuilderX ${EXPECTED_RUNTIME_VERSION} choose: 发行 → 原生App-本地打包 → 生成本地打包App资源." >&2
  exit 1
fi

compiler_version="$(plutil -extract 'uni-app-x.compilerVersion' raw -o - "$source_dir/www/manifest.json" 2>/dev/null || true)"
if [[ "$compiler_version" != "$EXPECTED_RUNTIME_VERSION" ]]; then
  echo "Exported resources use compiler ${compiler_version:-unknown}; expected ${EXPECTED_RUNTIME_VERSION}." >&2
  echo "Regenerate the iOS local app resources with HBuilderX ${EXPECTED_RUNTIME_VERSION}." >&2
  exit 1
fi

# macOS 的 .DS_Store / ._* 只会在包里占位、还会污染资源新鲜度判断，一律不进包。
# --delete-excluded：源里没有、但目标里遗留的这些文件也一并删掉。
mkdir -p "$target_dir"
rsync -a --delete --delete-excluded --exclude='.DS_Store' --exclude='._*' "$source_dir/" "$target_dir/"
find "$target_dir" \( -name '.DS_Store' -o -name '._*' \) -delete

if [[ -f "$generated_plugin" ]]; then
  if [[ ! -f "$plugin_source/index.swift" ]] || ! cmp -s "$generated_plugin" "$plugin_source/index.swift"; then
    cp "$generated_plugin" "$plugin_source/index.swift"
  fi
fi
if [[ -f "$generated_gradient" ]]; then
  if [[ ! -f "$plugin_source/FocusGradientNative.swift" ]] || ! cmp -s "$generated_gradient" "$plugin_source/FocusGradientNative.swift"; then
    cp "$generated_gradient" "$plugin_source/FocusGradientNative.swift"
  fi
fi
native_source="$PROJECT_ROOT/uni_modules/focus-face-detector/utssdk/app-ios/FocusFaceDetectorNative.swift"
if [[ ! -f "$plugin_source/FocusFaceDetectorNative.swift" ]] || ! cmp -s "$native_source" "$plugin_source/FocusFaceDetectorNative.swift"; then
  cp "$native_source" "$plugin_source/FocusFaceDetectorNative.swift"
fi

# The Xcode project embeds `uni-app-x` as a folder reference. Refresh its
# directory timestamp so the Resources phase recopies changed nested files.
touch "$IOS_DIR/FocusPlanet/FocusPlanet/uni-app-x"

echo "Synced $APP_ID resources into the Xcode host."
