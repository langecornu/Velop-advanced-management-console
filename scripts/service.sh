#!/bin/sh
# Runs the console in the background on macOS with launchd: it starts at login and restarts if it crashes.
# Usage: scripts/service.sh install | uninstall | restart | status | logs
set -eu

LABEL="com.velop-console"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/velop-console.log"
DOMAIN="gui/$(id -u)"

install_service() {
  NODE="$(command -v node || true)"
  if [ -z "$NODE" ]; then
    echo "node not found on PATH" >&2
    exit 1
  fi
  if [ ! -f "$ROOT/.env" ]; then
    echo "Missing $ROOT/.env (copy .env.example and fill it in first)" >&2
    exit 1
  fi
  if [ ! -f "$ROOT/client/dist/index.html" ]; then
    echo "Building the client first..."
    (cd "$ROOT" && npm run build)
  fi
  mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
  cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>server/index.js</string>
  </array>
  <key>WorkingDirectory</key><string>$ROOT</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key><false/>
  </dict>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  launchctl bootstrap "$DOMAIN" "$PLIST"
  echo "Installed. It now starts at login. Logs: $LOG"
}

case "${1:-}" in
  install) install_service ;;
  uninstall)
    launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
    rm -f "$PLIST"
    echo "Removed."
    ;;
  restart) launchctl kickstart -k "$DOMAIN/$LABEL" ;;
  status) launchctl print "$DOMAIN/$LABEL" | grep -E "state|pid|last exit" ;;
  logs) tail -n 50 -f "$LOG" ;;
  *)
    echo "Usage: $0 install | uninstall | restart | status | logs" >&2
    exit 1
    ;;
esac
