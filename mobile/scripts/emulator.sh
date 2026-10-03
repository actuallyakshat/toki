#!/usr/bin/env bash
# Boots an emulator and opens Toki in it.
#
#   ./scripts/emulator.sh            Android emulator (iOS Simulator on macOS if no Android SDK is found)
#   ./scripts/emulator.sh android    Android emulator
#   ./scripts/emulator.sh ios        iOS Simulator (macOS only)
#   ./scripts/emulator.sh --backend  also start Postgres and the Go API (needs Docker and Go)
#
# Pick a specific Android emulator with TOKI_AVD=<name> (list them with `emulator -list-avds`),
# or a specific simulator with TOKI_SIMULATOR="iPhone 16".
# The app talks to the API on http://localhost:8080; point it elsewhere with EXPO_PUBLIC_API_URL.
set -euo pipefail

mobile="$(cd "$(dirname "$0")/.." && pwd)"
root="$(cd "$mobile/.." && pwd)"

platform=""
backend=false
for arg in "$@"; do
  case "$arg" in
    android | ios) platform="$arg" ;;
    --backend) backend=true ;;
    -h | --help)
      sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (try --help)" >&2
      exit 1
      ;;
  esac
done

say() { printf '\033[1m▸ %s\033[0m\n' "$*"; }
fail() {
  printf '\033[31m✗ %s\033[0m\n' "$*" >&2
  exit 1
}

# --- Android SDK ---------------------------------------------------------------

find_sdk() {
  for dir in "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}" "$HOME/Library/Android/sdk" "$HOME/Android/Sdk" "${LOCALAPPDATA:-}/Android/Sdk"; do
    if [ -n "$dir" ] && [ -d "$dir/emulator" ]; then
      echo "$dir"
      return
    fi
  done
}

sdk="$(find_sdk || true)"
if [ -z "$platform" ]; then
  if [ -n "$sdk" ]; then
    platform=android
  elif [ "$(uname)" = "Darwin" ]; then
    platform=ios
  else
    fail "No Android SDK found. Install Android Studio, create an emulator in Device Manager, or set ANDROID_HOME."
  fi
fi

# --- Optional backend ------------------------------------------------------------

api_url="${EXPO_PUBLIC_API_URL:-http://localhost:8080}"
pids=()
cleanup() {
  for pid in "${pids[@]:-}"; do
    [ -n "$pid" ] && kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

if $backend; then
  say "Starting Postgres and the Toki API"
  docker compose -f "$root/docker-compose.yml" up -d --wait
  set -m
  (cd "$root/server" && go run ./cmd/toki 2>&1 | sed -u 's/^/[api] /') &
  pids+=($!)
  set +m
  for _ in $(seq 1 60); do
    curl -fsS "$api_url/api/healthz" >/dev/null 2>&1 && break
    sleep 1
  done
fi

if ! curl -fsS --max-time 2 "$api_url/api/healthz" >/dev/null 2>&1; then
  echo "  Note: no Toki API answered at $api_url. Run ../dev.sh in another terminal, or pass --backend."
  echo "  (You can also sign in against another server from the app's sign-in screen.)"
fi

# --- Dependencies ------------------------------------------------------------------

if [ ! -d "$mobile/node_modules" ]; then
  say "Installing app dependencies"
  (cd "$mobile" && npm install)
fi

# --- Boot the device -----------------------------------------------------------------

boot_android() {
  local emulator="$sdk/emulator/emulator" adb="$sdk/platform-tools/adb"
  [ -x "$adb" ] || fail "adb not found in $sdk/platform-tools. Install Android SDK Platform-Tools in Android Studio."
  export PATH="$sdk/platform-tools:$sdk/emulator:$PATH"

  if "$adb" devices | grep -qE "^emulator-[0-9]+\s+device"; then
    say "Using the Android emulator that is already running"
  else
    local avd="${TOKI_AVD:-$("$emulator" -list-avds | head -n 1)}"
    [ -n "$avd" ] || fail "No Android emulators found. Create one in Android Studio → Device Manager."
    say "Booting Android emulator: $avd"
    nohup "$emulator" -avd "$avd" -netdelay none -netspeed full >/dev/null 2>&1 &
    "$adb" wait-for-device
    printf '  waiting for Android to finish booting'
    until [ "$("$adb" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
      printf '.'
      sleep 2
    done
    echo
  fi
  # The emulator's own localhost is not your computer; forward the API port so localhost:8080 works.
  "$adb" reverse tcp:8080 tcp:8080 >/dev/null 2>&1 || true
}

boot_ios() {
  [ "$(uname)" = "Darwin" ] || fail "The iOS Simulator needs macOS. Use: ./scripts/emulator.sh android"
  command -v xcrun >/dev/null || fail "Xcode is not installed. Install it from the App Store, then run: xcode-select --install"
  if xcrun simctl list devices booted | grep -q "(Booted)"; then
    say "Using the iOS Simulator that is already running"
  else
    local device="${TOKI_SIMULATOR:-$(xcrun simctl list devices available | grep -E '^\s+iPhone' | head -n 1 | sed -E 's/^ +(.*) \([0-9A-F-]+\).*/\1/')}"
    [ -n "$device" ] || fail "No iPhone simulators found. Add one in Xcode → Window → Devices and Simulators."
    say "Booting iOS Simulator: $device"
    xcrun simctl boot "$device"
  fi
  open -a Simulator
}

"boot_$platform"

# --- Open the app ----------------------------------------------------------------------

if [ "$platform" = ios ]; then say "Opening Toki in the iOS Simulator"; else say "Opening Toki in the Android emulator"; fi
cd "$mobile"
# Expo installs Expo Go on the device if needed and opens the app; Ctrl+C stops everything.
EXPO_PUBLIC_API_URL="$api_url" npx expo start "--$platform"
