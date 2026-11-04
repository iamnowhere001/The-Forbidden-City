/* ============================================================
   朝代对比
   只在文字层切换：面板说明 + 信息卡里的一段差异注记。
   几何、词条、标签都不动，所以不存在「复原动画」的误导。
   ============================================================ */
(function () {
  const GG = (window.GG = window.GG || {});

  function Eras(opts) {
    this.findEntry = opts.findEntry || function () {};
    this.onFocus = opts.onFocus || function () {};
    this.onChange = opts.onChange || function () {};
    this.data = GG.ERAS;
    this.id = this.data.initial;

    this.root = document.getElementById('era');
    this.btn = document.getElementById('btn-era');
    this.tabsEl = document.getElementById('era-tabs');
    this.summaryEl = document.getElementById('era-summary');
    this.listEl = document.getElementById('era-list');
    this.introEl = document.getElementById('era-intro');
    this.disclaimerEl = document.getElementById('era-disclaimer');

    document.getElementById('era-close').addEventListener('click', () => this.close());
    if (this.btn) {
      this.btn.addEventListener('click', () => this.toggle());
      this.btn.setAttribute('aria-expanded', 'false');
      this.btn.setAttribute('aria-pressed', 'false');
    }
    document.addEventListener('gg:lang', () => {
      this.build();
      this.syncButton();
    });

    this.build();
    this.syncButton();
  }

  Eras.prototype.current = function () {
    return this.data.eras.find((e) => e.id === this.id) || this.data.eras[0];
  };

  Eras.prototype.t = function (o) {
    return (o && (GG.i18n.lang === 'en' ? o.en : o.zh)) || '';
  };

  Eras.prototype.isOpen = function () {
    return !!this.root && !this.root.hidden;
  };

  Eras.prototype.toggle = function () {
    if (this.isOpen()) this.close();
    else this.open();
  };

  Eras.prototype.open = function () {
    if (!this.root) return;
    this.root.hidden = false;
    document.body.classList.add('eras-on');
    if (this.btn) {
      this.btn.classList.add('active');
      this.btn.setAttribute('aria-expanded', 'true');
      this.btn.setAttribute('aria-pressed', 'true');
    }
    this.build();
  };

  Eras.prototype.close = function () {
    if (!this.root) return;
    this.root.hidden = true;
    document.body.classList.remove('eras-on');
    if (this.btn) {
      this.btn.classList.remove('active');
      this.btn.setAttribute('aria-expanded', 'false');
      this.btn.setAttribute('aria-pressed', 'false');
    }
  };

  Eras.prototype.set = function (id) {
    if (!this.data.eras.some((e) => e.id === id)) return;
    if (id === this.id) return;
    this.id = id;
    this.build();
    this.syncButton();
    this.onChange(id);
  };

  Eras.prototype.syncButton = function () {
    if (!this.btn) return;
    const cur = this.current();
    const label = this.t(cur.label);
    this.btn.textContent = GG.i18n.t('明清 · ' + label, 'Ming / Qing · ' + label);
    this.btn.title = GG.i18n.t('切换朝代对比：当前 ' + label, 'Dynasty comparison: currently ' + label);
    this.btn.setAttribute('aria-label', this.btn.title);
  };

  /** 面板全部由数据生成：tab、当前朝代说明、差异清单、免责声明 */
  Eras.prototype.build = function () {
    if (!this.tabsEl || !this.listEl) return;
    const t = (o) => this.t(o);

    this.tabsEl.innerHTML = this.data.eras.map((e) => {
      const on = e.id === this.id;
      return `<button type="button" role="tab" class="era-tab${on ? ' active' : ''}"` +
        ` data-era="${e.id}" aria-selected="${on}" tabindex="${on ? '0' : '-1'}">` +
        `${esc(t(e.label))} <span class="era-span">${esc(e.span)}</span></button>`;
    }).join('');
    this.tabsEl.querySelectorAll('.era-tab').forEach((b) => {
      b.addEventListener('click', () => this.set(b.dataset.era));
      b.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const next = this.data.eras[(this.data.eras.findIndex((x) => x.id === this.id) + 1) % 2];
        this.set(next.id);
        const focus = this.tabsEl.querySelector('.era-tab.active');
        if (focus) focus.focus();
      });
    });

    this.introEl.textContent = t(this.data.intro);
    this.disclaimerEl.textContent = t(this.data.disclaimer);
    this.summaryEl.textContent = t(this.current().summary);

    let html = '';
    for (const c of this.data.changes) {
      const info = GG.INFO[c.key];
      if (!info) continue;
      const name = GG.i18n.lang === 'en' ? (info.en || info.name) : info.name;
      html += `<button type="button" class="era-item" data-key="${c.key}">` +
        `<span class="era-name">${esc(name)}</span>` +
        `<span class="era-when">${esc(t(c.era))}</span>` +
        `<span class="era-what">${esc(t(c[this.id]))}</span>` +
        `<span class="era-src">${esc(t(c.source))}</span>` +
        '</button>';
    }
    this.listEl.innerHTML = html;
    this.listEl.querySelectorAll('.era-item').forEach((b) => {
      b.addEventListener('click', () => {
        const info = GG.INFO[b.dataset.key];
        const entry = info && this.findEntry(info.name);
        if (entry) this.onFocus(entry);
      });
    });
  };

  /** 信息卡里的差异注记：只给有数据的词条，带年代与依据 */
  Eras.prototype.noteFor = function (info) {
    if (!info) return null;
    const c = this.data.changes.find((x) => (GG.INFO[x.key] || {}).name === info.name);
    if (!c) return null;
    return {
      label: this.t(this.current().label) + ' · ' + this.t(c.era),
      text: this.t(c[this.id]) + '　' + this.t(c.source)
    };
  };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
    ));
  }

  GG.Eras = Eras;
})();
