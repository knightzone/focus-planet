#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IOS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$IOS_DIR/.." && pwd)"
ARCHIVE_PATH="${ARCHIVE_PATH:-$PROJECT_ROOT/build/ios/FocusPlanet.xcarchive}"
TEAM_ID="${DEVELOPMENT_TEAM:-}"

"$SCRIPT_DIR/verify.sh"

# 本地测试开关必须关闭：LOCAL_TEST_MODE=true 会带进登录桩、五维直进游戏等测试分支，
# 只允许用于 HBuilderX/真机调试。测试完改回 false 再出包（约定见 utils/local-test.uts）。
if ! grep -q 'export const LOCAL_TEST_MODE = false' "$PROJECT_ROOT/utils/local-test.uts"; then
  echo "LOCAL_TEST_MODE is not false; flip it back in utils/local-test.uts before archiving." >&2
  exit 1
fi

# 出包前再清一次 macOS 垃圾文件：HBuilderX / Finder 会在导出后重新生成 .DS_Store，
# 同步阶段清过也可能被再次写回；这里在 xcodebuild 之前兜底，保证产物里不含它们。
BUNDLE_APP_DIR="$IOS_DIR/FocusPlanet/FocusPlanet/uni-app-x/apps/__UNI__B5780B0"
if [[ -d "$BUNDLE_APP_DIR" ]]; then
  find "$BUNDLE_APP_DIR" \( -name '.DS_Store' -o -name '._*' \) -delete
fi

args=(
  archive
  -project "$IOS_DIR/FocusPlanet/FocusPlanet.xcodeproj"
  -scheme UniAppX
  -configuration Release
  -destination 'generic/platform=iOS'
  -archivePath "$ARCHIVE_PATH"
  COMPILER_INDEX_STORE_ENABLE=NO
)

# 工程用手动签名：target 固定了 Distribution 描述文件（专注星伴dis）与 Team。
# 不要再覆盖 CODE_SIGN_STYLE，否则 Automatic 会和已指定的描述文件冲突：
# "UniAppX has conflicting provisioning settings ... provisioning profile 专注星伴dis has been manually specified"。
if [[ -n "$TEAM_ID" ]]; then
  args+=("DEVELOPMENT_TEAM=$TEAM_ID" -allowProvisioningUpdates)
else
  echo "DEVELOPMENT_TEAM is empty; creating an unsigned validation archive."
  args+=(CODE_SIGNING_ALLOWED=NO)
fi

xcodebuild "${args[@]}"
echo "Archive created at $ARCHIVE_PATH"
