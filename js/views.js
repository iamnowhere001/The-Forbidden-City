/* ============================================================
   视角预设与相机飞行
   机位表只有一份（GG.CONFIG.views），按钮从这里生成，
   键盘映射也从同一份表读，新增机位只改配置即可。
   ============================================================ */
(function () {
  const GG = (window.GG = window.GG || {});

  function Views(opts) {
    this.camera = opts.camera;
    this.orbit = opts.orbit;
    this.root = opts.root;          // <nav id="views">
    this._fly = null;
    this._build();
  }

  Views.prototype._build = function () {
    const list = GG.CONFIG.views.filter((v) => !v.hidden);
    this.root.innerHTML = '';
    for (const v of list) {
      const b = document.createElement('button');
      b.dataset.view = v.id;
      b.textContent = GG.i18n.t(v.label, v.labelEn);
      b.title = GG.i18n.lang === 'en' ? v.labelEn : v.name;
      b.setAttribute('aria-label', b.title);
      b.addEventListener('click', () => this.set(v.id));
      this.root.appendChild(b);
    }
    if (list.length) this._mark(list[0].id);
  };

  /** 语言切换后更新按钮文案，不重建节点，避免焦点丢失 */
  Views.prototype.refresh = function () {
    const list = GG.CONFIG.views.filter((v) => !v.hidden);
    [...this.root.querySelectorAll('button')].forEach((b, i) => {
      const v = list[i];
      if (!v) return;
      b.textContent = GG.i18n.t(v.label, v.labelEn);
      b.title = GG.i18n.lang === 'en' ? v.labelEn : v.name;
      b.setAttribute('aria-label', b.title);
    });
  };

  Views.prototype._mark = function (id) {
    [...this.root.querySelectorAll('button')].forEach((b) => {
      b.classList.toggle('active', b.dataset.view === id);
    });
  };

  Views.prototype.get = function (key) {
    return GG.CONFIG.views.find((v) => v.id === key);
  };

  /** 直接落位，跳过飞行动画（URL 直链用） */
  Views.prototype.applyInstant = function (key) {
    const v = this.get(key);
    if (!v) return;
    this.jumpTo(v.p, v.t);
    this._mark(key);
  };

  /** 无动画落位 */
  Views.prototype.jumpTo = function (pos, target) {
    this.camera.position.set(pos[0], pos[1], pos[2]);
    this.orbit.target.set(target[0], target[1], target[2]);
    this.camera.lookAt(this.orbit.target);
    this.orbit.syncFromCamera();
  };

  /**
   * 取景到某座建筑：机位与 focusBuilding 共用同一套算法，
   * 导览与“聚焦”按钮因此不会出现两种构图。
   */
  Views.prototype.spotFor = function (entry) {
    const v = new THREE.Vector3();
    entry.getWorldPosition(v);
    const r = entry.userData.pickRadius || 30;
    const lblY = entry.userData.labelY || 20;
    const dist = Math.max(52, r * 3.2);
    return {
      p: [v.x + dist * 0.30, lblY * 0.86 + 16, v.z + dist * 0.86],
      t: [v.x, lblY * 0.32, v.z]
    };
  };

  /** 尊重系统“减少动效”设置：直接落位，不做镜头飞行 */
  Views.prototype.moveTo = function (pos, target, dur) {
    if (Views.reducedMotion()) this.jumpTo(pos, target);
    else this.flyTo(pos, target, dur);
  };

  Views.reducedMotion = function () {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  };

  /** 带弧线飞行切换机位 */
  Views.prototype.set = function (key) {
    const v = this.get(key);
    if (!v) return;
    this.moveTo(v.p, v.t, 1.6);
    this._mark(key);
  };

  /** 二次贝塞尔抬升 + 三次缓动 */
  Views.prototype.flyTo = function (pos, target, dur) {
    const V3 = THREE.Vector3;
    const p0 = this.camera.position.clone();
    const p1 = new V3(pos[0], pos[1], pos[2]);
    const mid = p0.clone().lerp(p1, 0.5);
    mid.y += Math.min(p0.distanceTo(p1) * 0.22, 210);
    this._fly = {
      start: performance.now(),
      dur: (dur || 1.5) * 1000,
      p0, p1, mid,
      t0: this.orbit.target.clone(),
      t1: new V3(target[0], target[1], target[2])
    };
  };

  Views.prototype.step = function () {
    const fly = this._fly;
    if (!fly) return;
    const cam = this.camera;
    const orbit = this.orbit;

    const u = Math.min(1, (performance.now() - fly.start) / fly.dur);
    const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    const a = 1 - e;
    cam.position.set(
      a * a * fly.p0.x + 2 * a * e * fly.mid.x + e * e * fly.p1.x,
      a * a * fly.p0.y + 2 * a * e * fly.mid.y + e * e * fly.p1.y,
      a * a * fly.p0.z + 2 * a * e * fly.mid.z + e * e * fly.p1.z
    );
    orbit.target.lerpVectors(fly.t0, fly.t1, e);
    orbit.tTarget.copy(orbit.target);
    cam.lookAt(orbit.target);

    // 同步球坐标，避免飞行结束后跳变
    const off = cam.position.clone().sub(orbit.target);
    orbit.radius = orbit.tRadius = off.length();
    orbit.theta = orbit.tTheta = Math.atan2(off.x, off.z);
    orbit.phi = orbit.tPhi = Math.acos(
      THREE.MathUtils.clamp(off.y / Math.max(off.length(), 0.001), -1, 1)
    );

    if (u >= 1) this._fly = null;
  };

  Views.prototype.isFlying = function () {
    return !!this._fly;
  };

  GG.Views = Views;
})();
