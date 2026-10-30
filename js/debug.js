/* ============================================================
   调试与诊断
   1) 运行时错误浮层：尽早安装，抓脚本加载阶段的异常
   2) URL 参数解析：?exposure= ?sunmul= 等
   ============================================================ */
(function () {
  const GG = (window.GG = window.GG || {});

  /* ---------- 错误浮层 ---------- */
  GG.errors = GG.errors || [];

  GG.installErrorOverlay = function () {
    if (GG._overlayInstalled) return;
    GG._overlayInstalled = true;

    function show(msg) {
      GG.errors.push(msg);
      let d = document.getElementById('__err');
      if (!d) {
        d = document.createElement('div');
        d.id = '__err';
        d.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#8b1a10;color:#fff;font:12px/1.6 monospace;padding:10px;white-space:pre-wrap';
        (document.body || document.documentElement).appendChild(d);
      }
      d.textContent = GG.errors.join('\n');
    }

    window.addEventListener('error', function (e) {
      show((e.message || '') + '  @ ' + String(e.filename || '').split('/').pop() + ':' + e.lineno);
    }, true);

    /* 布局是 async 管线，抛在 await 里的异常不会触发 window.onerror，
       只会变成 unhandledrejection —— 不接这一层，页面会安静地停在加载层。 */
    window.addEventListener('unhandledrejection', function (e) {
      const r = e.reason;
      show('unhandledrejection: ' + ((r && (r.stack || r.message)) || r));
    });
  };

  GG.installErrorOverlay();

  /* ---------- URL 参数 ---------- */
  GG.query = new URLSearchParams(location.search);

  /* ?seed=1：把 Math.random 换成固定种子的 LCG。
     程序化贴图与树木散布都用了随机数，不固定种子截图无法复现。
     只在调试参数下生效，正常运行不受影响。 */
  if (GG.query.get('seed') === '1') {
    let s = 20261018;
    window.__rng = 0;
    window.__marks = [];
    window.__mark = function (l) { window.__marks.push([l, window.__rng]); };
    window.__cap = false; window.__stacks = [];
    Math.random = function () {
      window.__rng++;
      if (window.__cap && window.__stacks.length < 3) {
        window.__stacks.push(new Error().stack.split('\n').slice(1, 5).join(' | '));
      }
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  GG.debug = {
    exposure: parseFloat(GG.query.get('exposure')) || 1,
    sunMul: parseFloat(GG.query.get('sunmul')) || 1
  };
})();
