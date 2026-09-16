#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IOS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$IOS_DIR/.." && pwd)"
APP_ID="__UNI__B5780B0"
EXPECTED_RUNTIME_VERSION="5.25"
export_dir="$PROJECT_ROOT/unpackage/resources/app-ios/$APP_ID"
bundle_dir="$IOS_DIR/FocusPlanet/FocusPlanet/uni-app-x/apps/$APP_ID"
bundle_manifest="$bundle_dir/www/manifest.json"

fail_stale() {
  echo "error: iOS uni-app x resources are stale. Run: ios/scripts/prepare-xcode.sh" >&2
  exit 1
}

[[ -f "$bundle_manifest" ]] || fail_stale

compiler_version="$(plutil -extract 'uni-app-x.compilerVersion' raw -o - "$bundle_manifest" 2>/dev/null || true)"
if [[ "$compiler_version" != "$EXPECTED_RUNTIME_VERSION" ]]; then
  echo "error: iOS resources use compiler ${compiler_version:-unknown}; expected $EXPECTED_RUNTIME_VERSION." >&2
  fail_stale
fi

source_roots=(
  "$PROJECT_ROOT/App.uvue"
  "$PROJECT_ROOT/pages.json"
  "$PROJECT_ROOT/manifest.json"
  "$PROJECT_ROOT/pages"
  "$PROJECT_ROOT/components"
  "$PROJECT_ROOT/utils"
  "$PROJECT_ROOT/uni_modules"
  "$PROJECT_ROOT/static"
)

for source_root in "${source_roots[@]}"; do
  [[ -e "$source_root" ]] || continue
  if [[ -f "$source_root" ]]; then
    [[ "$source_root" -nt "$bundle_manifest" ]] && fail_stale
  elif find "$source_root" -type f -newer "$bundle_manifest" -print -quit | grep -q .; then
    fail_stale
  fi
done

if [[ -f "$export_dir/www/manifest.json" ]]; then
  if [[ "$export_dir/www/manifest.json" -nt "$bundle_manifest" ]]; then
    echo "error: Exported iOS resources are newer than the Xcode bundle." >&2
    fail_stale
  fi
  if ! cmp -s "$export_dir/www/manifest.json" "$bundle_manifest"; then
    echo "error: Exported iOS manifest and the Xcode bundle differ." >&2
    fail_stale
  fi
  if [[ -f "$export_dir/www/app-service.js" ]] && ! cmp -s "$export_dir/www/app-service.js" "$bundle_dir/www/app-service.js"; then
    echo "error: Exported iOS app-service and the Xcode bundle differ." >&2
    fail_stale
  fi
  if [[ -z "${XCODE_VERSION_ACTUAL:-}" ]] && ! diff -qr -x .DS_Store "$export_dir" "$bundle_dir" >/dev/null; then
    echo "error: Exported iOS resources and the Xcode bundle differ." >&2
    fail_stale
  fi
fi

echo "iOS uni-app x resources are current (5.25, $APP_ID)."
