/* ============================================================
   轨道控制器（自实现，含阻尼 / 触控 / 平移 / 缩放）
   不依赖 OrbitControls addon，保持零外部文件。
   ============================================================ */
(function () {
  const GG = (window.GG = window.GG || {});

  function Orbit(cam, dom) {
    const O = GG.CONFIG.orbit;
    this.cam = cam;
    this.dom = dom;
    this.target = new THREE.Vector3(O.target[0], O.target[1], O.target[2]);
    this.theta = 0;
    this.phi = O.phi;
    this.radius = O.radius;
    this.tTheta = this.theta;
    this.tPhi = this.phi;
    this.tRadius = this.radius;
    this.tTarget = this.target.clone();
    this.enabled = true;
    this.autoRotate = false;
    this.damp = O.damp;
    this.minR = O.minR;
    this.maxR = O.maxR;
    this.minPhi = O.minPhi;
    this.maxPhi = O.maxPhi;
    /* 拖拽状态对外暴露：app.js 据此在转视角时跳过悬停拾取 */
    this.dragging = false;
    this.panning = false;
    this._bind();
    this.update(0);
  }

  Orbit.prototype._bind = function () {
    const el = this.dom;
    const V3 = THREE.Vector3;
    const B = GG.CONFIG.orbit.panBounds;
    let dragging = false, panning = false, px = 0, py = 0;
    let pointers = new Map();
    let pinchDist = 0;

    const down = (e) => {
      if (!this.enabled) return;
      el.setPointerCapture && el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        panning = e.button === 2 || e.button === 1 || e.shiftKey;
        dragging = !panning;
        px = e.clientX; py = e.clientY;
        el.style.cursor = panning ? 'move' : 'grabbing';
      } else if (pointers.size === 2) {
        const p = [...pointers.values()];
        pinchDist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        dragging = false; panning = false;
      }
      this.dragging = dragging;
      this.panning = panning;
      /* 用户一上手就把自动旋转停下来，避免两个运动叠在一起 */
      if (this.autoRotate) {
        this.autoRotate = false;
        if (GG.onAutoRotateOff) GG.onAutoRotateOff();
      }
    };

    const move = (e) => {
      /* 第一人称接管相机时 orbit.enabled=false，拖拽不能改球坐标 */
      if (!this.enabled || !pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const p = [...pointers.values()];
        const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        if (pinchDist > 0) this.tRadius *= Math.pow(pinchDist / d, 0.85);
        pinchDist = d;
        this._clamp();
        return;
      }
      const dx = e.clientX - px, dy = e.clientY - py;
      px = e.clientX; py = e.clientY;
      if (panning) {
        const speed = this.tRadius * 0.0016;
        const right = new V3().setFromMatrixColumn(this.cam.matrix, 0);
        const up = new V3(0, 1, 0).cross(right).normalize();
        this.tTarget.addScaledVector(right, -dx * speed);
        this.tTarget.addScaledVector(up, -dy * speed);
        this.tTarget.x = THREE.MathUtils.clamp(this.tTarget.x, -B.x, B.x);
        this.tTarget.z = THREE.MathUtils.clamp(this.tTarget.z, -B.z, B.z);
        this.tTarget.y = THREE.MathUtils.clamp(this.tTarget.y, B.yMin, B.yMax);
      } else if (dragging) {
        this.tTheta -= dx * 0.0042;
        this.tPhi -= dy * 0.0038;
        this._clamp();
      }
    };

    const up = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size === 0) {
        dragging = panning = false;
        this.dragging = this.panning = false;
        el.style.cursor = 'grab';
      }
      pinchDist = 0;
      this._clamp();
    };

    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('wheel', (e) => {
      if (!this.enabled) return;          // 第一人称下滚轮不缩放轨道相机
      e.preventDefault();
      const k = Math.exp(e.deltaY * 0.0011);
      this.tRadius *= k;
      this._clamp();
      /* 滚轮同样视为用户介入：停自动旋转并同步按钮 */
      if (this.autoRotate) {
        this.autoRotate = false;
        if (GG.onAutoRotateOff) GG.onAutoRotateOff();
      }
      if (GG.onUserInteract) GG.onUserInteract();
    }, { passive: false });
  };

  Orbit.prototype._clamp = function () {
    this.tPhi = THREE.MathUtils.clamp(this.tPhi, this.minPhi, this.maxPhi);
    this.tRadius = THREE.MathUtils.clamp(this.tRadius, this.minR, this.maxR);
  };

  Orbit.prototype.update = function (dt) {
    if (this.autoRotate && !this._blocked) this.tTheta += dt * 0.055;
    const k = 1 - Math.pow(1 - this.damp, dt * 60);
    this.theta += (this.tTheta - this.theta) * k;
    this.phi += (this.tPhi - this.phi) * k;
    this.radius += (this.tRadius - this.radius) * k;
    this.target.lerp(this.tTarget, k);

    const sp = Math.sin(this.phi), cp = Math.cos(this.phi);
    this.cam.position.set(
      this.target.x + this.radius * sp * Math.sin(this.theta),
      this.target.y + this.radius * cp,
      this.target.z + this.radius * sp * Math.cos(this.theta)
    );
    this.cam.lookAt(this.target);
  };

  /** 由当前相机位置反推球坐标，避免飞行/直链后跳变 */
  Orbit.prototype.syncFromCamera = function () {
    const off = this.cam.position.clone().sub(this.target);
    this.radius = this.tRadius = off.length();
    this.theta = this.tTheta = Math.atan2(off.x, off.z);
    this.phi = this.tPhi = Math.acos(
      THREE.MathUtils.clamp(off.y / Math.max(off.length(), 0.001), -1, 1)
    );
    this.tTarget.copy(this.target);
  };

  GG.Orbit = Orbit;
})();
