#!/usr/bin/env bash
# 上传前体检：对 .xcarchive 做一轮「苹果会不会判无效二进制」的本地自检。
# 用法：
#   bash ios/scripts/preflight-archive.sh                     # 自动取最近一份归档
#   bash ios/scripts/preflight-archive.sh /path/to/App.xcarchive
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IOS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$IOS_DIR/.." && pwd)"

ARCHIVE="${1:-}"
if [[ -z "$ARCHIVE" ]]; then
  ARCHIVE="$(ls -dt "$HOME"/Library/Developer/Xcode/Archives/*/*.xcarchive 2>/dev/null | head -1 || true)"
fi
[[ -n "$ARCHIVE" && -d "$ARCHIVE" ]] || { echo "找不到归档；请传入 .xcarchive 路径。" >&2; exit 1; }

APP="$(find "$ARCHIVE/Products/Applications" -maxdepth 1 -name '*.app' -type d 2>/dev/null | head -1 || true)"
[[ -n "$APP" ]] || { echo "归档里没有 .app：$ARCHIVE" >&2; exit 1; }

failures=0
fail() { echo "  ✗ $1" >&2; failures=$((failures + 1)); }
ok() { echo "  ✓ $1"; }
info() { echo "    $1"; }

echo "归档：$(basename "$ARCHIVE")"
echo "App ：$(basename "$APP")"
echo

# ---------- 1. 版本号（三处必须一致，且不能是空的） ----------
echo "[1] 版本号"
manifest_name="$(plutil -extract versionName raw -o - "$PROJECT_ROOT/manifest.json" 2>/dev/null || true)"
manifest_code="$(plutil -extract versionCode raw -o - "$PROJECT_ROOT/manifest.json" 2>/dev/null || true)"
app_name="$(plutil -extract CFBundleShortVersionString raw -o - "$APP/Info.plist" 2>/dev/null || true)"
app_code="$(plutil -extract CFBundleVersion raw -o - "$APP/Info.plist" 2>/dev/null || true)"
info "manifest ${manifest_name}(${manifest_code}) / 归档 ${app_name}(${app_code})"
[[ "$app_name" == "$manifest_name" && "$app_code" == "$manifest_code" ]] || fail "版本号与 manifest.json 不一致"
[[ -n "$app_name" && -n "$app_code" ]] || fail "CFBundleShortVersionString/CFBundleVersion 为空"
[[ "$failures" -eq 0 ]] && ok "版本号一致"

# ---------- 2. 架构（只允许 arm64，绝不允许模拟器切片） ----------
echo "[2] 架构"
check_arch() {
  local bin="$1" label="$2" arch
  arch="$(lipo -info "$bin" 2>/dev/null | sed 's/.*: //')"
  if [[ "$arch" != "arm64" ]]; then fail "$label 架构异常：${arch:-未知}"; return 1; fi
}
check_arch "$APP/$(basename "$APP" .app)" "主二进制" || true
bad=0
for fw in "$APP/Frameworks"/*.framework; do
  [[ -d "$fw" ]] || continue
  name="$(basename "$fw" .framework)"
  check_arch "$fw/$name" "$name" || bad=1
done
[[ "$bad" -eq 0 ]] && ok "主二进制与全部嵌入 framework 均为 arm64"

# ---------- 3. 嵌入 framework 的 plist 键 ----------
echo "[3] 嵌入 framework 的 Info.plist"
missing=0
for fw in "$APP/Frameworks"/*.framework; do
  [[ -d "$fw" ]] || continue
  name="$(basename "$fw" .framework)"
  short="$(plutil -extract CFBundleShortVersionString raw -o - "$fw/Info.plist" 2>/dev/null || true)"
  build="$(plutil -extract CFBundleVersion raw -o - "$fw/Info.plist" 2>/dev/null || true)"
  platforms="$(plutil -extract CFBundleSupportedPlatforms json -o - "$fw/Info.plist" 2>/dev/null || true)"
  if [[ -z "$short" || -z "$build" ]]; then fail "$name 缺 CFBundleShortVersionString/CFBundleVersion（ITMS-90056）"; missing=1; fi
  if [[ "$platforms" != *"iPhoneOS"* ]]; then fail "$name 的 CFBundleSupportedPlatforms 不含 iPhoneOS"; missing=1; fi
  [[ -z "$short" ]] || info "$name  $short($build)"
done
[[ "$missing" -eq 0 ]] && ok "全部嵌入 framework 版本键与平台声明齐全"

# ---------- 3.5 「常用第三方 SDK」的签名文件（ITMS-91065） ----------
# Xcode 26 会把每个 XCFramework 自身的签名信息写进归档/包的 Signatures/<名>.xcframework-ios.signature，
# 苹果就是按这份文件校验清单内 SDK 的签名；signed=false 即 ITMS-91065 Missing signature。
# 本工程打包进包的 framework 里只有 SDWebImage 在苹果的常用第三方 SDK 清单上。
echo "[3.5] 常用第三方 SDK 的签名文件"
listed_sdks=(SDWebImage)
listed_sigs_ok=0
for sdk in "${listed_sdks[@]}"; do
  sig_file="$ARCHIVE/Signatures/$sdk.xcframework-ios.signature"
  if [[ ! -f "$sig_file" ]]; then
    fail "$sdk 缺签名文件（Signatures/$sdk.xcframework-ios.signature，ITMS-91065）"
    listed_sigs_ok=1
    continue
  fi
  sdk_signed="$(plutil -extract signed raw -o - "$sig_file" 2>/dev/null || true)"
  sdk_type="$(plutil -extract signatureType raw -o - "$sig_file" 2>/dev/null || true)"
  sdk_team="$(plutil -extract signatureIdentifier raw -o - "$sig_file" 2>/dev/null || true)"
  sdk_ts="$(plutil -extract isSecureTimestamp raw -o - "$sig_file" 2>/dev/null || true)"
  info "$sdk signed=$sdk_signed type=${sdk_type:-无} team=${sdk_team:-无} secureTimestamp=${sdk_ts:-无}"
  [[ "$sdk_signed" == "true" ]] || fail "$sdk 的 XCFramework 未签名（signed=${sdk_signed}）：跑 ios/scripts/sign-vendored-sdk.sh 后重新 Archive，否则上架报 ITMS-91065"
  [[ "$sdk_type" == "AppleDeveloperProgram" ]] || fail "$sdk 不是用 Apple 颁发证书签名（signatureType=${sdk_type:-无}）"
  listed_sigs_ok=1
done
[[ "$listed_sigs_ok" -eq 1 ]] && ok "清单内 SDK 的签名文件已校验"

# ---------- 4. 隐私清单 & 必需理由 API ----------
echo "[4] 隐私清单与必需理由 API"
if [[ -f "$APP/PrivacyInfo.xcprivacy" ]]; then ok "PrivacyInfo.xcprivacy 存在"; else fail "缺 PrivacyInfo.xcprivacy"; fi
reason_hits=0
for bin in "$APP/$(basename "$APP" .app)" "$APP/Frameworks"/*.framework/*; do
  [[ -f "$bin" ]] || continue
  hits="$(nm -u "$bin" 2>/dev/null | rg -i 'statfs|statvfs|getattrlist|mach_absolute_time|systemUptime|NSUserDefaults|UIPasteboard' | sort -u | tr '\n' ' ' || true)"
  if [[ -n "$hits" ]]; then info "$(basename "$bin"): $hits"; reason_hits=1; fi
done
if [[ "$reason_hits" -eq 1 ]]; then
  declared="$(plutil -p "$APP/PrivacyInfo.xcprivacy" 2>/dev/null | rg -c 'NSPrivacyAccessedAPIType' || true)"
  info "已声明 ${declared:-0} 个必需理由 API 类别（需覆盖上面用到的）"
  [[ "${declared:-0}" -gt 0 ]] || fail "用到必需理由 API 但隐私清单没有声明"
fi

# ---------- 5. 敏感 API 与用途说明（ITMS-90683） ----------
echo "[5] 敏感 API 与用途说明"
need_desc=0
for bin in "$APP/$(basename "$APP" .app)" "$APP/Frameworks"/*.framework/*; do
  [[ -f "$bin" ]] || continue
  hits="$(nm -u "$bin" 2>/dev/null | rg -i 'AVCaptureDevice|AVCaptureSession|PHPhotoLibrary|UIImagePickerController|CNContactStore|CLLocationManager|ASIdentifierManager|advertisingIdentifier|HKHealthStore|MPMediaLibrary|SFSpeechRecognizer' | sort -u | tr '\n' ' ' || true)"
  [[ -n "$hits" ]] && { info "$(basename "$bin"): $hits"; need_desc=1; }
done
if [[ "$need_desc" -eq 1 ]]; then
  for key in NSCameraUsageDescription NSPhotoLibraryUsageDescription NSMicrophoneUsageDescription NSContactsUsageDescription NSLocationWhenInUseUsageDescription NSUserTrackingUsageDescription; do
    if plutil -extract "$key" raw -o - "$APP/Info.plist" >/dev/null 2>&1; then info "已声明 $key"; fi
  done
  echo "    ↑ 若上面用到的 API 没有对应用途说明，会被判无效二进制"
  ok "敏感 API 扫描完成（请人工核对上面的对应关系）"
else
  ok "没有任何敏感 API 引用（本版本已移除相机/相册）"
fi

# ---------- 6. 签名 / Debug 包 / 垃圾文件 ----------
echo "[6] 签名与包内容"
if codesign --verify --deep --strict "$APP" >/dev/null 2>&1; then ok "签名严格校验通过"; else fail "签名校验失败"; fi
ent="$(codesign -d --entitlements - "$APP" 2>/dev/null || true)"
gt="$(printf '%s' "$ent" | rg -A4 'get-task-allow' | rg -o 'true|false' | head -1 || true)"
if [[ "$gt" == "true" ]]; then
  fail "get-task-allow=true —— 这是 Debug/ad-hoc 包，App Store 必拒"
else
  ok "get-task-allow=${gt:-未找到}（Release 包）"
fi
if printf '%s' "$ent" | rg -q 'application-identifier'; then ok "带 application-identifier（描述文件正确）"; else fail "缺 application-identifier"; fi
junk="$(find "$APP" \( -name '.DS_Store' -o -name '._*' \) 2>/dev/null | head -3 || true)"
if [[ -z "$junk" ]]; then ok "无 .DS_Store / ._* 垃圾文件"; else info "$junk"; fail "包内有垃圾文件"; fi

# ---------- 7. bundle 标识符 ----------
echo "[7] bundle 标识符"
dup="$(for p in "$APP/Info.plist" "$APP/Frameworks"/*.framework/Info.plist; do plutil -extract CFBundleIdentifier raw -o - "$p" 2>/dev/null || true; echo; done | rg -v '^$' | sort | uniq -d || true)"
if [[ -z "$dup" ]]; then ok "无重复 bundle id"; else info "$dup"; fail "存在重复 bundle id"; fi
for p in "$APP/Info.plist" "$APP/Frameworks"/*.framework/Info.plist; do
  bundle_id="$(plutil -extract CFBundleIdentifier raw -o - "$p" 2>/dev/null || true)"
  if [[ "$bundle_id" == *".."* ]]; then
    fail "$(basename "$(dirname "$p")") 的 bundle id 非法（连续点）：${bundle_id}；苹果无法归因签名，会报 ITMS-91065"
  fi
done

# ---------- 8. SwiftSupport ----------
echo "[8] Swift 运行库"
if otool -L "$APP/$(basename "$APP" .app)" 2>/dev/null | rg -q '@rpath/libswift'; then
  if [[ -d "$ARCHIVE/SwiftSupport" ]]; then ok "依赖工具链 Swift 运行库且归档带 SwiftSupport"; else fail "依赖工具链 Swift 运行库但归档缺 SwiftSupport（ITMS-90426）"; fi
else
  ok "使用系统 Swift 运行库，无需 SwiftSupport"
fi

echo
if [[ "$failures" -gt 0 ]]; then
  echo "体检未通过：$failures 项问题，先修再上传。" >&2
  exit 1
fi
echo "体检通过：可以上传。"
