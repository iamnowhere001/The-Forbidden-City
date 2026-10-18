#!/usr/bin/env bash
# ============================================================
# 九机位截图 —— 改动前后做视觉回归用
#
#   用法：tools/shot.sh [输出目录]
#   默认：tools/shots
#   例：  tools/shot.sh tools/baseline/v0.9
#
# 依赖：Google Chrome、python3（起静态服务器）、perl（看门狗）
# 注意：必须带 --use-angle=swiftshader --enable-unsafe-swiftshader，
#       且不能加 --disable-gpu，否则 WebGL 上下文创建失败，只剩加载页。
#
# 可复现：默认追加 ?seed=1（固定 Math.random 种子）。
#   程序化贴图和树木散布都用随机数，不固定种子同一版本连拍
#   差异也有 3%~4%，无法判断是否回归。
#   STILL=1 可额外冻结相机与云层，适合单版本自查。
# ============================================================
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/tools/shots}"
PORT="${PORT:-8931}"
SIZE="${SIZE:-1600,1000}"
BUDGET="${BUDGET:-20000}"     # 虚拟时间预算（ms），软件渲染需要给足
WATCHDOG="${WATCHDOG:-170}"   # 单张看门狗（秒），Chrome 偶尔不退出

VIEWS="${VIEWS:-overview axis taihe close inner garden shenwu top corner}"
STILL="${STILL:-0}"           # 1 = 冻结相机/云层；与旧基线对比时保持 0
SEED="${SEED:-1}"             # 1 = 固定随机种子（程序化贴图与树木）

mkdir -p "$OUT"

# ---------- 定位 Chrome（本机可能装在非标准路径） ----------
if [ -z "${CHROME:-}" ]; then
  for c in \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
  do
    [ -x "$c" ] && CHROME="$c" && break
  done
fi

if [ -z "${CHROME:-}" ] || [ ! -x "$CHROME" ]; then
  echo "找不到 Chrome，可用 CHROME=/path/to/chrome 指定" >&2
  exit 1
fi
echo "Chrome: $CHROME"

# ---------- 静态服务器 ----------
SERVER_PID=""
if curl -sf -o /dev/null "http://127.0.0.1:$PORT/index.html"; then
  echo "复用已运行的服务器 http://127.0.0.1:$PORT"
else
  ( cd "$ROOT" && python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 ) &
  SERVER_PID=$!
  trap '[ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null' EXIT
  for _ in $(seq 1 20); do
    curl -sf -o /dev/null "http://127.0.0.1:$PORT/index.html" && break
    sleep 0.2
  done
  echo "已启动服务器 http://127.0.0.1:$PORT (pid $SERVER_PID)"
fi

# ---------- 逐机位截图 ----------
rm -rf /tmp/palace-shot-profile   # 干净 profile，避免命中上一次的 JS 缓存
QEXTRA=""
[ "$STILL" = "1" ] && QEXTRA="$QEXTRA&still=1"
[ "$SEED" = "1" ] && QEXTRA="$QEXTRA&seed=1"
ok=0
fail=0
for v in $VIEWS; do
  f="$OUT/$v.png"
  rm -f "$f"
  printf '  %-9s → %s ... ' "$v" "$(basename "$OUT")/$v.png"
  perl -e 'alarm shift; exec @ARGV' "$WATCHDOG" \
    "$CHROME" \
      --headless=new \
      --use-angle=swiftshader \
      --enable-unsafe-swiftshader \
      --hide-scrollbars \
      --force-device-scale-factor=1 \
      --user-data-dir="/tmp/palace-shot-profile" \
      --window-size="$SIZE" \
      --virtual-time-budget="$BUDGET" \
      --screenshot="$f" \
      "http://127.0.0.1:$PORT/?view=$v$QEXTRA&cb=$(date +%s)" >/dev/null 2>&1

  if [ -s "$f" ]; then
    printf 'ok (%s)\n' "$(du -h "$f" | cut -f1 | tr -d ' ')"
    ok=$((ok + 1))
  else
    printf '失败\n'
    fail=$((fail + 1))
  fi
done

echo "完成：$ok 张成功，$fail 张失败 → $OUT"
[ "$fail" -eq 0 ]
