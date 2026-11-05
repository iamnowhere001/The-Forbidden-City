#!/usr/bin/env node
/* ============================================================
   帧率基线（B16 / A2）
   不用 --virtual-time-budget：虚拟时钟下 rAF 与 performance.now()
   一起被加速，采样出的「fps」是假的。这里用 CDP 连一个真实运行的
   headless Chrome，在页面内部按墙钟采样 6 秒 rAF，再读 renderer.info。

   口径固定：ANGLE Metal、CDP 强制 viewport 1600x1000 / dpr 1、
   seed=1、nofade=1、time=noon、still=1（冻结动画并禁用动态分辨率）
   与 resolutionScale=1.0，机位 capital 与 overview 各一次。

   **以 WINDOWED=1 的可见窗口读数为准**：headless 下 Chrome 可能把
   rAF 空转成恒定 60fps，那一档只用来核对 calls / tris，不用于帧率判定。
   详见 docs/dev-tooling.md。

   用法：node tools/fps-bench.js                 # headless 工程基线
         WINDOWED=1 node tools/fps-bench.js    # 可见 Chrome 窗口，前台用户可见帧率
   输出：tools/baseline/fps-v2.4[.windowed].json + 控制台表格
   ============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const WINDOWED = process.env.WINDOWED === '1';
const OUT = path.join(ROOT, 'tools/baseline/fps-v2.4' + (WINDOWED ? '.windowed' : '') + '.json');
const CHROME = '/Applications/Chrome.app/Contents/MacOS/Google Chrome';
const PROFILE = '/tmp/palace-fps-bench-profile' + (WINDOWED ? '-win' : '');
const VIEWS = (process.env.VIEWS || 'capital,overview').split(',');
const SAMPLE_MS = 6000;
const WARMUP_MS = 1800;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.json': 'application/json', '.svg': 'image/svg+xml'
};

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}

function serve(port) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.resolve(ROOT, rel || 'index.html');
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404).end(); return; }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      res.end(buf);
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

/* 最小 CDP 客户端：只用到 Runtime.evaluate，够用即可 */
function cdp(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const pending = new Map();
    let nextId = 1;
    ws.onopen = () => {
      resolve({
        send(method, params) {
          const id = nextId++;
          return new Promise((ok, fail) => {
            pending.set(id, { ok, fail });
            ws.send(JSON.stringify({ id, method, params: params || {} }));
          });
        },
        close() { ws.close(); }
      });
    };
    ws.onerror = (e) => reject(new Error('CDP WebSocket: ' + (e.message || 'error')));
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (!msg.id || !pending.has(msg.id)) return;
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.fail(new Error(msg.error.message));
      else p.ok(msg.result);
    };
  });
}

async function evaluate(client, expression, awaitPromise) {
  const r = await client.send('Runtime.evaluate', {
    expression, awaitPromise: !!awaitPromise, returnByValue: true
  });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception || {}).description);
  }
  return r.result.value;
}

async function waitFor(client, expression, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const ok = await evaluate(client, expression);
    if (ok) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('等待超时: ' + expression);
}

const BENCH = `(async () => {
  const dts = [];
  const resStart = window.__dbg.stage.resolutionScale();
  const t0 = performance.now();
  let last = t0;
  await new Promise((resolve) => {
    const step = (now) => {
      dts.push(now - last);
      last = now;
      if (now - t0 < ${SAMPLE_MS}) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
  const d = window.__dbg;
  const info = d.stage.renderer.info;
  return {
    frames: dts.length,
    dts,
    calls: info.render.calls,
    tris: info.render.triangles,
    resStart,
    resEnd: d.stage.resolutionScale(),
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio,
    gpu: (window.GG.debug && window.GG.debug.gpu) || 'unknown',
    view: new URLSearchParams(location.search).get('view') || '(default)'
  };
})()`;

function stats(all) {
  /* >200ms 的间隔是窗口失焦 / 系统挂起导致 rAF 停摆，不是渲染慢。
     前台窗口偶发，留着会把平均 fps 拉到个位数（实测过 3.4fps，p90 却只有 34ms）。 */
  const pauses = all.filter((d) => d > 200);
  const sorted = all.filter((d) => d <= 200).sort((a, b) => a - b);
  if (!sorted.length) throw new Error('采样期间没有有效帧');
  const sum = sorted.reduce((a, b) => a + b, 0);
  const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  const slow = sorted.slice(Math.floor(sorted.length * 0.9));
  return {
    frames: sorted.length,
    pauses: pauses.length,
    maxPauseMs: pauses.length ? +Math.max(...pauses).toFixed(1) : 0,
    avgMs: +(sum / sorted.length).toFixed(2),
    fps: +(1000 / (sum / sorted.length)).toFixed(1),
    p50Ms: +at(0.5).toFixed(2),
    p90Ms: +at(0.9).toFixed(2),
    worst10Fps: +(1000 / (slow.reduce((a, b) => a + b, 0) / slow.length)).toFixed(1),
    maxMs: +sorted[sorted.length - 1].toFixed(2)
  };
}

(async () => {
  const httpPort = await freePort();
  const dbgPort = await freePort();
  const server = await serve(httpPort);
  fs.rmSync(PROFILE, { recursive: true, force: true });

  const args = [
    ...(WINDOWED
      ? ['--no-first-run', '--no-default-browser-check']
      : ['--headless=new', '--hide-scrollbars',
         '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
         '--disable-backgrounding-occluded-windows']),
    '--use-angle=metal', '--no-sandbox', '--remote-allow-origins=*',
    '--force-device-scale-factor=1', '--window-size=1600,1000',
    '--user-data-dir=' + PROFILE,
    '--remote-debugging-port=' + dbgPort,
    'http://127.0.0.1:' + httpPort + '/index.html?seed=1&nofade=1&time=noon&still=1&view=' + VIEWS[0]
  ];
  const chrome = spawn(CHROME, args, { stdio: 'ignore' });
  let client = null;

  try {
    /* 等 CDP 端点起来，再拿到页面 target */
    let target = null;
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      try {
        const list = await (await fetch('http://127.0.0.1:' + dbgPort + '/json/list')).json();
        target = list.find((x) => x.type === 'page' && x.url.includes('index.html'));
        if (target) break;
      } catch (e) { /* Chrome 还没监听 */ }
      await new Promise((r) => setTimeout(r, 200));
    }
    if (!target) throw new Error('找不到页面 target，CDP 未就绪');

    client = await cdp(target.webSocketDebuggerUrl);
    await client.send('Runtime.enable');
    /* 可见窗口会被屏幕尺寸与浏览器 UI 挤小，两次运行 viewport 可能不同；
       强制成固定值，前后对照才有意义（也与截图基线的 1600x1000 对齐）。 */
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false
    });
    await waitFor(client, '!!(window.__dbg && window.__dbg.registry && window.__dbg.registry.length)', 90000);
    console.log('页面就绪，开始采样（真实墙钟，不用虚拟时间）…');

    const results = {};
    for (const view of VIEWS) {
      await evaluate(client, `window.__dbg.views.applyInstant(${JSON.stringify(view)})`);
      /* still=1 已冻结 DRS，这里再显式钉住全分辨率，避免历史状态影响口径 */
      await evaluate(client, 'window.__dbg.stage.setResolutionScale(1)');
      await new Promise((r) => setTimeout(r, WARMUP_MS));   // 让阴影视锥与着色器编译稳定
      const raw = await evaluate(client, BENCH, true);
      results[view] = Object.assign(stats(raw.dts), {
        capturedAt: new Date().toISOString(),
        calls: raw.calls, tris: raw.tris,
        resStart: +raw.resStart.toFixed(2), resEnd: +raw.resEnd.toFixed(2),
        width: raw.width, height: raw.height, dpr: raw.dpr, gpu: raw.gpu
      });
      const r = results[view];
      if (r.resStart !== 1 || r.resEnd !== 1) {
        console.warn(`  ! ${view} 分辨率发生漂移 ${r.resStart} → ${r.resEnd}，本轮数据不可用于对照`);
      }
      console.log(`${view.padEnd(9)} fps ${String(r.fps).padStart(5)}  avg ${r.avgMs}ms  p90 ${r.p90Ms}ms  最差10% ${r.worst10Fps}fps  draw ${r.calls}  tri ${r.tris}  res ${r.resStart}→${r.resEnd}  暂停 ${r.pauses} 次`);
      if (!WINDOWED && r.p90Ms <= 17.5) {
        console.warn('  ! 几乎全部帧 ≤17ms，疑似 headless rAF 空转；这一档只核对 calls / tris，不做帧率基线');
      }
    }

    const chromeVersion = (await (await fetch('http://127.0.0.1:' + dbgPort + '/json/version')).json())['Browser'];
    /* 可见窗口一次只测一个机位更稳；新结果合并进同模式文件，每个机位自带时间戳 */
    let prior = {};
    try { prior = JSON.parse(fs.readFileSync(OUT, 'utf8')).views || {}; } catch (e) { /* 首次运行 */ }
    const views = Object.assign({}, prior, results);
    const payload = {
      version: 'v2.4',
      capturedAt: new Date().toISOString(),
      method: 'CDP Runtime.evaluate + 页面内 rAF 真实墙钟采样（无 virtual-time-budget）',
      environment: {
        browser: chromeVersion, backend: 'ANGLE Metal', headless: !WINDOWED,
        window: WINDOWED ? '可见 Chrome 窗口（前台）' : 'headless=new',
        viewport: results[VIEWS[0]].width + 'x' + results[VIEWS[0]].height,
        deviceScaleFactor: 1,
        cpu: 'Apple M4', gpu: results[VIEWS[0]].gpu
      },
      query: 'seed=1&nofade=1&time=noon&still=1',
      resolutionScale: 1.0,
      sampleMs: SAMPLE_MS,
      warmupMs: WARMUP_MS,
      caveat: WINDOWED
        ? '可见 Chrome 窗口前台采样，最接近用户可见帧率；窗口尺寸受系统栏影响，viewport 以 environment.viewport 为准。每个机位单独采样，见各自 capturedAt。'
        : 'headless 真实墙钟采样，rAF 被 vsync 量化（约 16.7 / 33.3 ms），只用于同环境前后对照；不等同于前台窗口的用户可见帧率。',
      views
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');
    console.log('已写入 ' + path.relative(ROOT, OUT));
  } finally {
    if (client) client.close();
    chrome.kill('SIGTERM');
    server.close();
    /* Chrome 退出是异步的，profile 目录此刻可能仍被子进程占用；
       清理失败不该让一次成功的采样变成非零退出。 */
    try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) { /* 下次启动会覆盖 */ }
  }
})().catch((e) => {
  console.error('fps-bench 失败：' + e.message);
  process.exitCode = 1;
});
