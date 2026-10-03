#!/usr/bin/env bash
set -euo pipefail

: "${SIMULATOR_UDID:?Set SIMULATOR_UDID to an isolated, booted iPhone simulator}"

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
BUNDLE_ID=${APP_BUNDLE_ID:-com.clayton.ramenprofitable}
OUTPUT_DIR=${NATIVE_TEST_OUTPUT_DIR:-"$ROOT/.expo/meal-accessibility-native-test"}
PROJECT="$ROOT/native-tests/MealAccessibilityUI/MealAccessibilityUI.xcodeproj"
SCHEME=MealAccessibilityUI
TEST=MealAccessibilityUI/MealAccessibilityUITests/testQuoteAndActionsAreReachableAndCancellationSpendsNothing
mkdir -p "$OUTPUT_DIR"

DATA_CONTAINER=$(xcrun simctl get_app_container "$SIMULATOR_UDID" "$BUNDLE_ID" data)
STORAGE="$DATA_CONTAINER/Library/Application Support/$BUNDLE_ID/RCTAsyncLocalStorage_V1"
MANIFEST="$STORAGE/manifest.json"
if [[ ! -f "$MANIFEST" ]]; then
  echo "Launch the installed app once so AsyncStorage creates $MANIFEST" >&2
  exit 1
fi

ORIGINAL_SIZE=$(xcrun simctl ui "$SIMULATOR_UDID" content_size)
BACKUP="$OUTPUT_DIR/storage-backup"
rm -rf "$BACKUP"
mkdir -p "$BACKUP"
cp -a "$STORAGE/." "$BACKUP/"

restore() {
  xcrun simctl terminate "$SIMULATOR_UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
  rm -rf "$STORAGE"
  mkdir -p "$STORAGE"
  cp -a "$BACKUP/." "$STORAGE/"
  xcrun simctl ui "$SIMULATOR_UDID" content_size "$ORIGINAL_SIZE" >/dev/null 2>&1 || true
}
trap restore EXIT

seed_fixture() {
  python3 - "$MANIFEST" <<'PY'
import json
import sys
import time

path = sys.argv[1]
manifest = json.load(open(path))
key = "ramen-profitable-v1"
root = json.loads(manifest[key])
state = root["state"]
state.update({
    "cash": 1_000_000,
    "mrr": 0,
    "hasJob": False,
    "upgrades": {name: True for name in ("coffee", "kb", "claude", "cat", "aso", "desk", "agent")},
    "mealsFunded": 39_996,
    "lastSeen": int(time.time() * 1000),
})
manifest[key] = json.dumps(root, separators=(",", ":"))
with open(path, "w") as output:
    json.dump(manifest, output, separators=(",", ":"))
PY
}

run_test() {
  local test_name=$1
  local result=$2
  rm -rf "$result"
  xcodebuild test \
    -project "$PROJECT" \
    -scheme "$SCHEME" \
    -destination "platform=iOS Simulator,id=$SIMULATOR_UDID" \
    -derivedDataPath "$OUTPUT_DIR/derived-data" \
    -resultBundlePath "$result" \
    -parallel-testing-enabled NO \
    -only-testing:"$test_name"
}

for size in large accessibility-large accessibility-extra-extra-extra-large; do
  echo "== Meal accessibility: $size =="
  xcrun simctl terminate "$SIMULATOR_UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
  seed_fixture
  xcrun simctl ui "$SIMULATOR_UDID" content_size "$size"
  xcrun simctl launch "$SIMULATOR_UDID" "$BUNDLE_ID" >/dev/null
  if [[ -n "${METRO_DEEP_LINK:-}" ]]; then
    xcrun simctl openurl "$SIMULATOR_UDID" "$METRO_DEEP_LINK"
  fi
  xcrun simctl launch "$SIMULATOR_UDID" "$BUNDLE_ID" >/dev/null
  sleep 4

  run_test "$TEST" "$OUTPUT_DIR/$size.xcresult"
done
