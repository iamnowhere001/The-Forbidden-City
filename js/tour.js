/* ============================================================
   导览播放器
   路线来自 GG.TOUR.routes，机位来自 views.spotFor()，
   所以导览与“聚焦”按钮的构图始终一致。
   支持多路线切换：切换后从该线第 1 站重新开始。
   ============================================================ */
(function () {
  const GG = (window.GG = window.GG || {});

  function Tour(opts) {
    this.views = opts.views;
    this.findEntry = opts.findEntry;
    this.onStop = opts.onStop || function () {};
    this.onExit = opts.onExit || function () {};
    this.onFinish = opts.onFinish || function () {};

    this.routes = (GG.TOUR && GG.TOUR.routes) || [];
    this.routeIndex = 0;
    this.route = this.routes[0] || { stops: [], title: { zh: '', en: '' } };
    this.stops = this.route.stops || [];
    this.i = -1;
    this.active = false;
    this.playing = false;
    this.timer = null;

    this.root = document.getElementById('tour');
    this.els = {
      idx: document.getElementById('tour-idx'),
      title: document.getElementById('tour-title'),
      text: document.getElementById('tour-text'),
      bar: document.getElementById('tour-progress'),
      prev: document.getElementById('tour-prev'),
      play: document.getElementById('tour-play'),
      next: document.getElementById('tour-next'),
      exit: document.getElementById('tour-exit'),
      routes: document.getElementById('tour-routes')
    };

    this.els.prev.addEventListener('click', () => this.prev());
    this.els.play.addEventListener('click', () => this.toggle());
    this.els.next.addEventListener('click', () => this.next());
    this.els.exit.addEventListener('click', () => this.stop());

    this._buildRoutes();
  }

  /* 路线 tab：从 routes 数据生成，不写死按钮 */
  Tour.prototype._buildRoutes = function () {
    const box = this.els.routes;
    if (!box) return;
    box.innerHTML = '';
    this.routes.forEach((r) => {
      const b = document.createElement('button');
      b.className = 'tour-route';
      b.type = 'button';
      b.dataset.route = r.id;
      b.setAttribute('role', 'tab');
      b.addEventListener('click', () => this.setRoute(r.id));
      box.appendChild(b);
    });
    this._syncRoutes();
  };

  Tour.prototype._syncRoutes = function () {
    const box = this.els.routes;
    if (!box) return;
    const lang = GG.i18n.lang;
    for (const b of box.querySelectorAll('.tour-route')) {
      const r = this.routes.find((x) => x.id === b.dataset.route);
      if (!r) continue;
      b.textContent = (r.short && (lang === 'en' ? r.short.en : r.short.zh)) || r.id;
      b.setAttribute('aria-selected', String(r.id === this.route.id));
      b.classList.toggle('active', r.id === this.route.id);
      b.setAttribute('aria-label', lang === 'en' ? r.title.en : r.title.zh);
    }
    if (this.root) {
      this.root.setAttribute('aria-label', lang === 'en' ? this.route.title.en : this.route.title.zh);
    }
  };

  Tour.prototype.setRoute = function (id) {
    const idx = this.routes.findIndex((r) => r.id === id);
    if (idx < 0) return;
    this.routeIndex = idx;
    this.route = this.routes[idx];
    this.stops = this.route.stops || [];
    this._syncRoutes();
    if (this.active) this._go(0);
  };

  Tour.prototype.start = function () {
    if (!this.stops.length) return;
    this.active = true;
    this.root.hidden = false;
    document.body.classList.add('tour-on');
    this._syncRoutes();
    this._go(0);
  };

  Tour.prototype._go = function (i) {
    this._clear();
    if (!this.active) return;
    if (i >= this.stops.length) return this.finish();
    if (i < 0) i = 0;

    const stop = this.stops[i];
    const entry = this.findEntry(stop.target);
    if (!entry) {
      // 词条缺失时跳过，不让导览卡死
      return this._go(i + 1);
    }

    this.i = i;
    const spot = this.views.spotFor(entry);
    this.views.moveTo(spot.p, spot.t, 1.5);
    this.playing = true;
    this._render(stop, entry);
    this.onStop(entry, stop);
    this._schedule();
  };

  Tour.prototype._render = function (stop, entry) {
    const lang = GG.i18n.lang;
    const info = entry.userData.info || {};
    const total = this.stops.length;
    const n = String(this.i + 1).padStart(2, '0');

    this.els.idx.textContent = n + ' / ' + String(total).padStart(2, '0');
    this.els.title.textContent = lang === 'en' ? (info.en || stop.target) : stop.target;
    this.els.text.textContent = lang === 'en' ? stop.en : stop.zh;
    this.els.bar.style.width = ((this.i + 1) / total) * 100 + '%';
    this._labelPlay();
    this._syncRoutes();
  };

  Tour.prototype._labelPlay = function () {
    this.els.play.textContent = this.playing
      ? GG.i18n.t('暂停', 'Pause')
      : GG.i18n.t('继续', 'Resume');
  };

  Tour.prototype._schedule = function () {
    this._clear();
    if (!this.playing || !this.active) return;
    const dwell = this.stops[this.i].dwell || 9000;
    this.timer = setTimeout(() => this.next(), dwell);
  };

  Tour.prototype._clear = function () {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  };

  Tour.prototype.next = function () {
    this._go(this.i + 1);
  };

  Tour.prototype.prev = function () {
    this._go(this.i - 1);
  };

  Tour.prototype.toggle = function () {
    if (!this.active) return;
    this.playing = !this.playing;
    this._labelPlay();
    if (this.playing) this._schedule();
    else this._clear();
  };

  Tour.prototype.stop = function () {
    if (!this.active) return;
    this.active = false;
    this.playing = false;
    this._clear();
    this.root.hidden = true;
    document.body.classList.remove('tour-on');
    this.onExit();
  };

  Tour.prototype.finish = function () {
    this.stop();
    this.onFinish();
  };

  /** 语言切换后重绘当前站与路线 tab */
  Tour.prototype.refresh = function () {
    this._syncRoutes();
    if (!this.active || this.i < 0) return;
    const stop = this.stops[this.i];
    const entry = this.findEntry(stop.target);
    if (entry) this._render(stop, entry);
  };

  GG.Tour = Tour;
})();
