#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IOS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SDK_VERSION="5.26"
SDK_URL="https://web-ext-storage.dcloud.net.cn/uni-app-x/sdk/iOS-Vapor/UniAppXSDK-iOS-Vapor%40${SDK_VERSION}.zip"

source_root="${1:-}"
work_dir=""

if [[ -z "$source_root" ]]; then
  work_dir="$(mktemp -d /tmp/focus-planet-ios-sdk.XXXXXX)"
  trap 'rm -rf "$work_dir"' EXIT
  echo "Downloading uni-app x iOS SDK ${SDK_VERSION}..."
  curl -fL --retry 3 "$SDK_URL" -o "$work_dir/sdk.zip"
  unzip -q "$work_dir/sdk.zip" -d "$work_dir/extracted"
  source_root="$(find "$work_dir/extracted" -maxdepth 2 -type d -name SDK -print -quit | xargs dirname)"
fi

if [[ ! -d "$source_root/SDK" || ! -d "$source_root/TemporarySampleFramework" ]]; then
  echo "SDK source is invalid: $source_root" >&2
  echo "Pass the extracted UniAppX-iOS@${SDK_VERSION} directory, or run without arguments to download it." >&2
  exit 1
fi

source_libs="$source_root/SDK/libs"
if [[ ! -d "$source_libs" ]]; then
  source_libs="$source_root/SDK/Libs"
fi

mkdir -p "$IOS_DIR/SDK/Libs" "$IOS_DIR/TemporarySampleFramework"
rsync -a --delete "$source_root/SDK/ExtApiSrc/" "$IOS_DIR/SDK/ExtApiSrc/"
rsync -a --delete "$source_root/SDK/Headers/" "$IOS_DIR/SDK/Headers/"
rsync -a --delete "$source_root/SDK/PrivacyInfo/" "$IOS_DIR/SDK/PrivacyInfo/"
rsync -a --delete "$source_root/SDK/Resources/" "$IOS_DIR/SDK/Resources/"
rsync -a --delete "$source_libs/" "$IOS_DIR/SDK/Libs/"
rsync -a --delete "$source_root/TemporarySampleFramework/" "$IOS_DIR/TemporarySampleFramework/"

# The vendored SDWebImage signature is not trusted by Xcode 26 on some Macs.
# Removing only that vendored signature lets Xcode re-sign the embedded framework at Archive time.
if [[ -d "$IOS_DIR/SDK/Libs/SDWebImage.xcframework" ]]; then
  codesign --remove-signature "$IOS_DIR/SDK/Libs/SDWebImage.xcframework" 2>/dev/null || true
  while IFS= read -r framework; do
    codesign --remove-signature "$framework" 2>/dev/null || true
  done < <(find "$IOS_DIR/SDK/Libs/SDWebImage.xcframework" -type d -name '*.framework')
fi

echo "$SDK_VERSION" > "$IOS_DIR/SDK/.uniappx-sdk-version"
echo "Installed uni-app x iOS SDK ${SDK_VERSION} under $IOS_DIR"
