/* ============================================================
   探索清单
   判定完全复用「已阅」：打开词条即算到过，不另存一份进度。
   完成时给一次金色提示，提示是否弹过记在 localStorage，
   关闭后不再出现，也不做连续打卡。
   ============================================================ */
(function () {
  const GG = (window.GG = window.GG || {});
  const DONE_KEY = 'gg-quest-done';

  function loadDone() {
    try {
      const arr = JSON.parse(localStorage.getItem(DONE_KEY) || '[]');
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) {
      return new Set();
    }
  }

  function saveDone(set) {
    try {
      localStorage.setItem(DONE_KEY, JSON.stringify([...set]));
    } catch (e) { /* file:// 或隐私模式下忽略 */ }
  }

  /** 纯函数：清单进度。断言脚本直接调它，不依赖 DOM。 */
  function progress(group, hasVisited) {
    const names = group.items.map((k) => (GG.INFO[k] || {}).name).filter(Boolean);
    const done = names.filter((n) => hasVisited(n)).length;
    return { total: names.length, done, complete: names.length > 0 && done === names.length };
  }

  function Quests(opts) {
    this.hasVisited = opts.hasVisited || function () { return false; };
    this.findEntry = opts.findEntry || function () {};
    this.onFocus = opts.onFocus || function () {};
    this.groups = (GG.QUESTS && GG.QUESTS.groups) || [];
    this.doneShown = loadDone();

    this.root = document.getElementById('quests');
    this.btn = document.getElementById('btn-quests');
    this.introEl = document.getElementById('quests-intro');
    this.groupsEl = document.getElementById('quests-groups');
    this.footEl = document.getElementById('quests-foot');
    this.toastEl = document.getElementById('quest-toast');
    this.toastText = document.getElementById('quest-toast-text');

    document.getElementById('quest-close').addEventListener('click', () => this.close());
    document.getElementById('quest-toast-close').addEventListener('click', () => {
      if (this.toastEl) this.toastEl.hidden = true;
    });
    if (this.btn) {
      this.btn.addEventListener('click', () => this.toggle());
      this.btn.setAttribute('aria-expanded', 'false');
    }

    document.addEventListener('gg:visited', () => this.refresh());
    document.addEventListener('gg:lang', () => this.build());

    this.build();
  }

  Quests.progress = progress;

  Quests.prototype.isOpen = function () {
    return !!this.root && !this.root.hidden;
  };

  Quests.prototype.toggle = function () {
    if (this.isOpen()) this.close();
    else this.open();
  };

  Quests.prototype.open = function () {
    if (!this.root) return;
    this.root.hidden = false;
    document.body.classList.add('quests-on');
    if (this.btn) {
      this.btn.classList.add('active');
      this.btn.setAttribute('aria-expanded', 'true');
      this.btn.setAttribute('aria-pressed', 'true');
    }
    this.build();
  };

  Quests.prototype.close = function () {
    if (!this.root) return;
    this.root.hidden = true;
    document.body.classList.remove('quests-on');
    if (this.btn) {
      this.btn.classList.remove('active');
      this.btn.setAttribute('aria-expanded', 'false');
      this.btn.setAttribute('aria-pressed', 'false');
    }
  };

  /** 从数据生成三组清单，不写死条目 */
  Quests.prototype.build = function () {
    if (!this.groupsEl || !this.introEl) return;
    const lang = GG.i18n.lang;
    const t = (o) => (o && (lang === 'en' ? o.en : o.zh)) || '';
    this.introEl.textContent = t(GG.QUESTS.intro);
    this.footEl.textContent = t(GG.QUESTS.footnote);

    let html = '';
    for (const g of this.groups) {
      const p = progress(g, this.hasVisited);
      const badge = p.complete
        ? `<span class="q-done">✓ ${GG.i18n.t('已完成', 'Complete')}</span>`
        : `<span class="q-count">${p.done} / ${p.total}</span>`;
      html += `<div class="q-group${p.complete ? ' complete' : ''}" data-group="${g.id}">` +
        `<div class="q-head"><h4>${esc(t(g.title))}</h4>${badge}</div>` +
        `<p class="q-hint">${esc(t(g.hint))}</p><div class="q-items">`;
      for (const key of g.items) {
        const info = GG.INFO[key];
        if (!info) continue;
        const visited = this.hasVisited(info.name);
        const label = lang === 'en' ? (info.en || info.name) : info.name;
        html += `<button type="button" class="q-item${visited ? ' visited' : ''}"` +
          ` data-key="${key}" aria-pressed="${visited}"` +
          ` title="${esc(info.name)}">` +
          `<span class="q-tick">${visited ? '✓' : '○'}</span>${esc(label)}</button>`;
      }
      html += '</div></div>';
    }
    this.groupsEl.innerHTML = html;

    this.groupsEl.querySelectorAll('.q-item').forEach((b) => {
      b.addEventListener('click', () => {
        const info = GG.INFO[b.dataset.key];
        const entry = info && this.findEntry(info.name);
        if (entry) this.onFocus(entry);
      });
    });
  };

  /** 词条打开后就地刷新勾选，不重建 DOM（否则键盘焦点会丢） */
  Quests.prototype.refresh = function () {
    const lang = GG.i18n.lang;
    for (const g of this.groups) {
      const p = progress(g, this.hasVisited);
      const box = this.groupsEl && this.groupsEl.querySelector(`.q-group[data-group="${g.id}"]`);
      if (box) {
        box.classList.toggle('complete', p.complete);
        const badge = box.querySelector('.q-count, .q-done');
        if (badge) {
          if (p.complete) {
            badge.className = 'q-done';
            badge.textContent = '✓ ' + GG.i18n.t('已完成', 'Complete');
          } else {
            badge.className = 'q-count';
            badge.textContent = p.done + ' / ' + p.total;
          }
        }
        for (const b of box.querySelectorAll('.q-item')) {
          const info = GG.INFO[b.dataset.key];
          if (!info) continue;
          const v = this.hasVisited(info.name);
          b.classList.toggle('visited', v);
          b.setAttribute('aria-pressed', String(v));
          const tick = b.querySelector('.q-tick');
          if (tick) tick.textContent = v ? '✓' : '○';
        }
      }
      if (!p.complete || this.doneShown.has(g.id) || !this.toastEl) continue;
      /* 一组只弹一次：写进 localStorage，关闭按钮也只隐藏当前这一条 */
      this.doneShown.add(g.id);
      saveDone(this.doneShown);
      this.toastText.textContent = (lang === 'en' ? g.done.en : g.done.zh) || '';
      this.toastEl.hidden = false;
      break;
    }
  };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
    ));
  }

  GG.Quests = Quests;
})();
