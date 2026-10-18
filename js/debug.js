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

    window.addEventListener('error', function (e) {
      GG.errors.push((e.message || '') + '  @ ' + String(e.filename || '').split('/').pop() + ':' + e.lineno);
      let d = document.getElementById('__err');
      if (!d) {
        d = document.createElement('div');
        d.id = '__err';
        d.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#8b1a10;color:#fff;font:12px/1.6 monospace;padding:10px;white-space:pre-wrap';
        (document.body || document.documentElement).appendChild(d);
      }
      d.textContent = GG.errors.join('\n');
    }, true);
  };

  GG.installErrorOverlay();

  /* ---------- URL 参数 ---------- */
  GG.query = new URLSearchParams(location.search);

  /* ?seed=1：把 Math.random 换成固定种子的 LCG。
     程序化贴图与树木散布都用了随机数，不固定种子截图无法复现。
     只在调试参数下生效，正常运行不受影响。 */
  if (GG.query.get('seed') === '1') {
    let s = 20261018;
    Math.random = function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  GG.debug = {
    exposure: parseFloat(GG.query.get('exposure')) || 1,
    sunMul: parseFloat(GG.query.get('sunmul')) || 1
  };
})();
