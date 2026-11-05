/* ============================================================
   搜索匹配（纯函数）
   ui.js 的 applyFilter 与 tools/search-check.js 共用这一份规则，
   不要在第二个地方复制一份命中逻辑。

   命中分四级，score 越小越靠前：
     0 标题精确（name / en / py / pyi）
     1 正文精确（desc / note / form / scale / status / cat / year）
     2 模糊音（zh↔z、ch↔c、sh↔s、n↔l、前后鼻音）
     3 错字容错（编辑距离 ≤ 1）

   只做字面匹配，不联网、不分词、不引入外部依赖。
   ============================================================ */
(function () {
  const GG = (window.GG = window.GG || {});

  const HEAD = ['name', 'en', 'py', 'pyi'];
  const BODY = ['desc', 'note', 'form', 'scale', 'status', 'cat', 'year'];

  /** 模糊音归一：两边都过这个函数，互为等价类即可命中 */
  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/zh/g, 'z')
      .replace(/ch/g, 'c')
      .replace(/sh/g, 's')
      .replace(/ng/g, 'n')
      .replace(/n/g, 'l');
  }

  /** 编辑距离 ≤ max 的快速判定（max 只用到 1），额外容一次相邻字母换位 */
  function near(a, b, max) {
    a = String(a || ''); b = String(b || '');
    if (Math.abs(a.length - b.length) > max) return false;
    /* taihedain / taihedian 这类手滑：等长、恰好两处不同且互为交换 */
    if (a.length === b.length && max > 0) {
      let p = -1, q = -1, bad = 0;
      for (let n = 0; n < a.length; n++) {
        if (a[n] === b[n]) continue;
        if (p < 0) p = n; else if (q < 0) q = n;
        bad++;
      }
      if (bad === 2 && q === p + 1 && a[p] === b[q] && a[q] === b[p]) return true;
    }
    let i = 0, j = 0, diff = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++diff > max) return false;
      if (a.length > b.length) i++;
      else if (a.length < b.length) j++;
      else { i++; j++; }
    }
    diff += (a.length - i) + (b.length - j);
    return diff <= max;
  }

  /**
   * 在 hay 里滑窗找 needle 的近似子串。
   * allowIndel=false 时窗口长度固定（只容替换），中文名称用这个口径，
   * 否则「大和」会把任何含「大」的两字窗口都算成命中。
   */
  function fuzzyIncludes(hay, needle, max, allowIndel) {
    hay = String(hay || '').toLowerCase();
    needle = String(needle || '').toLowerCase();
    if (!hay || !needle) return false;
    const lo = allowIndel ? Math.max(1, needle.length - max) : needle.length;
    const hi = allowIndel ? needle.length + max : needle.length;
    for (let len = lo; len <= hi; len++) {
      for (let i = 0; i + len <= hay.length; i++) {
        if (near(hay.substr(i, len), needle, max)) return true;
      }
    }
    return false;
  }

  /** 返回 null（不命中）或 { score, kind }。cat / era 与旧版语义一致 */
  function match(info, q, cat, era) {
    if (!info) return null;
    if (cat && info.cat !== cat) return null;
    if (era && !String(info.year || '').includes(era)) return null;
    const s = String(q || '').trim().toLowerCase();
    if (!s) return { score: 0, kind: 'all' };

    const head = HEAD.map((k) => String(info[k] || '').toLowerCase());
    if (head.some((v) => v.includes(s))) return { score: 0, kind: 'title' };
    const body = BODY.map((k) => String(info[k] || '').toLowerCase());
    if (body.some((v) => v.includes(s))) return { score: 1, kind: 'body' };

    const latin = /^[a-z]+$/.test(s);
    if (latin) {
      const nq = norm(s);
      if (['py', 'pyi', 'en'].some((k) => norm(info[k]).includes(nq))) {
        return { score: 2, kind: 'sound' };
      }
      if (s.length >= 4) {
        for (const k of ['py', 'pyi', 'en']) {
          const raw = String(info[k] || '').toLowerCase();
          if (!raw) continue;
          /* 英文名按单词比，避免跨词窗口把不相关的词凑成命中 */
          const parts = k === 'en' ? raw.split(/\s+/) : [raw];
          if (parts.some((p) => fuzzyIncludes(p, s, 1, true))) {
            return { score: 3, kind: 'typo' };
          }
        }
      }
    } else if (s.length >= 3) {
      /* 中文只比名称：正文动辄百字，开容错会满屏误命中 */
      if (fuzzyIncludes(info.name, s, 1, false)) {
        return { score: 3, kind: 'typo' };
      }
    }
    return null;
  }

  GG.search = { norm, near, fuzzyIncludes, match };
})();
