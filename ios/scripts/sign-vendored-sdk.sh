#!/usr/bin/env bash
# 给 DCloud 自带的 SDWebImage.xcframework 补一个「苹果认」的签名。
#
# 为什么需要（2026-10-15 定位到 ITMS-91065 的真因）：
# - Xcode 26 有一步 SignatureCollection，会把每个 XCFramework 自身的签名信息写进归档/包的
#   `Signatures/<名>.xcframework-ios.signature`；苹果对「常用第三方 SDK」（SDWebImage 在清单里）
#   就是按这个文件校验的：`signed=false` 即报 ITMS-91065 Missing signature。上传成功的包里
#   一定有这个文件，所以「Xcode 会在嵌入时重签 App 里的拷贝」并不能替我们补上 SDK 自己的签名。
# - DCloud 5.26 的 SDWebImage.xcframework 虽自带签名，但签名者是个人 Apple Development 证书
#   （Apple Development: 赵 丰良 (LBPJ952Z8T)，Team YQM5H857L5），2025-08-12 签发、2026-08-12 已过期，
#   且 Info.plist 的 CFBundleIdentifier 是非法值 com.uni..SDWebImage。
# - 旧版 install-sdk.sh 直接 `codesign --remove-signature` 把签名删干净，于是包里写成 signed=false。
#
# 做法：修非法标识符 → 用分发证书（带安全时间戳）签两个切片 → 给 .xcframework 打根封条 → 自检。
# 注意必须两步都做：SignatureCollection 读的是 .xcframework 自身的根封条，只签内层 framework
# 仍然记成 signed=false（已实测）；反过来，先打根封条再改切片会把封条弄坏，Xcode 构建直接报
# "The signature of ... cannot be verified. A sealed resource is missing or invalid"。
#
# 幂等：已经用同一身份签好、根封条有效时直接返回，不重复重签。
# 身份可用 FOCUS_IOS_SIGN_IDENTITY 覆盖，否则按 DEVELOPMENT_TEAM（缺省 4N5RUYQ48R）找钥匙串里的分发证书。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IOS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
XCF="$IOS_DIR/SDK/Libs/SDWebImage.xcframework"

[[ -d "$XCF" ]] || { echo "sign-vendored-sdk: $XCF 不存在，跳过。"; exit 0; }

ident="${FOCUS_IOS_SIGN_IDENTITY:-}"
if [[ -z "$ident" ]]; then
  for team in "${DEVELOPMENT_TEAM:-}" 4N5RUYQ48R; do
    [[ -n "$team" ]] || continue
    ident="$(security find-identity -v -p codesigning 2>/dev/null \
      | sed -n "s/.*\"\(Apple Distribution: .*(${team})\)\".*/\1/p" | head -1)"
    [[ -n "$ident" ]] && break
  done
fi
if [[ -z "$ident" ]]; then
  echo "sign-vendored-sdk: 找不到可用的 Apple Distribution 证书，暂时跳过签名。" >&2
  echo "  出包前必须补签（否则 Xcode 会记录 signed=false，上架报 ITMS-91065）；" >&2
  echo "  先把分发证书装进钥匙串，或设置 FOCUS_IOS_SIGN_IDENTITY，然后重跑本脚本。" >&2
  exit 0
fi

# 1. 非法标识符：CodeDirectory 的 identifier 取自 Info.plist 的 CFBundleIdentifier，
#    com.uni..SDWebImage（连续点）会让重签出来的标识也不合法。
changed=0
for plist in "$XCF"/ios-*/SDWebImage.framework/Info.plist; do
  [[ -f "$plist" ]] || continue
  if [[ "$(plutil -extract CFBundleIdentifier raw "$plist" 2>/dev/null || true)" == "com.uni..SDWebImage" ]]; then
    plutil -replace CFBundleIdentifier -string "org.cocoapods.SDWebImage" "$plist"
    changed=1
  fi
done

# 2. 已签且身份一致、根封条有效时直接返回。
if [[ "$changed" -eq 0 && -f "$XCF/_CodeSignature/CodeResources" ]]; then
  sig="$(codesign -dvvv "$XCF" 2>&1 || true)"
  if printf '%s' "$sig" | grep -Fq "Authority=$ident" \
    && printf '%s' "$sig" | grep -q '^Timestamp=' \
    && codesign --verify --strict "$XCF" >/dev/null 2>&1; then
    echo "sign-vendored-sdk: 已是 ${ident##*: } 的有效签名，跳过。"
    exit 0
  fi
fi

sign_one() {
  local target="$1"
  if codesign --force --timestamp --sign "$ident" "$target" 2>/dev/null; then
    return 0
  fi
  # 离线（取不到苹果时间戳服务）时退化成不带时间戳的签名，并明确告警：上架前最好联网重签。
  echo "sign-vendored-sdk: 获取安全时间戳失败，本次不带时间戳重签：$target" >&2
  codesign --force --sign "$ident" "$target"
}

# 3. 先签内层切片，再封 .xcframework 根封条（顺序不能反，见文件头注释）。
for slice in "$XCF"/ios-*; do
  framework="$slice/SDWebImage.framework"
  [[ -d "$framework" ]] || continue
  rm -rf "$framework/_CodeSignature"
  sign_one "$framework"
done
rm -rf "$XCF/_CodeSignature"
sign_one "$XCF"

# 4. 自检：根封条能验过才说明 Xcode 的 SignatureCollection 会记成 signed=true。
codesign --verify --strict "$XCF" >/dev/null
sig="$(codesign -dvvv "$XCF" 2>&1 || true)"
printf '%s' "$sig" | grep -Fq "Authority=$ident" || { echo "sign-vendored-sdk: 根封条签名身份不是预期证书。" >&2; exit 1; }
echo "sign-vendored-sdk: 已用 ${ident##*: } 重签 SDWebImage.xcframework（含安全时间戳）。"
