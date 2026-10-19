#!/usr/bin/env bash
# ============================================================
# 截图回归工具 —— 改动前后做视觉对比用
#
#   用法：tools/shot.sh [输出目录] [名称:查询串] ...
#   默认：tools/shots，九机位（配置见下方 VIEWS 默认值）
#   例：  tools/shot.sh tools/baseline/v0.9
#         tools/shot.sh tools/after/v2.1 "corner_dusk:view=corner&time=dusk"
#         tools/shot.sh out "corner:view=corner#5000"      # #后面单独指定该张的虚拟时间预算
#         ROOT=/path/to/old-copy tools/shot.sh out        # 给旧快照目录截图
#
# 依赖：Google Chrome、python3（自起静态服务器）、perl（单张看门狗）
# 注意：必须带 --use-angle=swiftshader --enable-unsafe-swiftshader，
#       且不能加 --disable-gpu，否则 WebGL 上下文创建失败，只剩加载页。
#       同一时刻只允许一个 headless Chrome 在跑（共用 profile 会互相打架，
#       产出“加载页”假图），脚本自己会保证串行。
#
# 可复现：默认追加 ?seed=1（固定 Math.random 种子）。
#   程序化贴图和树木散布都用随机数，不固定种子同一版本连拍
#   差异也有 3%~4%，无法判断是否回归。
#   STILL=1 可额外冻结相机与云层，适合单版本自查。
#
# 重机位：corner（东南角）满屏几何，动画开着时 Chrome 的截图会一直
#   等不到稳定帧（实测 100 s 超时也不出图），冻结后照常：
#     tools/shot.sh out "corner:view=corner&still=1#1500"
#   #后面是该张的虚拟时间预算（ms），默认 20000；重机位给 1500 足够。
#
# 服务器：默认每次自起一个空端口上的新服务器，且必须带
#   --protocol HTTP/1.1。python 默认的 HTTP/1.0 应答会在 Chrome
#   复用连接时被抢断，页面里一半脚本报 ERR_CONNECTION_RESET，
#   截出来是加载页；服务端日志却全是 200，极难排查。
#   REUSE=1 才复用已运行的服务器（那样得自己保证协议版本对）。
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="${ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
OUT="${1:-$ROOT/tools/shots}"
shift || true
SPECS=("$@")
PORT="${PORT:-8931}"
REUSE="${REUSE:-0}"
SIZE="${SIZE:-1600,1000}"
BUDGET="${BUDGET:-6000}"        # 虚拟时间预算（ms）。加载序列（隐藏加载层 + 落位）
                                # 约 1.2 s 虚拟时间就够，留到 6000 足够稳；
                                # 预算越大 = 帧数越多 = 墙钟时间线性增长
                                # （一帧 25~40 ms，6000 ≈ 360 帧 × 40 ms ≈ 15~40 s）
                                # corner 这类满屏几何的机位一帧要 1 秒上下，必须再降，
                                # 规格里写 `#1500`（见文件头示例），而且要配 still=1
WATCHDOG="${WATCHDOG:-170}"     # 单张看门狗（秒），Chrome 偶尔不退出
MIN_BYTES="${MIN_BYTES:-100000}"  # 小于此体积视为加载页：22286 字节是加载页的固定大小
STILL="${STILL:-0}"             # 1 = 冻结相机/云层；与旧基线对比时保持 0
SEED="${SEED:-1}"               # 1 = 固定随机种子（程序化贴图与树木）

if [ "${#SPECS[@]}" -eq 0 ]; then
  for v in overview axis taihe close inner garden shenwu top corner; do
    SPECS+=("$v:view=$v")
  done
fi

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
echo "页面根目录: $ROOT"

# ---------- 静态服务器 ----------
SERVER_PID=""
cleanup() {
  if [ -n "$SERVER_PID" ]; then kill "$SERVER_PID" 2>/dev/null; fi
  pkill -f 'user-data-dir=/tmp/palace-shot-profile' 2>/dev/null
  [ -n "${SRV_LOG:-}" ] && rm -f "$SRV_LOG"
  return 0
}
trap cleanup EXIT

free_port() {
  python3 - "$1" <<'EOF'
import socket, sys
base = int(sys.argv[1])
for p in range(base, base + 60):
    s = socket.socket()
    try:
        s.bind(('127.0.0.1', p))
        print(p)
        break
    except OSError:
        continue
    finally:
        s.close()
EOF
}

if [ "$REUSE" = "1" ] && curl -sf -o /dev/null "http://127.0.0.1:$PORT/index.html"; then
  echo "复用已运行的服务器 http://127.0.0.1:$PORT"
else
  PORT="$(free_port "$PORT")"
  if [ -z "$PORT" ]; then
    echo "找不到可用端口（从 $PORT_BASE 起试了 60 个）" >&2
    exit 1
  fi
  SRV_LOG="$(mktemp -t palace-serve)"
  ( cd "$ROOT" && exec python3 -m http.server "$PORT" --bind 127.0.0.1 --protocol HTTP/1.1 >"$SRV_LOG" 2>&1 ) &
  SERVER_PID=$!
  for _ in $(seq 1 30); do
    curl -sf -o /dev/null "http://127.0.0.1:$PORT/index.html" && break
    sleep 0.2
  done
  if ! curl -sf -o /dev/null "http://127.0.0.1:$PORT/index.html"; then
    echo "服务器没起来（端口 $PORT）：" >&2
    tail -5 "$SRV_LOG" >&2
    exit 1
  fi
  echo "已启动服务器 http://127.0.0.1:$PORT (pid $SERVER_PID)"
fi

# ---------- 预检：先跑一遍看页面有没有报错 ----------
# 有 JS 异常时截图可能照样出图（只是内容残缺），体积闸门拦不住，
# 所以先 dump-dom 一遍，发现错误浮层就提前退出。
# 预检用的仍是同一个 profile、同一个服务器。
rm -rf /tmp/palace-shot-profile   # 干净 profile，避免命中上一次的 JS 缓存
CHECK="${CHECK:-1}"
if [ "$CHECK" = "1" ]; then
  printf '预检页面……'
  tmpdom="$(mktemp -t palace-dom)"
  perl -e 'alarm shift; exec @ARGV' "$WATCHDOG" \
    "$CHROME" \
      --headless=new \
      --use-angle=swiftshader \
      --enable-unsafe-swiftshader \
      --hide-scrollbars \
      --user-data-dir="/tmp/palace-shot-profile" \
      --window-size="$SIZE" \
      --virtual-time-budget=8000 \
      --dump-dom \
      "http://127.0.0.1:$PORT/?seed=1&cb=$(date +%s)" >"$tmpdom" 2>/dev/null
  if grep -q 'id="__err"' "$tmpdom"; then
    echo "页面有 JS 错误，先修再截图："
    python3 - "$tmpdom" <<'EOF'
import re, sys
h = open(sys.argv[1], encoding='utf-8', errors='replace').read()
m = re.search(r'<div[^>]*id="__err"[^>]*>(.*?)</div>', h, re.S)
print((m.group(1) if m else '(没抓到内容)').strip())
EOF
    rm -f "$tmpdom"
    exit 1
  fi
  rm -f "$tmpdom"
  echo "通过"
fi

# ---------- 逐张截图 ----------
QEXTRA=""
[ "$STILL" = "1" ] && QEXTRA="$QEXTRA&still=1"
[ "$SEED" = "1" ] && QEXTRA="$QEXTRA&seed=1"
ok=0
fail=0
for spec in "${SPECS[@]}"; do
  name="${spec%%:*}"
  q="${spec#*:}"
  budget="$BUDGET"
  case "$q" in
    *'#'*) budget="${q##*#}"; q="${q%#*}" ;;
  esac
  f="$OUT/$name.png"
  rm -f "$f"
  printf '  %-14s → %s ... ' "$name" "$(basename "$OUT")/$name.png"
  perl -e 'alarm shift; exec @ARGV' "$WATCHDOG" \
    "$CHROME" \
      --headless=new \
      --use-angle=swiftshader \
      --enable-unsafe-swiftshader \
      --hide-scrollbars \
      --force-device-scale-factor=1 \
      --user-data-dir="/tmp/palace-shot-profile" \
      --window-size="$SIZE" \
      --virtual-time-budget="$budget" \
      --screenshot="$f" \
      "http://127.0.0.1:$PORT/?$q$QEXTRA&cb=$(date +%s)" >/dev/null 2>&1

  bytes=0
  [ -s "$f" ] && bytes=$(wc -c <"$f" | tr -d ' ')
  if [ "$bytes" -ge "$MIN_BYTES" ]; then
    printf 'ok (%s)\n' "$(du -h "$f" | cut -f1 | tr -d ' ')"
    ok=$((ok + 1))
  elif [ "$bytes" -gt 0 ]; then
    printf '失败（%s 字节，疑似加载页）\n' "$bytes"
    fail=$((fail + 1))
  else
    printf '失败（没出文件，看门狗 %ss 超时）\n' "$WATCHDOG"
    fail=$((fail + 1))
  fi
done

echo "完成：$ok 张成功，$fail 张失败 → $OUT"
[ "$fail" -eq 0 ]
