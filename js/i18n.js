/* ============================================================
   界面语言
   只翻译界面文案与建筑名；词条正文保留中文原文，
   避免用机器翻译替代史料表述。
   ============================================================ */
(function () {
  const GG = (window.GG = window.GG || {});

  const CATS = {
    '前朝': 'Outer Court',
    '后寝': 'Inner Court',
    '东路': 'East Route',
    '西路': 'West Route',
    '城防': 'Defense',
    '宫外': 'Environs'
  };

  const META = {
    '形制': 'Form',
    '尺度': 'Scale',
    '现状': 'Status'
  };

  function storedLang() {
    try {
      return localStorage.getItem('gg-lang');
    } catch (e) {
      return null;
    }
  }

  const qLang = new URLSearchParams(location.search).get('lang');

  GG.i18n = {
    lang: qLang === 'en' ? 'en' : qLang === 'zh' ? 'zh' : (storedLang() === 'en' ? 'en' : 'zh'),

    t(zh, en) {
      return this.lang === 'en' ? (en || zh) : zh;
    },

    cat(name) {
      return this.lang === 'en' ? (CATS[name] || name) : name;
    },

    meta(name) {
      return this.lang === 'en' ? (META[name] || name) : name;
    },

    set(lang) {
      const next = lang === 'en' ? 'en' : 'zh';
      if (next === this.lang) return;
      this.lang = next;
      try {
        localStorage.setItem('gg-lang', next);
      } catch (e) { /* file:// 或隐私模式下忽略 */ }
      document.documentElement.lang = next === 'en' ? 'en' : 'zh-CN';
      this.applyStatic();
      document.dispatchEvent(new CustomEvent('gg:lang'));
    },

    toggle() {
      this.set(this.lang === 'en' ? 'zh' : 'en');
    },

    /** 静态节点：<span data-zh="标注" data-en="Labels"> */
    applyStatic() {
      document.querySelectorAll('[data-zh]').forEach((el) => {
        el.textContent = this.lang === 'en' ? (el.dataset.en || el.dataset.zh) : el.dataset.zh;
      });
      document.querySelectorAll('[data-title-zh]').forEach((el) => {
        el.title = this.lang === 'en'
          ? (el.dataset.titleEn || el.dataset.titleZh)
          : el.dataset.titleZh;
        const label = el.getAttribute('aria-label');
        if (label) {
          el.setAttribute('aria-label', el.title);
        }
      });
    }
  };

  document.documentElement.lang = GG.i18n.lang === 'en' ? 'en' : 'zh-CN';
})();
