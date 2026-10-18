/* ============================================================
   应用主程序
   ============================================================ */
(function () {
  const GG = window.GG;
  GG.debug = GG.debug || {};
  const V3 = THREE.Vector3;

  /* 开启色彩管理：hex 颜色按 sRGB 解释、内部转线性，
     否则 r149 默认 legacy 模式会把所有颜色当成线性值，导致画面整体发灰发白 */
  if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;

  let scene, camera, renderer, raycaster;
  let orbit;
  let registry = [];
  let labels = [];
  let hovered = null, selected = null;
  let ring, ringTarget = 0, ringScale = 1;
  let clock;
  let labelFrame = 0;
  let navList = [];

  const dom = {};
  const DEG = Math.PI / 180;
  const C_SUN_LOW = new THREE.Color(0xff9a4e);
  const C_SUN_HIGH = new THREE.Color(0xfffaf0);
  const C_SKY_TOP_LOW = new THREE.Color(0x38496c);
  const C_SKY_TOP_HIGH = new THREE.Color(0x4274ad);
  const C_SKY_BOT_LOW = new THREE.Color(0xe0a687);
  const C_SKY_BOT_HIGH = new THREE.Color(0xd2e2ef);
  const C_AMB_LOW = new THREE.Color(0xd8bda6);
  const C_AMB_HIGH = new THREE.Color(0xcddced);

  const sunDirV = new V3(0.4, 0.8, 0.4);
  const _c1 = new THREE.Color();
  const _c2 = new THREE.Color();

  /* t: 0=日出 0.5=正午 1=日落 */
  function setSun(t) {
    t = Math.max(0, Math.min(1, t));
    const k = Math.sin(t * Math.PI);            // 太阳高度系数
    const el = (k * 62 + 5) * DEG;
    const az = (-78 + t * 156) * DEG;
    sunDirV.set(
      Math.sin(az) * Math.cos(el),
      Math.sin(el),
      Math.cos(az) * Math.cos(el)
    ).normalize();

    light.sun.position.set(sunDirV.x * 700, sunDirV.y * 760, sunDirV.z * 700);
    light.sun.color.copy(_c1.copy(C_SUN_LOW).lerp(C_SUN_HIGH, k));
    light.sun.intensity = (1.0 + k * 0.9) * (GG.debug.sunMul || 1);

    light.amb.intensity = 0.18 + (1 - k) * 0.12;
    light.amb.color.copy(_c2.copy(C_AMB_LOW).lerp(C_AMB_HIGH, k));
    light.hemi.intensity = 0.30 + (1 - k) * 0.14;
    light.hemi.color.copy(_c1.copy(C_SKY_BOT_LOW).lerp(C_SKY_BOT_HIGH, k));

    skyMat.uniforms.top.value.copy(_c1.copy(C_SKY_TOP_LOW).lerp(C_SKY_TOP_HIGH, k));
    skyMat.uniforms.bottom.value.copy(_c2.copy(C_SKY_BOT_LOW).lerp(C_SKY_BOT_HIGH, k));
    skyMat.uniforms.sunDir.value.copy(sunDirV);
    skyMat.uniforms.sunColor.value.copy(_c1.copy(C_SUN_LOW).lerp(C_SUN_HIGH, k));
    skyMat.uniforms.cloudAmt.value = 0.72 + k * 0.2;

    scene.fog.color.copy(_c2.copy(C_SKY_BOT_LOW).lerp(C_SKY_BOT_HIGH, k)).lerp(new THREE.Color(0xb9c4d1), 0.55);
    skyMat.uniforms.haze.value.copy(scene.fog.color).lerp(new THREE.Color(0xffffff), 0.08);
    renderer.toneMappingExposure = (0.82 + k * 0.06) * (GG.debug.exposure || 1);
  }

  /* URL 快捷：?time=dawn|noon|dusk 或 0~1 的数值 */
  const TIME_T = { dawn: 0.14, noon: 0.5, dusk: 0.88 };
  function setTime(key) {
    let t = TIME_T[key];
    if (t == null) {
      const n = parseFloat(key);
      t = isNaN(n) ? 0.5 : n;
    }
    setSun(t);
    const sl = document.getElementById('sun');
    if (sl) sl.value = String(Math.round(t * 100));
  }

  /* ============================================================
     轨道控制器（自实现，含阻尼 / 触控 / 平移 / 缩放）
     ============================================================ */
  function Orbit(cam, dom) {
    this.cam = cam;
    this.dom = dom;
    this.target = new V3(0, 10, 40);
    this.theta = 0;
    this.phi = 1.0;
    this.radius = 900;
    this.tTheta = this.theta;
    this.tPhi = this.phi;
    this.tRadius = this.radius;
    this.tTarget = this.target.clone();
    this.enabled = true;
    this.autoRotate = false;
    this.damp = 0.12;
    this.minR = 26;
    this.maxR = 1700;
    this.minPhi = 0.08;
    this.maxPhi = 1.47;
    this._bind();
    this.update(0);
  }

  Orbit.prototype._bind = function () {
    const el = this.dom;
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
    };

    const move = (e) => {
      if (!pointers.has(e.pointerId)) return;
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
        this.tTarget.x = THREE.MathUtils.clamp(this.tTarget.x, -460, 460);
        this.tTarget.z = THREE.MathUtils.clamp(this.tTarget.z, -560, 560);
        this.tTarget.y = THREE.MathUtils.clamp(this.tTarget.y, -10, 140);
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
      e.preventDefault();
      const k = Math.exp(e.deltaY * 0.0011);
      this.tRadius *= k;
      this._clamp();
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

  /* ============================================================
     相机飞行
     ============================================================ */
  let fly = null;
  function flyTo(pos, target, dur) {
    const p0 = camera.position.clone();
    const p1 = new V3(pos[0], pos[1], pos[2]);
    const mid = p0.clone().lerp(p1, 0.5);
    mid.y += Math.min(p0.distanceTo(p1) * 0.22, 210);
    fly = {
      start: performance.now(),
      dur: (dur || 1.5) * 1000,
      p0, p1, mid,
      t0: orbit.target.clone(),
      t1: new V3(target[0], target[1], target[2])
    };
  }

  function stepFly() {
    if (!fly) return;
    const u = Math.min(1, (performance.now() - fly.start) / fly.dur);
    const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    const a = 1 - e;
    camera.position.set(
      a * a * fly.p0.x + 2 * a * e * fly.mid.x + e * e * fly.p1.x,
      a * a * fly.p0.y + 2 * a * e * fly.mid.y + e * e * fly.p1.y,
      a * a * fly.p0.z + 2 * a * e * fly.mid.z + e * e * fly.p1.z
    );
    orbit.target.lerpVectors(fly.t0, fly.t1, e);
    orbit.tTarget.copy(orbit.target);
    camera.lookAt(orbit.target);

    // 同步球坐标，避免飞行结束后跳变
    const off = camera.position.clone().sub(orbit.target);
    orbit.radius = orbit.tRadius = off.length();
    orbit.theta = orbit.tTheta = Math.atan2(off.x, off.z);
    orbit.phi = orbit.tPhi = Math.acos(THREE.MathUtils.clamp(off.y / Math.max(off.length(), 0.001), -1, 1));

    if (u >= 1) fly = null;
  }

  /* ============================================================
     标签
     ============================================================ */
  function makeLabel(entry, idx) {
    const el = document.createElement('div');
    el.className = 'lbl';
    el.dataset.idx = idx;
    const info = entry.userData.info || {};
    const p = info.prio == null ? (Math.abs(entry.position.x) < 2 ? 0 : 1) : info.prio;
    el.dataset.prio = p;
    el.innerHTML =
      '<span class="lbl-line"></span>' +
      '<span class="lbl-body"><span class="lbl-name">' + (info.name || '') + '</span></span>';
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      selectBuilding(entry);
    });
    el.addEventListener('pointerenter', () => setHover(entry));
    el.addEventListener('pointerleave', () => setHover(null));
    dom.labels.appendChild(el);

    const wp = new V3(0, entry.userData.labelY || 20, 0);
    entry.localToWorld(wp);

    return {
      el, entry, world: wp, prio: +p,
      w: 0, h: 0,
      screen: new V3(),
      visible: true
    };
  }

  function updateLabels() {
    const W = dom.canvas.clientWidth, H = dom.canvas.clientHeight;
    const camPos = camera.position;
    const occupied = [];
    const showAll = dom.labels.classList.contains('show-all');
    const viewDist = camera.position.distanceTo(orbit.target);
    const farLimit = Math.max(340, viewDist * 0.82);

    // 按优先级 + 距离排序
    const list = labels.slice().sort((a, b) => {
      if (a.prio !== b.prio) return a.prio - b.prio;
      return a.world.distanceToSquared(camPos) - b.world.distanceToSquared(camPos);
    });

    for (const L of list) {
      const p = L.screen.copy(L.world).project(camera);
      const behind = p.z > 1 || p.z < -1;
      const dist = L.world.distanceTo(camPos);

      // 距离过滤（阈值随视野尺度自适应）
      let show = !behind;
      if (show && !showAll) {
        if (L.prio > 0 && dist > farLimit) show = false;
        if (L.prio > 1 && dist > farLimit * 0.55) show = false;
      }
      if (show && dist > 1500) show = false;

      if (!show) {
        if (L.visible) { L.el.style.opacity = '0'; L.el.style.pointerEvents = 'none'; L.visible = false; }
        continue;
      }

      const x = (p.x * 0.5 + 0.5) * W;
      const y = (-p.y * 0.5 + 0.5) * H;

      if (!L.w) { L.w = L.el.offsetWidth || 80; L.h = L.el.offsetHeight || 24; }
      const sc = THREE.MathUtils.clamp(260 / Math.max(dist, 1), 0.62, 1.05);
      const hw = (L.w * sc) / 2, hh = (L.h * sc) / 2;

      // 简单矩形避让
      const rect = { l: x - hw, r: x + hw, t: y - hh - 6, b: y + hh };
      let overlap = false;
      for (const o of occupied) {
        if (rect.l < o.r && rect.r > o.l && rect.t < o.b && rect.b > o.t) { overlap = true; break; }
      }
      if (overlap && !(selected === L.entry)) {
        if (L.visible) { L.el.style.opacity = '0'; L.el.style.pointerEvents = 'none'; L.visible = false; }
        continue;
      }
      occupied.push(rect);

      L.el.style.transform = `translate(-50%,-100%) translate3d(${x}px,${y}px,0) scale(${sc})`;
      const isHover = hovered === L.entry;
      const isSel = selected === L.entry;
      L.el.style.opacity = isSel ? '1' : (isHover ? '1' : String(THREE.MathUtils.clamp(1.25 - dist / 900, 0.35, 0.92)));
      L.el.style.zIndex = String(isSel ? 90 : isHover ? 80 : 10 + (100 - L.prio * 10));
      L.el.style.pointerEvents = 'auto';
      L.el.classList.toggle('is-hover', isHover);
      L.el.classList.toggle('is-sel', isSel);
      L.visible = true;
    }
  }

  /* ============================================================
     拾取 / 选中
     ============================================================ */
  function pickAt(clientX, clientY) {
    const rect = dom.canvas.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(registry, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.isBuilding) o = o.parent;
      if (o) return o;
    }
    return null;
  }

  /* 悬停高亮：懒克隆材质，只改 emissive，不重编译 shader */
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
    const c = m.clone();
    c.emissive = new THREE.Color(0x6a4a12);
    c.emissiveIntensity = 0.5;
    return c;
  }

  function highlight(group, on) {
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
  }

  function setHover(entry) {
    if (hovered === entry) return;
    if (hovered) {
      hovered.userData._hover = false;
      highlight(hovered, false);
    }
    hovered = entry;
    if (entry) {
      entry.userData._hover = true;
      highlight(entry, true);
      const v = new V3();
      entry.getWorldPosition(v);
      const r = entry.userData.pickRadius || 30;
      ring.position.set(v.x, 0.9, v.z);
      ringScale = r * 1.15;
      ringTarget = 1;
      dom.canvas.style.cursor = 'pointer';
    } else {
      ringTarget = 0;
      dom.canvas.style.cursor = 'grab';
    }
  }

  function selectBuilding(entry) {
    selected = entry;
    const info = entry.userData.info || {};
    dom.infoName.textContent = info.name || '';
    dom.infoEn.textContent = info.en || '';
    dom.infoCat.textContent = info.cat || '';
    dom.infoYear.textContent = info.year || '';
    dom.infoDesc.textContent = info.desc || '';
    dom.info.classList.add('open');

    // 列表高亮
    [...dom.list.querySelectorAll('.li')].forEach((li) => {
      li.classList.toggle('active', li.dataset.name === info.name);
    });

    setHover(entry);
  }

  function focusBuilding(entry) {
    const v = new V3();
    entry.getWorldPosition(v);
    const r = entry.userData.pickRadius || 30;
    const lblY = entry.userData.labelY || 20;
    const dist = Math.max(52, r * 3.2);
    flyTo(
      [v.x + dist * 0.30, lblY * 0.86 + 16, v.z + dist * 0.86],
      [v.x, lblY * 0.32, v.z],
      1.5
    );
    selectBuilding(entry);
  }

  function navigate(dir) {
    if (!selected || !navList.length) return;
    const i = navList.indexOf(selected);
    if (i < 0) return;
    const next = navList[(i + dir + navList.length) % navList.length];
    focusBuilding(next);
  }

  function closeInfo() {
    selected = null;
    dom.info.classList.remove('open');
    [...dom.list.querySelectorAll('.li')].forEach((li) => li.classList.remove('active'));
    setHover(null);
  }

  /* ============================================================
     视角预设
     ============================================================ */
  const VIEWS = {
    overview: { p: [0, 520, 950], t: [0, 4, 10], name: '全景' },
    axis: { p: [0, 88, 596], t: [0, 44, 120], name: '中轴' },
    taihe: { p: [0, 78, 452], t: [0, 18, 150], name: '太和殿广场' },
    close: { p: [0, 48, 254], t: [0, 30, 148], name: '太和殿' },
    detail: { p: [26, 26, 214], t: [0, 22, 152], name: '细部' },
    inner: { p: [0, 96, -78], t: [0, 14, -242], name: '后三宫' },
    garden: { p: [0, 62, -276], t: [0, 10, -414], name: '御花园' },
    shenwu: { p: [150, 74, -252], t: [-6, 24, -452], name: '神武门' },
    top: { p: [0, 980, 150], t: [0, 0, 16], name: '俯瞰' },
    corner: { p: [556, 300, 622], t: [-30, 14, 116], name: '东南角' }
  };

  function syncOrbitFromCamera() {
    const off = camera.position.clone().sub(orbit.target);
    orbit.radius = orbit.tRadius = off.length();
    orbit.theta = orbit.tTheta = Math.atan2(off.x, off.z);
    orbit.phi = orbit.tPhi = Math.acos(THREE.MathUtils.clamp(off.y / Math.max(off.length(), 0.001), -1, 1));
    orbit.tTarget.copy(orbit.target);
  }

  function applyViewInstant(key) {
    const v = VIEWS[key];
    if (!v) return;
    camera.position.set(v.p[0], v.p[1], v.p[2]);
    orbit.target.set(v.t[0], v.t[1], v.t[2]);
    camera.lookAt(orbit.target);
    syncOrbitFromCamera();
    [...dom.views.querySelectorAll('button')].forEach((b) => {
      b.classList.toggle('active', b.dataset.view === key);
    });
  }

  function setView(key) {
    const v = VIEWS[key];
    if (!v) return;
    flyTo(v.p, v.t, 1.6);
    [...dom.views.querySelectorAll('button')].forEach((b) => {
      b.classList.toggle('active', b.dataset.view === key);
    });
  }

  let light = {};

  let skyMat, skyDome;

  /* ============================================================
     初始化
     ============================================================ */
  function init() {
    const canvas = document.getElementById('scene');
    const setStep = (label, pct) => {
      const bar = document.getElementById('load-bar');
      const txt = document.getElementById('load-text');
      if (bar) bar.style.width = pct + '%';
      if (txt) txt.textContent = label;
    };
    setStep('起 基', 12);
    dom.canvas = canvas;
    dom.labels = document.getElementById('labels');
    dom.list = document.getElementById('list');
    dom.info = document.getElementById('info');
    dom.infoName = document.getElementById('info-name');
    dom.infoEn = document.getElementById('info-en');
    dom.infoCat = document.getElementById('info-cat');
    dom.infoYear = document.getElementById('info-year');
    dom.infoDesc = document.getElementById('info-desc');
    dom.views = document.getElementById('views');
    dom.time = document.getElementById('time');

    renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.9));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xc3cdd8, 0.00026);

    /* 程序化环境贴图：让琉璃瓦 / 石材有真实反射 */
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
      const es = new THREE.Scene();
      const envSky = new THREE.Mesh(
        new THREE.SphereGeometry(100, 24, 16),
        new THREE.ShaderMaterial({
          uniforms: {
            top: { value: new THREE.Color(0x6fa8d8) },
            bot: { value: new THREE.Color(0xe8e2d2) },
            gnd: { value: new THREE.Color(0x8f8878) }
          },
          vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
          fragmentShader: 'uniform vec3 top; uniform vec3 bot; uniform vec3 gnd; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(bot, top, pow(h, 0.55)) : mix(bot, gnd, pow(-h, 0.4)); gl_FragColor = vec4(c, 1.0); }',
          side: THREE.BackSide
        })
      );
      es.add(envSky);
      scene.environment = pmrem.fromScene(es, 0.03).texture;
      pmrem.dispose();
    } catch (e) { /* 环境贴图失败不影响主流程 */ }

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.8, 8000);
    camera.position.set(0, 1400, 1900);

    /* 天空：渐变 + 日轮 + 程序化云 + 地平线灰霾（单 pass，无额外几何） */
    skyMat = new THREE.ShaderMaterial({
      uniforms: {
        top: { value: new THREE.Color(0x2f6fbe) },
        bottom: { value: new THREE.Color(0xd8e6f2) },
        haze: { value: new THREE.Color(0xc3cdd8) },
        sunDir: { value: new V3(0.3, 0.9, 0.4) },
        sunColor: { value: new THREE.Color(0xfff4de) },
        uTime: { value: 0 },
        cloudAmt: { value: 0.88 }
      },
      vertexShader: `
        varying vec3 vDir;
        void main(){
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 top; uniform vec3 bottom; uniform vec3 haze;
        uniform vec3 sunDir; uniform vec3 sunColor;
        uniform float uTime; uniform float cloudAmt;
        varying vec3 vDir;

        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
        float vnoise(vec2 p){
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }
        float fbm(vec2 p){
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * vnoise(p);
            p = p * 2.07 + vec2(9.1, 5.3);
            a *= 0.5;
          }
          return v;
        }

        void main(){
          vec3 d = normalize(vDir);
          float h = d.y;

          float t = pow(clamp(h, 0.0, 1.0), 0.5);
          vec3 c = mix(bottom, top, t);
          // 地平线灰霾：与场景雾色一致，让地面与天空无缝
          c = mix(c, haze, smoothstep(0.18, -0.05, h));

          float sd = max(dot(d, normalize(sunDir)), 0.0);
          c += sunColor * pow(sd, 900.0) * 5.0;
          c += sunColor * pow(sd, 9.0) * 0.20;
          c += sunColor * pow(sd, 2.0) * 0.05;

          if (h > 0.002) {
            vec2 p = d.xz / (h + 0.16);
            float n = fbm(p * 0.55 + vec2(uTime * 0.0035, uTime * 0.0012)) * 0.72
                    + fbm(p * 1.90 + vec2(-uTime * 0.006, 3.7)) * 0.38;
            float dens = smoothstep(0.46, 0.88, n);
            dens *= smoothstep(0.0, 0.10, h) * cloudAmt;
            vec3 cc = mix(vec3(0.52, 0.56, 0.64), vec3(1.0, 0.985, 0.95), smoothstep(0.2, 0.95, dens));
            cc = mix(cc, sunColor, pow(sd, 2.5) * 0.4);
            c = mix(c, cc, dens * 0.94);
          }

          gl_FragColor = vec4(c, 1.0);
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(3200, 32, 20), skyMat);
    scene.add(sky);
    skyDome = sky;

    /* 光照 */
    light.amb = new THREE.AmbientLight(0xe6edf5, 0.22);
    scene.add(light.amb);
    light.hemi = new THREE.HemisphereLight(0xdfeaf4, 0x8d8570, 0.42);
    scene.add(light.hemi);
    light.sun = new THREE.DirectionalLight(0xfff4de, 2.4);
    light.sun.position.set(200, 660, 260);
    light.sun.castShadow = true;
    light.sun.shadow.mapSize.set(4096, 4096);
    const sc = light.sun.shadow.camera;
    sc.left = -760; sc.right = 760; sc.top = 820; sc.bottom = -820;
    sc.near = 120; sc.far = 2400;
    sc.updateProjectionMatrix();
    light.sun.shadow.bias = -0.0004;
    light.sun.shadow.normalBias = 0.05;
    scene.add(light.sun);
    scene.add(light.sun.target);

    /* 地面光圈（悬停指示） */
    ring = new THREE.Mesh(
      new THREE.RingGeometry(0.86, 1, 64),
      new THREE.MeshBasicMaterial({
        color: 0xe8c15a, transparent: true, opacity: 0,
        side: THREE.DoubleSide, depthWrite: false
      })
    );
    ring.rotation.x = -Math.PI / 2;
    scene.add(ring);

    /* 模型 */
    registry = GG.layout(scene);
    setStep('覆 瓦', 72);
    scene.updateMatrixWorld(true);

    /* 未显式设置过的材质统一压低环境反射强度：
       否则这些材质会以 envMapIntensity=1 全量吸收环境贴图，整片发白 */
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) {
        if (m && m.isMeshStandardMaterial && m.envMapIntensity === 1) m.envMapIntensity = 0.22;
      }
    });

    /* 标签 */
    registry.forEach((g, i) => {
      if (!g.userData.info || !g.userData.info.name) return;
      labels.push(makeLabel(g, i));
    });

    /* 建筑索引 */
    buildList();
    setStep('铺 陈', 90);

    orbit = new Orbit(camera, canvas);
    orbit.target.set(0, 6, 40);
    orbit.tTarget.copy(orbit.target);
    orbit.radius = 2200;
    orbit.tRadius = 2200;
    orbit.phi = orbit.tPhi = 0.95;
    orbit.theta = orbit.tTheta = 0;

    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();
    clock = new THREE.Clock();

    /* 事件 */
    canvas.addEventListener('pointermove', (e) => {
      if (e.buttons) return;
      const g = pickAt(e.clientX, e.clientY);
      setHover(g);
    });
    canvas.addEventListener('click', (e) => {
      const g = pickAt(e.clientX, e.clientY);
      if (g) selectBuilding(g);
      else closeInfo();
    });

    document.getElementById('info-close').addEventListener('click', closeInfo);

    const sunSlider = document.getElementById('sun');
    sunSlider.addEventListener('input', () => setSun(sunSlider.value / 100));

    document.getElementById('info-focus').addEventListener('click', () => {
      if (selected) focusBuilding(selected);
    });
    document.getElementById('info-prev').addEventListener('click', () => navigate(-1));
    document.getElementById('info-next').addEventListener('click', () => navigate(1));
    document.querySelectorAll('#views button').forEach((b) => {
      b.addEventListener('click', () => setView(b.dataset.view));
    });
    document.getElementById('btn-rotate').addEventListener('click', (e) => {
      orbit.autoRotate = !orbit.autoRotate;
      e.currentTarget.classList.toggle('active', orbit.autoRotate);
    });
    document.getElementById('btn-labels').addEventListener('click', (e) => {
      dom.labels.classList.toggle('show-all');
      document.body.classList.toggle('hide-labels');
      e.currentTarget.classList.toggle('active');
    });
    window.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = e.key;
      const map = {
        '1': 'overview', '2': 'axis', '3': 'taihe', '4': 'close',
        '5': 'inner', '6': 'garden', '7': 'shenwu', '8': 'top', '9': 'corner'
      };
      if (map[k]) { setView(map[k]); return; }
      if (k === 'r' || k === 'R') { closeInfo(); setView('overview'); return; }
      if (k === 'Escape') { closeInfo(); return; }
      if (k === ' ') {
        e.preventDefault();
        orbit.autoRotate = !orbit.autoRotate;
        document.getElementById('btn-rotate').classList.toggle('active', orbit.autoRotate);
      }
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
      closeInfo();
      setView('overview');
    });
    document.getElementById('panel-toggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('collapsed');
    });

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      labels.forEach((l) => { l.w = 0; });
    });

    /* 调试/直链：?view=close 直接定位，跳过飞行动画
       ?pos=x,y,z&tgt=x,y,z 可指定任意机位（调试用）
       ?exposure=0.9&sunmul=1.2 可微调曝光与日照强度（调试用） */
    const q = new URLSearchParams(location.search);
    GG.debug = {
      exposure: parseFloat(q.get('exposure')) || 1,
      sunMul: parseFloat(q.get('sunmul')) || 1
    };
    const qTime = q.get('time');
    setTime(qTime || 'noon');

    const qp = q.get('pos');
    const qt = q.get('tgt');
    if (qp) {
      const a = qp.split(',').map(Number);
      camera.position.set(a[0], a[1], a[2]);
      if (qt) {
        const b = qt.split(',').map(Number);
        orbit.target.set(b[0], b[1], b[2]);
      } else {
        orbit.target.set(0, 20, 0);
      }
      camera.lookAt(orbit.target);
      syncOrbitFromCamera();
    }

    const qv = q.get('view');
    if (!qp && qv && VIEWS[qv]) {
      applyViewInstant(qv);
      const qs = q.get('select');
      if (qs) {
        const target = registry.find((x) => x.userData.info && x.userData.info.name === qs);
        if (target) setTimeout(() => selectBuilding(target), 180);
      }
    }

    setStep('成 金', 100);
    setTimeout(() => document.getElementById('loader').classList.add('done'), 260);
    if (!qv && !qp) setTimeout(() => setView('overview'), 480);

    animate();
  }

  function buildList() {
    const groups = {};
    const order = ['前朝', '后寝', '东路', '西路', '城防'];
    for (const g of registry) {
      const info = g.userData.info;
      if (!info || !info.name) continue;
      const c = info.cat || '其他';
      (groups[c] = groups[c] || []).push(info);
    }
    let html = '';
    for (const c of order) {
      if (!groups[c]) continue;
      html += `<div class="li-group">${c}</div>`;
      const seen = new Set();
      for (const info of groups[c]) {
        if (seen.has(info.name)) continue;
        seen.add(info.name);
        html += `<div class="li" data-name="${info.name}"><span class="dot"></span>${info.name}</div>`;
      }
    }
    dom.list.innerHTML = html;
    navList = [...dom.list.querySelectorAll('.li')]
      .map((li) => registry.find((x) => x.userData.info && x.userData.info.name === li.dataset.name))
      .filter(Boolean);
    dom.list.querySelectorAll('.li').forEach((li) => {
      li.addEventListener('click', () => {
        const g = registry.find((x) => x.userData.info && x.userData.info.name === li.dataset.name);
        if (!g) return;
        focusBuilding(g);
      });
    });
  }

  /* ============================================================
     主循环
     ============================================================ */
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    stepFly();
    if (!fly) orbit.update(dt);

    // 光圈动画
    ring.material.opacity += (ringTarget * 0.55 - ring.material.opacity) * 0.14;
    ring.scale.setScalar(ring.scale.x + (ringScale - ring.scale.x) * 0.16);
    if (ring.material.opacity > 0.01) {
      ring.rotation.z += dt * 0.35;
    }

    labelFrame++;
    if (labelFrame % 2 === 0) updateLabels();

    // 天空：云缓慢飘移，穹顶跟随相机保证地平线稳定
    if (skyMat) {
      skyMat.uniforms.uTime.value += dt;
      if (skyDome) skyDome.position.copy(camera.position);
    }

    const wm = GG.build.MAT && GG.build.MAT.water;
    if (wm && wm.map) {
      wm.map.offset.x += dt * 0.006;
      wm.map.offset.y += dt * 0.002;
    }

    renderer.render(scene, camera);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
