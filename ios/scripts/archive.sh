#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IOS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$IOS_DIR/.." && pwd)"
ARCHIVE_PATH="${ARCHIVE_PATH:-$PROJECT_ROOT/build/ios/FocusPlanet.xcarchive}"
TEAM_ID="${DEVELOPMENT_TEAM:-}"

"$SCRIPT_DIR/verify.sh"

args=(
  archive
  -project "$IOS_DIR/FocusPlanet/FocusPlanet.xcodeproj"
  -scheme UniAppX
  -configuration Release
  -destination 'generic/platform=iOS'
  -archivePath "$ARCHIVE_PATH"
  COMPILER_INDEX_STORE_ENABLE=NO
)

if [[ -n "$TEAM_ID" ]]; then
  args+=(DEVELOPMENT_TEAM="$TEAM_ID" CODE_SIGN_STYLE=Automatic -allowProvisioningUpdates)
else
  echo "DEVELOPMENT_TEAM is empty; creating an unsigned validation archive."
  args+=(CODE_SIGNING_ALLOWED=NO)
fi

xcodebuild "${args[@]}"
echo "Archive created at $ARCHIVE_PATH"
