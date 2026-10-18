/* ============================================================
   导览播放器
   路线来自 GG.TOUR，机位来自 views.spotFor()，
   所以导览与“聚焦”按钮的构图始终一致。
   ============================================================ */
(function () {
  const GG = (window.GG = window.GG || {});

  function Tour(opts) {
    this.views = opts.views;
    this.findEntry = opts.findEntry;
    this.onStop = opts.onStop || function () {};
    this.onExit = opts.onExit || function () {};
    this.onFinish = opts.onFinish || function () {};

    this.stops = (GG.TOUR && GG.TOUR.stops) || [];
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
      exit: document.getElementById('tour-exit')
    };

    this.els.prev.addEventListener('click', () => this.prev());
    this.els.play.addEventListener('click', () => this.toggle());
    this.els.next.addEventListener('click', () => this.next());
    this.els.exit.addEventListener('click', () => this.stop());
  }

  Tour.prototype.start = function () {
    if (!this.stops.length) return;
    this.active = true;
    this.root.hidden = false;
    document.body.classList.add('tour-on');
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

  /** 语言切换后重绘当前站 */
  Tour.prototype.refresh = function () {
    if (!this.active || this.i < 0) return;
    const stop = this.stops[this.i];
    const entry = this.findEntry(stop.target);
    if (entry) this._render(stop, entry);
  };

  GG.Tour = Tour;
})();
