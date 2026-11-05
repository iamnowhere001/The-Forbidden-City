/* ============================================================
   无障碍播报
   画布是 WebGL，屏幕阅读器读不到里面有什么。这里维护两块纯文本：
     #a11y-status  aria-live=polite，只在状态变化时播报一次
     #scene-alt    画布内容摘要（机位 / 可见标注 / 选中建筑），不自动播报
   两者都是 .sr-only，视觉上不占画面，也不进截图。
   ============================================================ */
(function () {
  const GG = (window.GG = window.GG || {});

  let statusEl = null;
  let altEl = null;
  let lastMsg = '';
  let altFlip = false;

  function status() {
    if (!statusEl) statusEl = document.getElementById('a11y-status');
    return statusEl;
  }
  function alt() {
    if (!altEl) altEl = document.getElementById('scene-alt');
    return altEl;
  }

  /** 同一条消息连续出现时补一个零宽空格，保证 aria-live 会再播一次 */
  function announce(msg) {
    const el = status();
    if (!el || !msg) return;
    const text = msg === lastMsg
      ? msg + (altFlip ? '\u200b' : '')
      : msg;
    altFlip = !altFlip;
    lastMsg = msg;
    el.textContent = text;
  }

  /** 摘要变化才写 DOM，避免每帧触发可访问性树的重算 */
  function sceneAlt(text) {
    const el = alt();
    if (el && el.textContent !== text) el.textContent = text;
  }

  GG.a11y = { announce, sceneAlt };
})();
