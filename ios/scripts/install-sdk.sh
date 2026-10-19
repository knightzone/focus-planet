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

# DCloud 自带的 SDWebImage 签名是一个已过期的个人开发证书签名（Apple Development: 赵 丰良，
# Team YQM5H857L5，2026-08-12 过期），Info.plist 的标识符还是非法值 com.uni..SDWebImage。
# 以前这里用 codesign --remove-signature 把它删掉，结果 Xcode 26 的 SignatureCollection 会在包里
# 把该 XCFramework 记成 signed=false（Signatures/SDWebImage.xcframework-ios.signature），
# 上架直接报 ITMS-91065 Missing signature —— 苹果按这份文件校验「常用第三方 SDK」的签名。
# 现在改成：修标识符 + 用我们的分发证书重签（内层切片 + .xcframework 根封条），见脚本注释。
"$SCRIPT_DIR/sign-vendored-sdk.sh"

echo "$SDK_VERSION" > "$IOS_DIR/SDK/.uniappx-sdk-version"
echo "Installed uni-app x iOS SDK ${SDK_VERSION} under $IOS_DIR"
