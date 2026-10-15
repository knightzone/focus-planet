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

# HBuilderX 导出生成的宿主 Info.plist 会重置为模板、丢掉手工维护的键（权限文案、
# 竖屏锁定、显示名），上架必需；这里在每次同步后幂等补回。
# 2026-10-15 本版本不支持摄像头/相册：宿主不再声明相机与相册权限（客户端无
# uni.camera / uni.chooseImage / uni.previewImage 调用，ExtAPI 也已不编译
# uni-camera / uni-media）。若模板补回这些键就在同步后删掉，否则上架上传会因
# 缺少用途说明报 ITMS-90683。其它 NS* 文案（通讯录/健康/位置/追踪）同样不要。
host_plist="$IOS_DIR/FocusPlanet/FocusPlanet/Info.plist"
plutil -replace CFBundleDisplayName -string "专注星伴" "$host_plist"
plutil -remove NSCameraUsageDescription "$host_plist" 2>/dev/null || true
plutil -remove NSPhotoLibraryUsageDescription "$host_plist" 2>/dev/null || true
plutil -remove NSPhotoLibraryAddUsageDescription "$host_plist" 2>/dev/null || true
plutil -remove NSFaceIDUsageDescription "$host_plist" 2>/dev/null || true
plutil -remove NSLocalNetworkUsageDescription "$host_plist" 2>/dev/null || true
plutil -replace UISupportedInterfaceOrientations -json '["UIInterfaceOrientationPortrait"]' "$host_plist"
# 标准加密（仅 https），上传时自动回答出口合规问题。
plutil -replace ITSAppUsesNonExemptEncryption -bool NO "$host_plist"

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
