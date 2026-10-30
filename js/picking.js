/* ============================================================
   拾取与悬停高亮
   Raycaster 命中建筑组；高亮用懒克隆材质改 emissive，
   不重新编译 shader，也不会污染其它建筑。
   地面光圈也归这里管。
   ============================================================ */
(function () {
  const GG = (window.GG = window.GG || {});
  const V3 = THREE.Vector3;

  function Picker(opts) {
    this.canvas = opts.canvas;
    this.camera = opts.camera;
    this.scene = opts.scene;
    this.registry = opts.registry;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.hovered = null;

    this._ringTarget = 0;
    this._ringScale = 1;
    this.selected = null;
    this._selRingTarget = 0;
    this._selRingScale = 1;

    const R = GG.CONFIG.ring;
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(R.inner, R.outer, 64),
      new THREE.MeshBasicMaterial({
        color: R.color, transparent: true, opacity: 0,
        side: THREE.DoubleSide, depthWrite: false
      })
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.renderOrder = 3;
    this.scene.add(this.ring);

    /* 选中态光圈：悬停离开后仍留在选中建筑脚下，缓慢呼吸。
       比悬停光圈大一圈、低一线，两个光圈叠成同心环 */
    this.selRing = new THREE.Mesh(
      new THREE.RingGeometry(R.inner * 0.88, R.outer * 1.07, 72),
      new THREE.MeshBasicMaterial({
        color: R.color, transparent: true, opacity: 0,
        side: THREE.DoubleSide, depthWrite: false
      })
    );
    this.selRing.rotation.x = -Math.PI / 2;
    this.selRing.renderOrder = 2;
    this.scene.add(this.selRing);
  }

  /** 选中 / 取消选中：光圈常驻，直到关闭信息卡或改选别处 */
  Picker.prototype.setSelected = function (entry) {
    if (this.selected === entry) return;
    this.selected = entry;
    if (entry) {
      const v = new V3();
      entry.getWorldPosition(v);
      const r = entry.userData.pickRadius || 30;
      this.selRing.position.set(v.x, 0.55, v.z);
      this._selRingScale = r * GG.CONFIG.ring.radiusFactor * 1.28;
      this._selRingTarget = 0.5;
    } else {
      this._selRingTarget = 0;
    }
  }

  Picker.prototype.pickAt = function (clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.registry, true);
    for (const h of hits) {
      /* 取"最外层的建筑祖先"，不是第一个 isBuilding：
         城门楼的正楼是 createHall 造的子 Group，它自己带 isBuilding，
         若在这里停下，点午门会选中里面的正楼 —— 高亮光圈跑到半空、
         标签对不上、聚焦机位也偏。拾取永远返回注册进 REG 的那一层。 */
      let o = h.object, outer = null;
      while (o) {
        if (o.userData.isBuilding) outer = o;
        o = o.parent;
      }
      if (outer) return outer;
    }
    return null;
  };

  /* 懒克隆材质，只改 emissive，不重编译 shader */
  function getMeshes(group) {
    if (!group.userData._meshes) {
      const arr = [];
      group.traverse((o) => {
        if (o.isMesh && !o.userData.noHighlight) arr.push(o);
      });
      group.userData._meshes = arr;
    }
    return group.userData._meshes;
  }

  function makeHi(m) {
    const H = GG.CONFIG.highlight;
    const c = m.clone();
    c.emissive = new THREE.Color(H.emissive);
    c.emissiveIntensity = H.intensity;
    return c;
  }

  Picker.prototype.highlight = function (group, on) {
    const list = getMeshes(group);
    for (const o of list) {
      if (on) {
        if (!o.userData.baseMat) o.userData.baseMat = o.material;
        if (!o.userData.hiMat) {
          const src = o.userData.baseMat;
          o.userData.hiMat = Array.isArray(src) ? src.map(makeHi) : makeHi(src);
        }
        o.material = o.userData.hiMat;
      } else if (o.userData.baseMat) {
        o.material = o.userData.baseMat;
      }
    }
  };

  Picker.prototype.setHover = function (entry) {
    if (this.hovered === entry) return;
    if (this.hovered) {
      this.hovered.userData._hover = false;
      this.highlight(this.hovered, false);
    }
    this.hovered = entry;
    if (entry) {
      entry.userData._hover = true;
      this.highlight(entry, true);
      const v = new V3();
      entry.getWorldPosition(v);
      const r = entry.userData.pickRadius || 30;
      this.ring.position.set(v.x, 0.9, v.z);
      this._ringScale = r * GG.CONFIG.ring.radiusFactor;
      this._ringTarget = 1;
      this.canvas.style.cursor = 'pointer';
    } else {
      this._ringTarget = 0;
      this.canvas.style.cursor = 'grab';
    }
  };

  /** 光圈动画，每帧调用：悬停圈旋转，选中圈呼吸 */
  Picker.prototype.update = function (dt) {
    const ring = this.ring;
    ring.material.opacity += (this._ringTarget * 0.55 - ring.material.opacity) * 0.14;
    ring.scale.setScalar(ring.scale.x + (this._ringScale - ring.scale.x) * 0.16);
    if (ring.material.opacity > 0.01) {
      ring.rotation.z += dt * 0.35;
    }
    const sel = this.selRing;
    const pulse = this._selRingTarget * (0.72 + 0.28 * Math.sin(performance.now() * 0.0021));
    sel.material.opacity += (pulse - sel.material.opacity) * 0.12;
    sel.scale.setScalar(sel.scale.x + (this._selRingScale - sel.scale.x) * 0.12);
  };

  GG.Picker = Picker;
})();
