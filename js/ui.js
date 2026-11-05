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
    this.onRel = opts.onRel || function () {};
    /* 朝代对比说明由 eras.js 提供，ui 不反向依赖那个实例 */
    this.eraNoteFn = opts.eraNote || null;
    this.items = [];                   // 与侧栏顺序一致的建筑组
    this.byName = new Map();
    this.byNameInfo = new Map();       // name → 完整词条（正文检索用）
    this.registry = [];
    this.current = null;
    this.query = '';
    this.filterCat = '';
    this.filterEra = '';
    this.visited = loadVisited();

    this.searchEl = document.getElementById('search');
    this.catEl = document.getElementById('filter-cat');
    this.eraEl = document.getElementById('filter-era');
    this.noResultEl = document.getElementById('no-result');
    this.countEl = document.getElementById('read-count');
    this.statusEl = document.getElementById('search-status');

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

    if (this.catEl) {
      this.catEl.addEventListener('change', () => {
        this.filterCat = this.catEl.value;
        this.applyFilter();
      });
    }
    if (this.eraEl) {
      this.eraEl.addEventListener('change', () => {
        this.filterEra = this.eraEl.value;
        this.applyFilter();
      });
    }

    /* 相关词条：事件委托，避免每次 show 重新绑定 */
    if (this.els.rel) {
      this.els.rel.addEventListener('click', (e) => {
        const b = e.target.closest('.rel-item');
        if (b) this.onRel(b.dataset.name);
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
          ` data-py="${info.py || ''}" data-pyi="${info.pyi || ''}"` +
          ` data-cat="${info.cat || ''}" data-year="${(info.year || '').replace(/"/g, '')}"` +
          ` role="button" tabindex="0" aria-label="${info.name}"><span class="dot"></span>${info.name}</div>`;
      }
    }
    this.listEl.innerHTML = html;

    this.byName.clear();
    this.byNameInfo.clear();
    for (const g of registry) {
      const info = g.userData.info;
      if (!info || !info.name || this.byName.has(info.name)) continue;
      this.byName.set(info.name, g);
      this.byNameInfo.set(info.name, info);
    }
    /* 正文检索需要完整词条，不能只靠 dataset 那几个字段。
       挂在元素上而不是写进 HTML，语言切换重建时会一并换掉。 */
    [...this.listEl.querySelectorAll('.li')].forEach((li) => {
      li.__info = this.byNameInfo.get(li.dataset.name);
    });
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
      const ph = GG.i18n.t('搜索名称 / 拼音 / 正文', 'Search name, pinyin or text');
      this.searchEl.placeholder = ph;
      this.searchEl.setAttribute('aria-label', ph);
      this.searchEl.value = this.query;
    }
    this.applyFilter();
    this.updateCount();
  };

  /**
   * 过滤规则只有一份：GG.search.match（js/search.js）。
   * 命中分四级，同组内按 score 重排，模糊结果加 .fuzzy 标记。
   */
  UI.prototype.applyFilter = function () {
    const q = this.query;
    const all = [...this.listEl.querySelectorAll('.li')];
    const hits = new Map();
    let shown = 0;
    for (const li of all) {
      const r = GG.search.match(li.__info, q, this.filterCat, this.filterEra);
      hits.set(li, r);
      li.classList.toggle('hidden', !r);
      li.classList.toggle('fuzzy', !!r && r.score >= 2);
      if (r) shown++;
    }
    if (q) this._sortGroups(hits);

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
    /* 重排后「上一座 / 下一座」要跟着新的可见顺序走 */
    this.items = [...this.listEl.querySelectorAll('.li')]
      .map((li) => this.byName.get(li.dataset.name))
      .filter(Boolean);

    if (this.noResultEl) this.noResultEl.hidden = shown > 0;
    if (this.statusEl) {
      this.statusEl.textContent = q
        ? GG.i18n.t('找到 ' + shown + ' 条', shown + ' found')
        : '';
    }
    /* 标签层据此高亮搜索命中的建筑；空查询时全部清除 */
    document.dispatchEvent(new CustomEvent('gg:filter', {
      detail: {
        active: !!q,
        names: new Set(all.filter((li) => hits.get(li)).map((li) => li.dataset.name))
      }
    }));
  };

  /** 组内按命中等级重排；组标题不动，跨组顺序不动 */
  UI.prototype._sortGroups = function (hits) {
    const groups = [...this.listEl.querySelectorAll('.li-group')];
    groups.forEach((g, gi) => {
      const nextGroup = groups[gi + 1] || null;
      const lis = [];
      let el = g.nextElementSibling;
      while (el && el !== nextGroup) {
        if (el.classList && el.classList.contains('li')) lis.push(el);
        el = el.nextElementSibling;
      }
      lis.sort((a, b) => {
        const ra = hits.get(a), rb = hits.get(b);
        return (ra ? ra.score : 9) - (rb ? rb.score : 9);
      });
      for (const li of lis) {
        if (nextGroup) this.listEl.insertBefore(li, nextGroup);
        else this.listEl.appendChild(li);
      }
    });
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

  UI.prototype.hasVisited = function (name) {
    return this.visited.has(name);
  };

  UI.prototype.markVisited = function (name) {
    if (!name || this.visited.has(name)) return;
    this.visited.add(name);
    saveVisited(this.visited);
    const li = [...this.listEl.querySelectorAll('.li')]
      .find((el) => el.dataset.name === name);
    if (li) li.classList.add('visited');
    this.updateCount();
    /* 探索清单复用「已阅」，不另存一份进度 */
    document.dispatchEvent(new CustomEvent('gg:visited', { detail: { name } }));
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

    /* 朝代对比：只在当前词条有明清差异时出现，文案带年代与依据 */
    const era = this.eraNoteFn ? this.eraNoteFn(info) : null;
    if (this.els.era) {
      if (era) {
        this.els.eraCap.textContent = era.label || '';
        this.els.eraText.textContent = era.text || '';
        this.els.era.hidden = false;
      } else {
        this.els.era.hidden = true;
      }
    }

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

    /* 相关词条：rel 存的是 info key，渲染成可点的按钮 */
    const relBox = this.els.rel;
    if (relBox) {
      const list = (info.rel || []).map((k) => GG.INFO[k]).filter(Boolean);
      if (list.length) {
        relBox.hidden = false;
        relBox.innerHTML = '<span class="rel-cap">' + esc(GG.i18n.t('相关', 'Related')) + '</span>' +
          list.map((x) => `<button type="button" class="rel-item" data-name="${esc(x.name)}">${esc(x.name)}</button>`).join('');
      } else {
        relBox.hidden = true;
        relBox.innerHTML = '';
      }
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
