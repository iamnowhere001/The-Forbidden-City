#!/usr/bin/env bash
# ============================================================
# 探针 —— 在无头 Chrome 里跑 tools/probe.html 的断言
#
#   tools/probe.sh pick
#   tools/probe.sh stats
#   tools/probe.sh bounds
#
# 输出直接是探针写进 DOM 的文本。依赖 Chrome + python3。
# ============================================================
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CASE="${1:-pick}"
CASE_Q="${2:-}"
WATCHDOG="${WATCHDOG:-120}"
SIZE="${SIZE:-1280,800}"

for c in \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Chromium.app/Contents/MacOS/Chromium"
do
  [ -x "$c" ] && CHROME="$c" && break
done
[ -z "${CHROME:-}" ] && { echo "找不到 Chrome" >&2; exit 1; }

PORT="$(python3 - <<'EOF'
import socket
for p in range(8960, 9040):
    s = socket.socket()
    try:
        s.bind(('127.0.0.1', p)); print(p); break
    except OSError:
        continue
    finally:
        s.close()
EOF
)"
( cd "$ROOT" && exec python3 -m http.server "$PORT" --bind 127.0.0.1 --protocol HTTP/1.1 >/dev/null 2>&1 ) &
SRV=$!
trap 'kill $SRV 2>/dev/null; pkill -f "user-data-dir=/tmp/palace-probe" 2>/dev/null' EXIT
for _ in $(seq 1 40); do
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/index.html" && break
  sleep 0.2
done

rm -rf /tmp/palace-probe
perl -e 'alarm shift; exec @ARGV' "$WATCHDOG" \
  "$CHROME" --headless=new --use-angle=metal --no-sandbox \
  --hide-scrollbars --force-device-scale-factor=1 \
  --user-data-dir=/tmp/palace-probe \
  --window-size="$SIZE" \
  --virtual-time-budget=60000 \
  --dump-dom \
  "http://127.0.0.1:$PORT/tools/probe.html?case=$CASE&$CASE_Q&cb=$(date +%s)" 2>/dev/null \
| python3 -c '
import sys, re, html
h = sys.stdin.read()
m = re.search(r"<pre id=\"out\">(.*?)</pre>", h, re.S)
print(html.unescape(m.group(1)) if m else "(没抓到输出)")
'
