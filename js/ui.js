/* ============================================================
   界面层
   建筑索引侧栏（搜索 / 已阅标记）+ 信息卡。只碰 DOM，不碰相机与场景。
   「已阅」记在 localStorage，隐私模式下静默失效。
   ============================================================ */
(function () {
  const GG = (window.GG = window.GG || {});

  const ORDER = ['前朝', '后寝', '东路', '西路', '城防', '宫外'];
  const VISIT_KEY = 'gg-visited';

  function loadVisited() {
    try {
      const arr = JSON.parse(localStorage.getItem(VISIT_KEY) || '[]');
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) {
      return new Set();
    }
  }

  function saveVisited(set) {
    try {
      localStorage.setItem(VISIT_KEY, JSON.stringify([...set]));
    } catch (e) { /* file:// 或隐私模式下忽略 */ }
  }

  function UI(opts) {
    this.listEl = opts.listEl;
    this.els = opts.els;               // { info, name, en, cat, year, desc }
    this.onPick = opts.onPick || function () {};
    this.items = [];                   // 与侧栏顺序一致的建筑组
    this.byName = new Map();
    this.registry = [];
    this.current = null;
    this.query = '';
    this.visited = loadVisited();

    this.searchEl = document.getElementById('search');
    this.noResultEl = document.getElementById('no-result');
    this.countEl = document.getElementById('read-count');

    if (this.searchEl) {
      this.searchEl.addEventListener('input', () => {
        this.query = this.searchEl.value.trim().toLowerCase();
        this.applyFilter();
      });
      // Esc 清空搜索，不冒泡给全局键位（避免顺手关掉信息卡）
      this.searchEl.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          this.searchEl.value = '';
          this.query = '';
          this.applyFilter();
        }
      });
    }
  }

  /** 按类别分组生成侧栏，并把每个条目映射回场景里的建筑组 */
  UI.prototype.build = function (registry) {
    this.registry = registry;
    const groups = {};
    for (const g of registry) {
      const info = g.userData.info;
      if (!info || !info.name) continue;
      const c = info.cat || '其他';
      (groups[c] = groups[c] || []).push(info);
    }

    let html = '';
    for (const c of ORDER) {
      if (!groups[c]) continue;
      html += `<div class="li-group">${GG.i18n.cat(c)}</div>`;
      const seen = new Set();
      for (const info of groups[c]) {
        if (seen.has(info.name)) continue;
        seen.add(info.name);
        const visited = this.visited.has(info.name) ? ' visited' : '';
        html += `<div class="li${visited}" data-name="${info.name}" data-en="${info.en || ''}"` +
          ` role="button" tabindex="0" aria-label="${info.name}"><span class="dot"></span>${info.name}</div>`;
      }
    }
    this.listEl.innerHTML = html;

    this.byName.clear();
    for (const g of registry) {
      const info = g.userData.info;
      if (info && info.name && !this.byName.has(info.name)) this.byName.set(info.name, g);
    }
    this.items = [...this.listEl.querySelectorAll('.li')]
      .map((li) => this.byName.get(li.dataset.name))
      .filter(Boolean);

    this.listEl.querySelectorAll('.li').forEach((li) => {
      const pick = () => {
        const g = this.byName.get(li.dataset.name);
        if (g) this.onPick(g);
      };
      li.addEventListener('click', pick);
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          pick();
        }
      });
    });

    if (this.searchEl) {
      this.searchEl.placeholder = GG.i18n.t('搜索宫殿', 'Search');
      this.searchEl.setAttribute('aria-label', GG.i18n.t('搜索宫殿', 'Search'));
      this.searchEl.value = this.query;
    }
    this.applyFilter();
    this.updateCount();
  };

  /** 搜索过滤：命中中文名或英文名；分类标题随整组隐藏 */
  UI.prototype.applyFilter = function () {
    const q = this.query;
    let shown = 0;
    for (const li of this.listEl.querySelectorAll('.li')) {
      const match = !q
        || li.dataset.name.toLowerCase().includes(q)
        || (li.dataset.en || '').toLowerCase().includes(q);
      li.classList.toggle('hidden', !match);
      if (match) shown++;
    }
    for (const g of this.listEl.querySelectorAll('.li-group')) {
      let el = g.nextElementSibling;
      let any = false;
      while (el && !el.classList.contains('li-group')) {
        if (el.classList.contains('li') && !el.classList.contains('hidden')) {
          any = true;
          break;
        }
        el = el.nextElementSibling;
      }
      g.classList.toggle('hidden', !any);
    }
    if (this.noResultEl) this.noResultEl.hidden = shown > 0;
  };

  /** 已阅计数：只统计当前场景里有实体的词条 */
  UI.prototype.updateCount = function () {
    if (!this.countEl) return;
    const names = new Set();
    for (const g of this.registry) {
      const info = g.userData.info;
      if (info && info.name) names.add(info.name);
    }
    const done = [...names].filter((n) => this.visited.has(n)).length;
    this.countEl.textContent = names.size ? `${done} / ${names.size}` : '';
  };

  UI.prototype.markVisited = function (name) {
    if (!name || this.visited.has(name)) return;
    this.visited.add(name);
    saveVisited(this.visited);
    const li = [...this.listEl.querySelectorAll('.li')]
      .find((el) => el.dataset.name === name);
    if (li) li.classList.add('visited');
    this.updateCount();
  };

  /** 语言切换后重建侧栏，并保持信息卡内容 */
  UI.prototype.refresh = function () {
    if (!this.registry.length) return;
    const cur = this.current;
    this.build(this.registry);
    if (cur) this.show(cur);
  };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
    ));
  }

  UI.prototype.show = function (info) {
    this.current = info;
    this.markVisited(info.name);
    const en = GG.i18n.lang === 'en';
    this.els.name.textContent = en ? (info.en || info.name || '') : (info.name || '');
    this.els.en.textContent = en ? (info.name || '') : (info.en || '');
    this.els.cat.textContent = GG.i18n.cat(info.cat || '');
    this.els.year.textContent = info.year || '';
    this.els.desc.textContent = info.desc || '';

    /* 结构化字段：有值才显示，避免空行 */
    const rows = [
      ['形制', info.form],
      ['尺度', info.scale],
      ['现状', info.status]
    ].filter(([, v]) => v);
    this.els.meta.innerHTML = rows
      .map(([k, v]) => `<dt>${GG.i18n.meta(k)}</dt><dd>${esc(v)}</dd>`)
      .join('');
    this.els.meta.hidden = rows.length === 0;

    /* 史料卡：只有标注了 note 的词条才出现 */
    if (info.note) {
      this.els.noteText.textContent = info.note;
      this.els.note.hidden = false;
      this.els.note.open = false;
    } else {
      this.els.note.hidden = true;
    }

    this.els.info.classList.add('open');
    this.setActive(info.name);
  };

  UI.prototype.hide = function () {
    this.current = null;
    this.els.info.classList.remove('open');
    this.setActive(null);
  };

  UI.prototype.setActive = function (name) {
    [...this.listEl.querySelectorAll('.li')].forEach((li) => {
      li.classList.toggle('active', name != null && li.dataset.name === name);
    });
  };

  GG.UI = UI;
})();
