/* ============================================================
   第一人称漫游
   与轨道控制器互斥：进入时 orbit.enabled=false，退出时把
   orbit.target / theta / phi / radius 从当前相机反算回来。

   碰撞是粗粒度的（R9）：注册建筑的包围盒 + 四面宫墙 AABB + 宫城内边界，
   只判 XZ、分轴滑动，不做逐构件碰撞、台阶与斜坡。城外胡同是实例化体块，
   没有逐院碰撞体，所以漫游范围限定在宫城以内。
   ============================================================ */
(function () {
  const GG = (window.GG = window.GG || {});
  const V3 = THREE.Vector3;
  const F = GG.CONFIG.fps;

  const MOVE = {
    w: 'f', arrowup: 'f', s: 'b', arrowdown: 'b',
    a: 'l', arrowleft: 'l', d: 'r', arrowright: 'r'
  };

  function FPS(opts) {
    this.camera = opts.camera;
    this.canvas = opts.canvas;
    this.orbit = opts.orbit;
    this.views = opts.views;
    this.picker = opts.picker;
    this.registry = opts.registry || [];
    this.onEnter = opts.onEnter || function () {};
    this.onExit = opts.onExit || function () {};

    this.active = false;
    this.keys = new Set();
    this.boxes = [];
    this.plaques = [];
    this.x = 0;
    this.z = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.frame = 0;
    this.drag = null;
    this.wantsLock = false;
    this.savedOrder = this.camera.rotation.order;
    this._anchor = new V3();
    this._pos = new V3();

    this.els = {
      plaque: document.getElementById('fps-plaque'),
      plaqueName: document.getElementById('fps-plaque-name')
    };

    this._bind();
  }

  /** 碰撞盒在首次进入时构建：此时静态合并已完成，包围盒是最终形态 */
  FPS.prototype.buildBoxes = function () {
    this.boxes = [];
    this.plaques = [];
    const box = new THREE.Box3();
    const B = F.bounds;
    const v = this._pos;
    for (const g of this.registry) {
      /* 匾额与碰撞是两套口径：殿身包围盒可能从台基顶起算（min.y > 4），
         但它仍然挂匾。这里只按词条与宫城范围收，不套碰撞过滤。 */
      const info = g.userData.info;
      if (info && info.name) {
        g.getWorldPosition(v);
        if (v.x >= B.minX && v.x <= B.maxX && v.z >= B.minZ && v.z <= B.maxZ) {
          this.plaques.push({
            name: info.name,
            en: info.en || info.name,
            x: v.x, z: v.z,
            /* 匾额在檐下，按标签高度折半近似（示意，不是测绘值） */
            y: Math.max(6, (g.userData.labelY || 20) * 0.55)
          });
        }
      }

      box.setFromObject(g);
      if (box.isEmpty() || !isFinite(box.min.x)) continue;
      if (box.min.y > 4 || box.max.y < 0.5) continue;       // 悬空或纯地下构件不挡人
      if (box.max.x < B.minX - 2 || box.min.x > B.maxX + 2 ||
          box.max.z < B.minZ - 2 || box.min.z > B.maxZ + 2) continue;
      const w = box.max.x - box.min.x, d = box.max.z - box.min.z;
      if (w > 700 || d > 700) continue;                     // 区域代理不当实体墙
      this.boxes.push({
        minX: box.min.x, maxX: box.max.x,
        minZ: box.min.z, maxZ: box.max.z
      });
    }
  };

  FPS.prototype.blocked = function (x, z) {
    const r = F.bodyRadius;
    const B = F.bounds;
    if (x < B.minX + r || x > B.maxX - r || z < B.minZ + r || z > B.maxZ - r) return true;
    for (const w of F.walls) {
      if (x > w[0] - r && x < w[2] + r && z > w[1] - r && z < w[3] + r) return true;
    }
    for (const b of this.boxes) {
      if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) return true;
    }
    return false;
  };

  /** 分轴滑动：撞墙时仍可沿墙走，不会整步卡死 */
  FPS.prototype.move = function (dx, dz) {
    const nx = this.x + dx, nz = this.z + dz;
    if (!this.blocked(nx, nz)) {
      this.x = nx; this.z = nz;
    } else {
      if (!this.blocked(nx, this.z)) this.x = nx;
      if (!this.blocked(this.x, nz)) this.z = nz;
    }
  };

  FPS.prototype.look = function (dx, dy) {
    this.yaw -= dx * F.lookSpeed;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - dy * F.lookSpeed, -F.maxPitch, F.maxPitch
    );
  };

  FPS.prototype._bind = function () {
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      const k = e.key.toLowerCase();
      if (k === 'shift') { this.keys.add('shift'); return; }
      if (!MOVE[k]) return;
      this.keys.add(MOVE[k]);
      e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'shift') this.keys.delete('shift');
      else if (MOVE[k]) this.keys.delete(MOVE[k]);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.drag = null;
    });

    /* 鼠标视角优先走 Pointer Lock；被拒或 ?fps=1 时退回按住左键拖拽 */
    document.addEventListener('mousemove', (e) => {
      if (!this.active || document.pointerLockElement !== this.canvas) return;
      this.look(e.movementX || 0, e.movementY || 0);
    });
    this.canvas.addEventListener('pointerdown', (e) => {
      if (!this.active || document.pointerLockElement === this.canvas) return;
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.active || !this.drag || this.drag.id !== e.pointerId) return;
      if (document.pointerLockElement === this.canvas) return;
      this.look(e.clientX - this.drag.x, e.clientY - this.drag.y);
      this.drag.x = e.clientX;
      this.drag.y = e.clientY;
    });
    const endDrag = () => { this.drag = null; };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    /* Esc 退出 Pointer Lock 时浏览器可能不派发 keydown，这里兜住退出动作 */
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.active && this.wantsLock) this.exit();
    });

    const exitBtn = document.getElementById('fps-exit');
    if (exitBtn) exitBtn.addEventListener('click', () => this.exit());
  };

  FPS.prototype.enter = function (opts) {
    if (this.active) return;
    const o = opts || {};
    this.buildBoxes();
    if (this.views && this.views.cancel) this.views.cancel();

    const tx = this.orbit.target.x, tz = this.orbit.target.z;
    const sorted = F.spawns.slice().sort((a, b) => {
      const da = (a.p[0] - tx) ** 2 + (a.p[2] - tz) ** 2;
      const db = (b.p[0] - tx) ** 2 + (b.p[2] - tz) ** 2;
      return da - db;
    });
    const spawn = sorted.find((s) => !this.blocked(s.p[0], s.p[2])) || sorted[0];
    this.x = spawn.p[0];
    this.z = spawn.p[2];
    this.yaw = spawn.yaw;
    this.pitch = 0;
    this.frame = 0;
    this.keys.clear();
    this.drag = null;

    this.savedOrder = this.camera.rotation.order;
    this.camera.rotation.order = 'YXZ';
    this.camera.position.set(this.x, F.eye, this.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    /* 两套相机状态互斥：轨道控制器不再写相机 */
    this.orbit.enabled = false;
    this.orbit.autoRotate = false;
    this.orbit.dragging = this.orbit.panning = false;
    this.active = true;
    document.body.classList.add('fps-on');
    if (this.els.plaque) this.els.plaque.hidden = true;

    this.wantsLock = !o.noLock;
    if (this.wantsLock) {
      try {
        const r = this.canvas.requestPointerLock && this.canvas.requestPointerLock();
        if (r && typeof r.catch === 'function') r.catch(() => { this.wantsLock = false; });
      } catch (e) {
        this.wantsLock = false;
      }
    }
    this.onEnter();
  };

  FPS.prototype.exit = function () {
    if (!this.active) return;
    this.active = false;
    this.keys.clear();
    this.drag = null;
    this.wantsLock = false;
    if (document.pointerLockElement) {
      try { document.exitPointerLock(); } catch (e) { /* 已由浏览器解除 */ }
    }

    this.orbit.enabled = true;
    this.camera.rotation.order = this.savedOrder;

    /* 从当前相机反算 orbit：注视点取正前方地面，phi 夹到合法区间 */
    const d = F.exitDistance;
    const tgt = new V3(
      this.camera.position.x - Math.sin(this.yaw) * d,
      0,
      this.camera.position.z - Math.cos(this.yaw) * d
    );
    this.orbit.target.copy(tgt);
    this.orbit.tTarget.copy(tgt);
    this.orbit.syncFromCamera();
    this.orbit.phi = this.orbit.tPhi = THREE.MathUtils.clamp(
      this.orbit.phi, this.orbit.minPhi, this.orbit.maxPhi
    );
    this.orbit.radius = this.orbit.tRadius = THREE.MathUtils.clamp(
      this.orbit.radius, this.orbit.minR, this.orbit.maxR
    );
    this.orbit.tTheta = this.orbit.theta;
    this.orbit.update(0);

    document.body.classList.remove('fps-on');
    if (this.els.plaque) this.els.plaque.hidden = true;
    if (this.picker) this.picker.setHover(null);
    this.onExit();
  };

  /** 抬头看匾：视线水平夹角与仰角都对上檐下匾额时，在画面上方浮出殿名。
      不用射线：平视时射线会从台基侧面穿过去，反而打不到挂在高处的匾。 */
  FPS.prototype.lookAtPlaque = function () {
    if (!this.els.plaque) return;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let best = null, bestD = Infinity;
    for (const p of this.plaques) {
      const dx = p.x - this.x, dz = p.z - this.z;
      const d = Math.hypot(dx, dz);
      if (d < 4 || d > 120) continue;
      const along = dx * fx + dz * fz;
      if (along <= 0) continue;
      if (Math.abs(dx * rx + dz * rz) / along > 0.28) continue;   // 约 15° 视锥
      const want = Math.atan2(p.y - F.eye, d);
      if (Math.abs(want - this.pitch) > 0.32) continue;           // 约 18° 仰角容差
      if (d < bestD) { bestD = d; best = p; }
    }
    if (!best) {
      this.els.plaque.hidden = true;
      return;
    }
    this.els.plaqueName.textContent = GG.i18n.lang === 'en' ? best.en : best.name;
    this.els.plaque.hidden = false;
  };

  FPS.prototype.anchor = function () {
    return this._anchor.set(
      this.x - Math.sin(this.yaw) * 60, 0, this.z - Math.cos(this.yaw) * 60
    );
  };

  FPS.prototype.update = function (dt) {
    if (!this.active) return;
    let f = (this.keys.has('f') ? 1 : 0) - (this.keys.has('b') ? 1 : 0);
    let r = (this.keys.has('r') ? 1 : 0) - (this.keys.has('l') ? 1 : 0);
    if (f || r) {
      const len = Math.hypot(f, r);
      f /= len; r /= len;
      const sp = (this.keys.has('shift') ? F.run : F.walk) * dt;
      const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
      this.move((-sy * f + cy * r) * sp, (-cy * f - sy * r) * sp);
    }
    this.camera.position.set(this.x, F.eye, this.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.frame++;
    if (this.frame % F.plaqueEvery === 0) this.lookAtPlaque();
  };

  GG.FPS = FPS;
})();
