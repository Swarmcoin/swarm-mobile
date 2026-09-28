#!/usr/bin/env bash
# SWARM Android smoke test.
#
# Installs the built APK on a running emulator from nothing, launches it, and
# asserts that it stays up, renders its first screen, and reaches the SWARM
# Mainnet indexer without the user configuring anything. The desktop wallet
# shipped a fresh install that said "NOT CONNECTED - No server configured"
# because only its launcher script wrote the default; this is the check that
# catches the same shape of defect here. The fresh wallet then types two SWARM
# Mainnet addresses and one Zcash address into its Send field, because the
# desktop wallet also shipped a mainnet build that refused every mainnet
# recipient.
#
# The default server is the FIRST entry of `app/uris/serverUris.ts`, with a
# matching copy in `rust/lib/src/lib.rs` (SWARM_MAINNET_SERVER_URI). A build
# that opens on the engineering testnet instead fails here, which is the
# point: which network a fresh install lands on is the one setting nobody
# should have to check by hand.
#
# Usage: scripts/swarm_smoke_test.sh <path to apk> [label]

set -euo pipefail

APK="${1:?usage: swarm_smoke_test.sh <apk> [label]}"
LABEL="${2:-apk}"
APP_ID="green.swarm.wallet"
DEFAULT_SERVER="https://lwd-main.swarm.green:8443"
DEFAULT_HOST="lwd-main.swarm.green"
DEFAULT_PORT="8443"
OUT="smoke-out/$LABEL"
mkdir -p "$OUT"
# The log from launch to the last assertion, kept whatever the outcome. The
# early capture below only covers the first minute after launch.
trap 'adb logcat -d > "$OUT/logcat-end.txt" 2>&1 || true' EXIT

echo "=== Emulator ($LABEL) ==="
adb devices
adb shell getprop ro.build.version.sdk
adb shell getprop ro.product.cpu.abi

# Can the runner itself reach the indexer? The answer decides what the
# connection assertion below is allowed to claim, so it is measured, never
# assumed.
echo "=== Is $DEFAULT_SERVER reachable from this runner ==="
SERVER_REACHABLE=no
HTTP_CODE="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 \
  "https://$DEFAULT_HOST:$DEFAULT_PORT/status.json" 2>&1 || echo "000")"
echo "  https://$DEFAULT_HOST:$DEFAULT_PORT/status.json -> HTTP $HTTP_CODE"
TLS="$(echo | timeout 20 openssl s_client -connect "$DEFAULT_HOST:$DEFAULT_PORT" \
  -servername "$DEFAULT_HOST" 2>&1 | grep -E '^(CONNECTED|subject=)' | head -2 || true)"
if [ -n "$TLS" ]; then
  echo "$TLS" | sed 's/^/  tls: /'
else
  echo "  tls: no handshake"
fi
if [ "$HTTP_CODE" = "200" ] && [ -n "$TLS" ]; then
  SERVER_REACHABLE=yes
fi
echo "  reachable from the runner: $SERVER_REACHABLE"
echo "$HTTP_CODE" > "$OUT/server-http-code.txt"

echo "=== Installing $APK from nothing ==="
# A leftover install would carry a settings file and a wallet, and the whole
# point here is the first launch.
adb uninstall "$APP_ID" >/dev/null 2>&1 || true
adb install -g "$APK"

# A fresh log, so anything captured below belongs to this launch.
adb logcat -c || true

echo "=== Launching $APP_ID ==="
adb shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null

# The first launch unpacks the JS bundle and loads libuniffi_zingo.so. Give it
# room, then confirm the process is still alive rather than sampling once.
ALIVE=""
for _ in $(seq 1 30); do
  sleep 2
  PID="$(adb shell pidof "$APP_ID" 2>/dev/null | tr -d '\r' || true)"
  if [ -n "$PID" ]; then
    ALIVE="$PID"
  fi
done

adb logcat -d > "$OUT/logcat.txt" 2>&1 || true
adb shell screencap -p /sdcard/swarm-first-screen.png 2>/dev/null || true
adb pull /sdcard/swarm-first-screen.png "$OUT/first-screen.png" 2>/dev/null || true
adb shell dumpsys activity activities > "$OUT/activities.txt" 2>&1 || true

echo "=== Assertions ==="

if [ -z "$ALIVE" ]; then
  echo "FAIL: $APP_ID is not running after launch." >&2
  echo "--- last 200 log lines ---" >&2
  tail -200 "$OUT/logcat.txt" >&2 || true
  exit 1
fi
echo "ok: process alive (pid $ALIVE)"

# A native loader failure is the specific thing this test exists to catch, and
# it can happen without killing the process outright.
if grep -qE 'UnsatisfiedLinkError|dlopen failed|couldn.t find "libuniffi_zingo' "$OUT/logcat.txt"; then
  echo "FAIL: the native wallet library did not load." >&2
  grep -nE 'UnsatisfiedLinkError|dlopen failed|couldn.t find "libuniffi_zingo' "$OUT/logcat.txt" >&2 | head -20
  exit 1
fi
echo "ok: no native link errors"

if grep -qE "FATAL EXCEPTION|Process $APP_ID .*died|ANR in $APP_ID" "$OUT/logcat.txt"; then
  echo "FAIL: the app crashed or hung." >&2
  grep -nE "FATAL EXCEPTION|ANR in $APP_ID" -A20 "$OUT/logcat.txt" >&2 | head -60
  exit 1
fi
echo "ok: no fatal exception"

# React Native reports a JS-side crash as a red box rather than a process
# death, so check for it explicitly.
if grep -qE 'ReactNativeJS.*(Error|error):|No bundle URL present' "$OUT/logcat.txt"; then
  echo "FAIL: the JS bundle failed to run." >&2
  grep -nE 'ReactNativeJS' "$OUT/logcat.txt" >&2 | head -40
  exit 1
fi
echo "ok: the JS bundle ran"

# The first screen is rendered by MainActivity; a resumed activity in the
# dumpsys dump is the evidence that something is actually on screen.
if ! grep -q "$APP_ID" "$OUT/activities.txt"; then
  echo "FAIL: no $APP_ID activity in the activity dump." >&2
  exit 1
fi
echo "ok: the app's activity is on the stack"

if [ -s "$OUT/first-screen.png" ]; then
  echo "ok: captured the first screen ($(wc -c < "$OUT/first-screen.png") bytes)"
else
  echo "note: no screenshot captured (not fatal)"
fi

echo "=== Fresh-install connection check ==="

DUMP="$OUT/ui.xml"

# uiautomator refuses to dump while the window is animating, so ask again
# rather than reading a stale file.
ui_dump() {
  for _ in 1 2 3 4 5; do
    if adb shell uiautomator dump /sdcard/window_dump.xml >/dev/null 2>&1; then
      if adb pull /sdcard/window_dump.xml "$DUMP" >/dev/null 2>&1 && [ -s "$DUMP" ]; then
        return 0
      fi
    fi
    sleep 3
  done
  return 1
}

# Prints the centre of the first node whose resource-id, text or
# content-description contains the needle. Coordinates come from the node's
# own bounds, never from a guess about the layout.
ui_center() {
  python3 - "$1" "$DUMP" <<'PY'
import re, sys, xml.etree.ElementTree as ET

needle, path = sys.argv[1], sys.argv[2]
for node in ET.parse(path).getroot().iter('node'):
    hay = ' '.join(node.get(a, '') for a in ('resource-id', 'text', 'content-desc'))
    if needle not in hay:
        continue
    m = re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.get('bounds', ''))
    if not m:
        continue
    x1, y1, x2, y2 = map(int, m.groups())
    print((x1 + x2) // 2, (y1 + y2) // 2)
    sys.exit(0)
sys.exit(1)
PY
}

ui_has() { grep -q -- "$1" "$DUMP"; }

ui_tap() {
  local xy
  if xy="$(ui_center "$1")"; then
    echo "  tap $1 at $xy"
    adb shell input tap $xy
    sleep 4
    return 0
  fi
  return 1
}

shot() {
  adb shell screencap -p "/sdcard/$1.png" >/dev/null 2>&1 || true
  adb pull "/sdcard/$1.png" "$OUT/$1.png" >/dev/null 2>&1 || true
  if [ -s "$OUT/$1.png" ]; then
    echo "  evidence $OUT/$1.png ($(wc -c < "$OUT/$1.png") bytes)"
  fi
}

ui_dump || { echo "FAIL: uiautomator produced no dump" >&2; exit 1; }
cp "$DUMP" "$OUT/ui-first-screen.xml"

# The risk notice is the first thing a mainnet build shows, and what it says
# is the release's own statement about the money in the wallet. A mainnet APK
# carrying the testnet text tells its first user that real SWM is worthless,
# which shipped once already. The run fails on it here rather than in a store
# listing.
NOTICE="$OUT/ui-risk-notice.xml"

# Reads the whole notice. Only the paragraphs on screen reach a dump, so the
# scroll view is walked to its foot and every dump is kept.
assert_mainnet_notice() {
  cp "$DUMP" "$NOTICE"
  for _ in 1 2 3 4 5; do
    adb shell input swipe 540 1500 540 600 300 >/dev/null 2>&1 || true
    sleep 1
    ui_dump || break
    cat "$DUMP" >> "$NOTICE"
  done
  for phrase in 'SWARM Mainnet is the live network' \
                'The SWM in this wallet is real' \
                'You hold this wallet yourself' \
                'Your recovery phrase is your only backup' \
                'The software is early'; do
    if ! grep -q -- "$phrase" "$NOTICE"; then
      echo "FAIL: the mainnet risk notice is missing: $phrase" >&2
      echo "      dump: $NOTICE" >&2
      exit 1
    fi
  done
  for phrase in 'test coins' 'test network' 'engineering network' 'have no value'; do
    if grep -qi -- "$phrase" "$NOTICE"; then
      echo "FAIL: the mainnet risk notice still carries testnet wording: $phrase" >&2
      exit 1
    fi
  done
  echo "  the risk notice carries the mainnet wording"
}

NOTICE_CHECKED=""
if ui_has 'risknotice.screen'; then
  shot risk-notice
  assert_mainnet_notice
  NOTICE_CHECKED=1
fi

# On a fresh install with a reachable server the app creates the wallet by
# itself and lands on the Receive screen. Offline, or in advanced mode, it
# stops at the start menu and waits to be told.
if ui_has 'loadingapp.createnewwallet'; then
  echo "  the start menu is showing; creating a wallet"
  ui_tap 'loadingapp.createnewwallet' || {
    echo "FAIL: could not tap Create New Wallet" >&2; exit 1; }
  # Creating a wallet raises the risk notice first; the recovery-words screen
  # comes after it, when the flow shows one. Both are gates: until each is
  # acknowledged the app never starts a sync, so the loop looks for whichever
  # one is on screen instead of assuming an order.
  GATES_CLOSED=""
  for _ in $(seq 1 8); do
    ui_dump || break
    if ui_has 'risknotice.acknowledge'; then
      if [ -z "$NOTICE_CHECKED" ]; then
        shot risk-notice
        assert_mainnet_notice
        NOTICE_CHECKED=1
      fi
      # The button sits at the foot of a long scroll view. Scroll it into
      # reach first so the tap lands on the button and not on the text.
      adb shell input swipe 540 1600 540 500 300 >/dev/null 2>&1 || true
      sleep 2
      ui_dump || true
      ui_tap 'risknotice.acknowledge' || true
      continue
    fi
    # The recovery-words screen. Its button is `newseed.continue` on this
    # build; the other two are what older builds and the restore flow show.
    if ui_has 'newseed.continue'; then
      if ui_tap 'newseed.continue'; then GATES_CLOSED=1; break; fi
    elif ui_has 'seed.button.ok'; then
      if ui_tap 'seed.button.ok'; then GATES_CLOSED=1; break; fi
    elif ui_has 'I have saved'; then
      if ui_tap 'I have saved'; then GATES_CLOSED=1; break; fi
    fi
    sleep 3
  done
  if [ -z "$GATES_CLOSED" ]; then
    echo "  note: no recovery-words screen closed within the window"
  fi
else
  echo "  the wallet was created on launch; no start menu"
  # The boot notice still gates the app. Close it before the sync window.
  for _ in 1 2 3 4; do
    ui_dump || break
    ui_has 'risknotice.acknowledge' || break
    adb shell input swipe 540 1600 540 500 300 >/dev/null 2>&1 || true
    sleep 2
    ui_dump || true
    ui_tap 'risknotice.acknowledge' || true
  done
fi

if [ -z "$NOTICE_CHECKED" ]; then
  echo "FAIL: the first run never showed the risk notice, so its wording" >&2
  echo "      was never read. A fresh install must gate on it." >&2
  exit 1
fi

# Up to 90 s for the first sync to report something. Basic mode, which is what
# a fresh install runs in, draws its syncing badge with no testID and shows the
# word for five seconds out of every twenty-nine, so the text counts as a
# signal and the window spans several of those pulses.
STATUS=""
for _ in $(seq 1 18); do
  ui_dump || true
  for icon in header.checkicon header.playicon header.wifiicon header.offlineicon; do
    if ui_has "$icon"; then STATUS="$icon"; break; fi
  done
  if [ -z "$STATUS" ] && grep -qE 'text="(Synced|Syncing)"|text="[^"]*[0-9]%"' "$DUMP"; then
    STATUS="sync text"
  fi
  if [ -n "$STATUS" ]; then break; fi
  sleep 5
done
cp "$DUMP" "$OUT/ui-home.xml" 2>/dev/null || true
shot home-screen
echo "  sync indicator: ${STATUS:-none found}"

# Settings -> the server the app actually holds. Scrolls, because the row sits
# below the fold on a phone.
read_server() {
  for _ in 1 2 3 4 5 6; do
    ui_dump || true
    if ui_has "$DEFAULT_HOST"; then return 0; fi
    adb shell input swipe 540 1400 540 600 300
    sleep 2
  done
  return 1
}

open_settings() {
  for _ in 1 2 3; do
    ui_dump || true
    if ui_tap 'header.settings'; then return 0; fi
    adb shell input keyevent KEYCODE_BACK
    sleep 3
  done
  return 1
}

# The options panel stays open after the mode pill is tapped, by design.
close_panel() {
  ui_dump || true
  if ui_tap 'header.drawmenu'; then return 0; fi
  adb shell input keyevent KEYCODE_BACK
  sleep 3
}

SERVER_SEEN=no
if open_settings; then
  if read_server; then SERVER_SEEN=yes; fi
  cp "$DUMP" "$OUT/ui-network.xml" 2>/dev/null || true
  shot network-screen
else
  echo "  note: the settings control was not on screen"
fi

# A fresh install runs in basic mode, whose Settings screen carries only the
# language and the About link: the server row is advanced-mode only. The mode
# pill in the drawer is the way to the screen that names the server.
if [ "$SERVER_SEEN" != "yes" ]; then
  echo "  basic mode hides the server row; switching to advanced mode"
  adb shell input keyevent KEYCODE_BACK
  sleep 3
  ui_dump || true
  if ui_tap 'header.drawmenu'; then
    ui_dump || true
    if ui_tap 'Advanced'; then
      sleep 8
      close_panel
      if open_settings; then
        if read_server; then SERVER_SEEN=yes; fi
        cp "$DUMP" "$OUT/ui-network-advanced.xml" 2>/dev/null || true
        shot network-screen-advanced
      fi
    else
      echo "  note: the mode pill was not on screen"
    fi
  else
    echo "  note: the drawer control was not on screen"
  fi
fi

# The start menu prints the server too, and that is the screen an offline
# fresh install stops on.
if [ "$SERVER_SEEN" != "yes" ] && grep -q "$DEFAULT_HOST" "$OUT/ui-first-screen.xml"; then
  SERVER_SEEN=yes
  echo "  ok the first screen already showed $DEFAULT_SERVER"
fi

# The persisted file is the other witness. A release build is not debuggable,
# so run-as is expected to fail there; the screen dump carries the assertion.
SETTINGS_JSON="$(adb shell run-as "$APP_ID" cat files/settings.json 2>/dev/null | tr -d '\r' || true)"
if [ -n "$SETTINGS_JSON" ]; then
  echo "$SETTINGS_JSON" > "$OUT/settings.json"
  echo "  persisted settings read from the device"
  if echo "$SETTINGS_JSON" | grep -q "$DEFAULT_SERVER"; then
    SERVER_SEEN=yes
    echo "  ok settings.json carries $DEFAULT_SERVER"
  fi
else
  echo "  note: run-as could not read settings.json (the build is not debuggable)"
fi

if [ "$SERVER_SEEN" != "yes" ]; then
  echo "FAIL: a fresh install does not show $DEFAULT_SERVER anywhere." >&2
  echo "      The default lives in app/uris/serverUris.ts; nothing carried it" >&2
  echo "      to the first launch." >&2
  exit 1
fi
echo "ok: a fresh install already holds $DEFAULT_SERVER, with no user action"

# A missing sync state fails the run after the Send check, which reads the
# address parser and needs no sync.
CONNECTION_FAILURE=""
if [ "$SERVER_REACHABLE" = "yes" ]; then
  case "$STATUS" in
    header.checkicon|header.playicon|header.wifiicon|"sync text")
      echo "ok: the app reports a connected state ($STATUS)" ;;
    header.offlineicon)
      CONNECTION_FAILURE="the server answers this runner, and the app says Offline." ;;
    *)
      CONNECTION_FAILURE="the server answers this runner, and the app reports no sync state." ;;
  esac
else
  echo "NOT PROVEN: $DEFAULT_SERVER does not answer this runner (HTTP $HTTP_CODE),"
  echo "            so the connected state was not asserted. The default server"
  echo "            being pre-set on a fresh install was, and it passed."
fi

echo "=== SWARM Mainnet recipients in Send ==="

# The desktop wallet shipped mainnet builds whose Send field refused every
# SWARM Mainnet address. Here the fresh wallet types two mainnet addresses and
# one Zcash address into its own Send field and reads the verdict the screen
# shows, `send.address.check` or `send.address.error`. No amount is entered and
# the wallet holds nothing, so nothing is sent.
MAINNET_UNIFIED="swm1q4q6yr3rvnnqw64tqktf7plq86cnmdxezv2g5wjerfpratclfv87guyfqru4vf775ykqd8q9e7uzscmns7w6q2fpxwl5up0ez5xqe5gv"
MAINNET_TRANSPARENT="s1UsiRFq4FrtHUbHobXxssCN7EVCcu9GvFk"
# Zcash's own encoding of the all-zero key hash. Refusing it shows the check
# can say no.
ZCASH_TRANSPARENT="t1Hsc1LR8yKnbbe3twRp88p6vFfC5t7DLbs"

open_send() {
  for _ in 1 2 3 4 5; do
    ui_dump || true
    if ui_has 'send.addressplaceholder'; then return 0; fi
    if ! ui_tap 'tab.send'; then
      adb shell input keyevent KEYCODE_BACK
      sleep 3
    fi
  done
  ui_dump || true
  ui_has 'send.addressplaceholder'
}

clear_recipient() {
  ui_dump || true
  ui_tap 'send.addressplaceholder' || return 1
  adb shell input keyevent KEYCODE_MOVE_END
  # shellcheck disable=SC2046
  adb shell input keyevent $(printf 'KEYCODE_DEL %.0s' $(seq 1 140))
  sleep 2
}

# Prints the text the Send address field holds in the current dump.
send_field_text() {
  python3 -c 'import sys, xml.etree.ElementTree as ET
for node in ET.parse(sys.argv[1]).getroot().iter("node"):
    if node.get("resource-id") == "send.addressplaceholder":
        print(node.get("text", ""))
        break' "$DUMP"
}

# Types `address` a few characters at a time. The field is a controlled
# input, and a 108-character burst of key events lost 25 of them in run
# 36364054489.
type_address() {
  local address="$1" chunk="$2" i
  for ((i = 0; i < ${#address}; i += chunk)); do
    adb shell input text "${address:i:chunk}"
    sleep 1
  done
}

# Types `address` into the emptied field, checks that the field holds exactly
# that string, and sets VERDICT to what the screen then shows. A prefix of an
# address never passes its checksum, so a check mark is the verdict on the
# whole address. A refusal is read until the window closes, because the
# partial address was refused a moment earlier.
recipient_verdict() {
  local address="$1" label="$2" typed="" chunk
  VERDICT="field not reached"
  for chunk in 6 2; do
    clear_recipient || return 0
    type_address "$address" "$chunk"
    sleep 2
    ui_dump || continue
    typed="$(send_field_text)"
    if [ "$typed" = "$address" ]; then break; fi
  done
  if [ "$typed" != "$address" ]; then
    VERDICT="input mismatch, the field holds '$typed'"
  else
    VERDICT="none shown"
    for _ in $(seq 1 10); do
      if ui_has 'send.address.check'; then VERDICT="accepted"; break; fi
      if ui_has 'send.address.error'; then VERDICT="refused"; fi
      sleep 2
      ui_dump || true
    done
  fi
  cp "$DUMP" "$OUT/ui-send-$label.xml" 2>/dev/null || true
  shot "send-$label"
  echo "  $label $address: $VERDICT" | tee -a "$OUT/send-verdicts.txt"
}

if open_send; then
  shot send-screen
  recipient_verdict "$MAINNET_UNIFIED" mainnet-unified
  UNIFIED_VERDICT="$VERDICT"
  recipient_verdict "$MAINNET_TRANSPARENT" mainnet-transparent
  TRANSPARENT_VERDICT="$VERDICT"
  recipient_verdict "$ZCASH_TRANSPARENT" zcash-transparent
  ZCASH_VERDICT="$VERDICT"
  clear_recipient || true
  adb shell input keyevent KEYCODE_BACK
  sleep 2
  ui_dump || true
  ui_tap 'tab.history' || true

  if [ "$UNIFIED_VERDICT" = "refused" ] || [ "$TRANSPARENT_VERDICT" = "refused" ]; then
    echo "FAIL: the Send field refused a SWARM Mainnet address." >&2
    exit 1
  fi
  if [ "$ZCASH_VERDICT" = "accepted" ]; then
    echo "FAIL: the Send field accepted a Zcash address on SWARM Mainnet." >&2
    exit 1
  fi
  if [ "$UNIFIED_VERDICT" = "accepted" ] && [ "$TRANSPARENT_VERDICT" = "accepted" ] \
     && [ "$ZCASH_VERDICT" = "refused" ]; then
    echo "ok: Send accepts swm1... and s1... and refuses Zcash's t1... on SWARM Mainnet"
  else
    echo "NOT PROVEN: the Send field showed no verdict for every address"
    echo "            (unified: $UNIFIED_VERDICT, transparent: $TRANSPARENT_VERDICT,"
    echo "            zcash: $ZCASH_VERDICT). See $OUT/ui-send-*.xml."
  fi
else
  echo "NOT PROVEN: the Send field was not reached, so no recipient was typed."
  cp "$DUMP" "$OUT/ui-send-unreached.xml" 2>/dev/null || true
  shot send-unreached
fi

if [ -n "$CONNECTION_FAILURE" ]; then
  echo "FAIL: $CONNECTION_FAILURE" >&2
  exit 1
fi

echo "=== SWARM smoke test passed ($LABEL) ==="
