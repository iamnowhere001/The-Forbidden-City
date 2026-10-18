/* ============================================================
   建筑标签
   世界坐标 → 屏幕投影，按优先级与距离过滤，再做矩形避让。
   阈值集中在 GG.CONFIG.label。
   ============================================================ */
(function () {
  const GG = (window.GG = window.GG || {});
  const V3 = THREE.Vector3;

  function Labels(opts) {
    this.root = opts.root;          // #labels
    this.canvas = opts.canvas;      // #scene，用于取视口尺寸
    this.camera = opts.camera;
    this.orbit = opts.orbit;
    this.onSelect = opts.onSelect || function () {};
    this.onHover = opts.onHover || function () {};
    this.isHovered = opts.isHovered || function () { return false; };
    this.isSelected = opts.isSelected || function () { return false; };
    this.items = [];
  }

  Labels.prototype.build = function (registry) {
    this.root.innerHTML = '';
    this.items = [];
    registry.forEach((g, i) => {
      if (!g.userData.info || !g.userData.info.name) return;
      this.items.push(this._make(g, i));
    });
  };

  Labels.prototype._make = function (entry, idx) {
    const C = GG.CONFIG.label;
    const el = document.createElement('div');
    el.className = 'lbl';
    el.dataset.idx = idx;
    const info = entry.userData.info || {};
    const p = info.prio == null
      ? (Math.abs(entry.position.x) < C.priorityCenterX ? 0 : 1)
      : info.prio;
    el.dataset.prio = p;
    el.innerHTML =
      '<span class="lbl-line"></span>' +
      '<span class="lbl-body"><span class="lbl-name">' + (info.name || '') + '</span></span>';

    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.onSelect(entry);
    });
    el.addEventListener('pointerenter', () => this.onHover(entry));
    el.addEventListener('pointerleave', () => this.onHover(null));
    this.root.appendChild(el);

    const wp = new V3(0, entry.userData.labelY || C.defaultY, 0);
    entry.localToWorld(wp);

    return {
      el, entry, world: wp, prio: +p,
      w: 0, h: 0,
      screen: new V3(),
      visible: true
    };
  };

  Labels.prototype.update = function () {
    const C = GG.CONFIG.label;
    const W = this.canvas.clientWidth, H = this.canvas.clientHeight;
    const cam = this.camera;
    const camPos = cam.position;
    const occupied = [];
    const showAll = this.root.classList.contains('show-all');
    const viewDist = camPos.distanceTo(this.orbit.target);
    const farLimit = Math.max(C.farLimitBase, viewDist * C.farLimitFactor);

    // 按优先级 + 距离排序
    const list = this.items.slice().sort((a, b) => {
      if (a.prio !== b.prio) return a.prio - b.prio;
      return a.world.distanceToSquared(camPos) - b.world.distanceToSquared(camPos);
    });

    for (const L of list) {
      const p = L.screen.copy(L.world).project(cam);
      const behind = p.z > 1 || p.z < -1;
      const dist = L.world.distanceTo(camPos);

      // 距离过滤（阈值随视野尺度自适应）
      let show = !behind;
      if (show && !showAll) {
        if (L.prio > 0 && dist > farLimit) show = false;
        if (L.prio > 1 && dist > farLimit * C.farLimitPrio2Factor) show = false;
      }
      if (show && dist > C.maxDistance) show = false;

      if (!show) {
        if (L.visible) {
          L.el.style.opacity = '0';
          L.el.style.pointerEvents = 'none';
          L.visible = false;
        }
        continue;
      }

      const x = (p.x * 0.5 + 0.5) * W;
      const y = (-p.y * 0.5 + 0.5) * H;

      if (!L.w) { L.w = L.el.offsetWidth || 80; L.h = L.el.offsetHeight || 24; }
      const sc = THREE.MathUtils.clamp(C.scaleRef / Math.max(dist, 1), C.scaleMin, C.scaleMax);
      const hw = (L.w * sc) / 2, hh = (L.h * sc) / 2;

      // 简单矩形避让
      const rect = { l: x - hw, r: x + hw, t: y - hh - C.rectTopPad, b: y + hh };
      let overlap = false;
      for (const o of occupied) {
        if (rect.l < o.r && rect.r > o.l && rect.t < o.b && rect.b > o.t) { overlap = true; break; }
      }
      if (overlap && !this.isSelected(L.entry)) {
        if (L.visible) {
          L.el.style.opacity = '0';
          L.el.style.pointerEvents = 'none';
          L.visible = false;
        }
        continue;
      }
      occupied.push(rect);

      L.el.style.transform = `translate(-50%,-100%) translate3d(${x}px,${y}px,0) scale(${sc})`;
      const isHover = this.isHovered(L.entry);
      const isSel = this.isSelected(L.entry);
      L.el.style.opacity = isSel || isHover
        ? '1'
        : String(THREE.MathUtils.clamp(
            C.opacityBase - dist / C.opacityRange, C.opacityMin, C.opacityMax
          ));
      L.el.style.zIndex = String(isSel ? 90 : isHover ? 80 : 10 + (100 - L.prio * 10));
      L.el.style.pointerEvents = 'auto';
      L.el.classList.toggle('is-hover', isHover);
      L.el.classList.toggle('is-sel', isSel);
      L.visible = true;
    }
  };

  /** 视口变化后强制重新测量标签尺寸 */
  Labels.prototype.invalidate = function () {
    for (const L of this.items) L.w = 0;
  };

  GG.Labels = Labels;
})();
