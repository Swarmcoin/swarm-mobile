#!/usr/bin/env bash
# Photograph the screens Google Play will show, from the MAINNET build.
#
# Unlike scripts/swarm_store_screens.sh, which rides along on the smoke test's
# emulator and photographs whatever the drawer walk happens to reach, this
# script owns its emulator and walks a fixed route: home, Receive, Send,
# History, Settings. It installs the APK the workflow put in dist/ - in CI
# that is the published mainnet release, downloaded and checksummed - creates
# a throwaway wallet, and names each capture after the screen it is.
#
# The wallet it creates is thrown away with the emulator. Its recovery words
# are never printed, and the recovery-words screen is never photographed.
#
# Usage: scripts/store/capture_play_screens.sh [output dir]

set -uo pipefail

APP_ID="green.swarm.wallet"
OUT="${1:-store-mainnet-out}"
DUMP="$OUT/ui.xml"
mkdir -p "$OUT"

say() { echo "  $*"; }

APK="$(ls dist/*.apk 2>/dev/null | head -1 || true)"
if [ -z "$APK" ]; then
  echo "FAIL: no APK under dist/" >&2
  exit 1
fi

echo "=== Emulator ==="
adb devices
adb shell getprop ro.build.version.sdk
adb shell getprop ro.product.cpu.abi
adb shell wm size
adb shell wm density

echo "=== Installing $APK from nothing ==="
adb uninstall "$APP_ID" >/dev/null 2>&1 || true
adb install -g "$APK"
adb logcat -c || true

echo "=== Launching $APP_ID ==="
adb shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 || true
for _ in $(seq 1 40); do
  sleep 2
  [ -n "$(adb shell pidof "$APP_ID" 2>/dev/null | tr -d '\r' || true)" ] && break
done
if [ -z "$(adb shell pidof "$APP_ID" 2>/dev/null | tr -d '\r' || true)" ]; then
  echo "FAIL: the app is not running" >&2
  adb logcat -d > "$OUT/logcat.txt" 2>&1 || true
  exit 1
fi

# uiautomator refuses to dump while the window animates, so ask more than once.
ui_dump() {
  for _ in 1 2 3 4 5; do
    if adb shell uiautomator dump /sdcard/window_dump.xml >/dev/null 2>&1 \
      && adb pull /sdcard/window_dump.xml "$DUMP" >/dev/null 2>&1 && [ -s "$DUMP" ]; then
      return 0
    fi
    sleep 3
  done
  return 1
}

ui_has() { grep -q -- "$1" "$DUMP"; }

# Centre of the first node that matches, in the requested way. `desc` and
# `text` match the WHOLE attribute, because the home screen's help paragraph
# contains the words "Send" and "Receive" and a substring match taps the
# paragraph instead of the tab. `id` matches a substring of the resource-id,
# which is how the app's testIDs read.
ui_center() {
  python3 - "$1" "$2" "$DUMP" <<'PY'
import re, sys, xml.etree.ElementTree as ET

mode, needle, path = sys.argv[1], sys.argv[2], sys.argv[3]
attr = {"desc": "content-desc", "text": "text", "id": "resource-id"}[mode]
for node in ET.parse(path).getroot().iter("node"):
    value = node.get(attr, "")
    hit = needle in value if mode == "id" else value == needle
    if not hit:
        continue
    box = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.get("bounds", ""))
    if not box:
        continue
    x1, y1, x2, y2 = map(int, box.groups())
    print((x1 + x2) // 2, (y1 + y2) // 2)
    sys.exit(0)
sys.exit(1)
PY
}

ui_tap() {
  local xy
  ui_dump || return 1
  if xy="$(ui_center "$1" "$2")"; then
    say "tap $1 '$2' at $xy"
    # shellcheck disable=SC2086
    adb shell input tap $xy
    sleep 5
    return 0
  fi
  say "'$2' is not on this screen"
  return 1
}

shot() {
  if adb exec-out screencap -p > "$OUT/$1.png" 2>/dev/null && [ -s "$OUT/$1.png" ]; then
    say "captured $1.png ($(wc -c < "$OUT/$1.png") bytes)"
  else
    say "no capture for $1"
    rm -f "$OUT/$1.png"
  fi
}

echo "=== A throwaway wallet ==="
ui_dump || { echo "FAIL: uiautomator produced no dump" >&2; exit 1; }
cp "$DUMP" "$OUT/ui-first-screen.xml"
if ui_has 'loadingapp.createnewwallet'; then
  say "the start menu is showing; creating a wallet"
  ui_tap id 'loadingapp.createnewwallet' || true
  # The risk notice and the recovery-words screen are gates: until each is
  # acknowledged the app never syncs. Neither is photographed.
  for _ in $(seq 1 10); do
    ui_dump || break
    if ui_has 'risknotice.acknowledge'; then
      adb shell input swipe 540 1600 540 500 300 >/dev/null 2>&1 || true
      sleep 2
      ui_tap id 'risknotice.acknowledge' || true
      continue
    fi
    if ui_has 'newseed.continue'; then
      ui_tap id 'newseed.continue' && break
    elif ui_has 'seed.button.ok'; then
      ui_tap id 'seed.button.ok' && break
    elif ui_has 'I have saved'; then
      ui_tap text 'I have saved' && break
    fi
    sleep 3
  done
else
  say "the wallet was created on launch; no start menu"
fi

# Give the first sync a chance to draw something real before the home screen
# is photographed.
say "waiting for the first sync to report..."
for _ in $(seq 1 18); do
  ui_dump || true
  if ui_has 'header.checkicon' || ui_has 'header.playicon' || ui_has 'header.wifiicon' \
    || grep -qE 'text="(Synced|Syncing)"' "$DUMP"; then
    break
  fi
  sleep 5
done

echo "=== 01 home ==="
adb shell input keyevent KEYCODE_BACK >/dev/null 2>&1 || true
sleep 3
ui_dump || true
cp "$DUMP" "$OUT/ui-01-home.xml" 2>/dev/null || true
shot "01-home"

echo "=== 02 receive ==="
if ui_tap desc 'Receive Screen'; then
  sleep 6
  shot "02-receive"
  ui_dump && cp "$DUMP" "$OUT/ui-02-receive.xml"
fi

echo "=== 03 send ==="
if ui_tap desc 'Send'; then
  sleep 4
  shot "03-send"
  ui_dump && cp "$DUMP" "$OUT/ui-03-send.xml"
fi

echo "=== 04 history ==="
if ui_tap desc 'History'; then
  sleep 4
  shot "04-history"
  ui_dump && cp "$DUMP" "$OUT/ui-04-history.xml"
fi

# A fresh install runs in basic mode, whose Settings screen carries only the
# language row: the server and the block explorer are advanced-mode rows, and
# they are the ones worth showing on a listing. The mode pill lives in the
# drawer.
echo "=== 05 settings (advanced mode) ==="
if ui_tap id 'header.drawmenu'; then
  if ui_tap text 'Advanced'; then
    sleep 8
    ui_tap id 'header.drawmenu' || adb shell input keyevent KEYCODE_BACK
    sleep 3
  fi
fi
for _ in 1 2 3; do
  ui_tap id 'header.settings' && break
  adb shell input keyevent KEYCODE_BACK >/dev/null 2>&1 || true
  sleep 3
done
sleep 3
ui_dump || true
cp "$DUMP" "$OUT/ui-05-settings.xml" 2>/dev/null || true
shot "05-settings"

echo "=== What the captures say ==="
# The listing must not be able to claim mainnet from art that shows a testnet
# screen, so the words are read back out of the UI dumps rather than trusted.
python3 - "$OUT" <<'PY'
import glob, os, re, sys

out = sys.argv[1]
wanted = {"swm1": False, "SWARM Mainnet": False, "lwd-main.swarm.green": False}
forbidden = {"utest": False, "test coins": False, "Testnet wallet": False}
for path in sorted(glob.glob(os.path.join(out, "ui-*.xml"))):
    xml = open(path, encoding="utf-8", errors="replace").read()
    for needle in wanted:
        if needle in xml:
            wanted[needle] = True
    low = xml.lower()
    for needle in forbidden:
        if needle.lower() in low:
            forbidden[needle] = True
for needle, seen in wanted.items():
    print(f"  {'found' if seen else 'MISSING'}: {needle}")
for needle, seen in forbidden.items():
    if seen:
        print(f"  WARNING, testnet wording on a mainnet capture: {needle}")
shots = sorted(glob.glob(os.path.join(out, "*.png")))
print(f"  {len(shots)} capture(s): {', '.join(os.path.basename(p) for p in shots)}")
PY

adb logcat -d > "$OUT/logcat.txt" 2>&1 || true
COUNT="$(ls -1 "$OUT"/*.png 2>/dev/null | wc -l)"
echo "=== Captured $COUNT screen(s) into $OUT ==="
# Play needs at least two. Fewer than that is a failed run, not a listing.
if [ "$COUNT" -lt 2 ]; then
  echo "FAIL: fewer than two screens were captured" >&2
  exit 1
fi
exit 0
