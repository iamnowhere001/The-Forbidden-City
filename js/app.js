/* ============================================================
   应用主程序
   只做编排：创建舞台 → 布置场景 → 装配交互 → 主循环。
   ============================================================ */
(function () {
  const GG = window.GG;
  const C = GG.CONFIG;
  /* ?still=1：冻结相机、云层与水面动画，供截图回归做确定性比对 */
  const STILL = GG.query.get('still') === '1';

  let stage, orbit, views, labels, picker, ui;
  let registry = [];
  let selected = null;
  let clock;
  let labelFrame = 0;

  const dom = {};

  function setStep(label, pct) {
    const bar = document.getElementById('load-bar');
    const txt = document.getElementById('load-text');
    if (bar) bar.style.width = pct + '%';
    if (txt) txt.textContent = label;
  }

  /* ============================================================
     选中 / 信息卡
     ============================================================ */
  function selectBuilding(entry) {
    selected = entry;
    ui.show(entry.userData.info || {});
    picker.setHover(entry);
  }

  function focusBuilding(entry) {
    const v = new THREE.Vector3();
    entry.getWorldPosition(v);
    const r = entry.userData.pickRadius || 30;
    const lblY = entry.userData.labelY || 20;
    const dist = Math.max(52, r * 3.2);
    views.flyTo(
      [v.x + dist * 0.30, lblY * 0.86 + 16, v.z + dist * 0.86],
      [v.x, lblY * 0.32, v.z],
      1.5
    );
    selectBuilding(entry);
  }

  function navigate(dir) {
    const list = ui.items;
    if (!selected || !list.length) return;
    const i = list.indexOf(selected);
    if (i < 0) return;
    const next = list[(i + dir + list.length) % list.length];
    focusBuilding(next);
  }

  function closeInfo() {
    selected = null;
    ui.hide();
    picker.setHover(null);
  }

  /* ============================================================
     时间
     ============================================================ */
  function setTime(key) {
    let t = C.timePresets[key];
    if (t == null) {
      const n = parseFloat(key);
      t = isNaN(n) ? C.sun.defaultT : n;
    }
    stage.setSun(t);
    const sl = document.getElementById('sun');
    if (sl) sl.value = String(Math.round(t * 100));
  }

  /* ============================================================
     初始化
     ============================================================ */
  function init() {
    const canvas = document.getElementById('scene');
    setStep('起 基', 12);

    dom.canvas = canvas;
    dom.labels = document.getElementById('labels');
    dom.list = document.getElementById('list');
    dom.views = document.getElementById('views');

    ui = new GG.UI({
      listEl: dom.list,
      els: {
        info: document.getElementById('info'),
        name: document.getElementById('info-name'),
        en: document.getElementById('info-en'),
        cat: document.getElementById('info-cat'),
        year: document.getElementById('info-year'),
        desc: document.getElementById('info-desc'),
        meta: document.getElementById('info-meta'),
        note: document.getElementById('info-note'),
        noteText: document.getElementById('info-note-text')
      },
      onPick: focusBuilding
    });

    stage = new GG.Stage(canvas);

    /* 光圈先于场景布局创建：与 v0.9 的对象创建顺序保持一致，
       这样 ?seed=1 时两边的随机数流才对得上，截图可复现。 */
    picker = new GG.Picker({
      canvas, camera: stage.camera, scene: stage.scene, registry: []
    });

    registry = GG.layout(stage.scene);
    picker.registry = registry;
    setStep('覆 瓦', 72);
    stage.scene.updateMatrixWorld(true);
    stage.normalizeEnvIntensity(0.22);

    orbit = new GG.Orbit(stage.camera, canvas);
    const boot = C.orbit.boot;
    orbit.target.set(boot.target[0], boot.target[1], boot.target[2]);
    orbit.tTarget.copy(orbit.target);
    orbit.radius = orbit.tRadius = boot.radius;
    orbit.phi = orbit.tPhi = boot.phi;
    orbit.theta = orbit.tTheta = 0;

    labels = new GG.Labels({
      root: dom.labels,
      canvas,
      camera: stage.camera,
      orbit,
      onSelect: selectBuilding,
      onHover: (e) => picker.setHover(e),
      isHovered: (e) => picker.hovered === e,
      isSelected: (e) => selected === e
    });
    labels.build(registry);
    ui.build(registry);
    setStep('铺 陈', 90);

    views = new GG.Views({ camera: stage.camera, orbit, root: dom.views });

    clock = new THREE.Clock();
    bindEvents(canvas);
    readQuery();
    animate();
  }

  /* ============================================================
     事件绑定
     ============================================================ */
  function bindEvents(canvas) {
    canvas.addEventListener('pointermove', (e) => {
      if (e.buttons) return;
      picker.setHover(picker.pickAt(e.clientX, e.clientY));
    });
    canvas.addEventListener('click', (e) => {
      const g = picker.pickAt(e.clientX, e.clientY);
      if (g) selectBuilding(g);
      else closeInfo();
    });

    document.getElementById('info-close').addEventListener('click', closeInfo);
    document.getElementById('info-focus').addEventListener('click', () => {
      if (selected) focusBuilding(selected);
    });
    document.getElementById('info-prev').addEventListener('click', () => navigate(-1));
    document.getElementById('info-next').addEventListener('click', () => navigate(1));

    const sunSlider = document.getElementById('sun');
    sunSlider.addEventListener('input', () => stage.setSun(sunSlider.value / 100));

    document.getElementById('btn-rotate').addEventListener('click', (e) => {
      orbit.autoRotate = !orbit.autoRotate;
      e.currentTarget.classList.toggle('active', orbit.autoRotate);
    });
    document.getElementById('btn-labels').addEventListener('click', (e) => {
      dom.labels.classList.toggle('show-all');
      document.body.classList.toggle('hide-labels');
      e.currentTarget.classList.toggle('active');
    });
    document.getElementById('btn-reset').addEventListener('click', () => {
      closeInfo();
      views.set('overview');
    });
    document.getElementById('panel-toggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('collapsed');
    });

    // 键位从机位表生成，新增机位不用再改这里
    const keyMap = {};
    for (const v of C.views) if (v.key) keyMap[v.key] = v.id;

    window.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = e.key;
      if (keyMap[k]) { views.set(keyMap[k]); return; }
      if (k === 'r' || k === 'R') { closeInfo(); views.set('overview'); return; }
      if (k === 'Escape') { closeInfo(); return; }
      if (k === ' ') {
        e.preventDefault();
        orbit.autoRotate = !orbit.autoRotate;
        document.getElementById('btn-rotate').classList.toggle('active', orbit.autoRotate);
      }
    });

    window.addEventListener('resize', () => {
      stage.resize();
      labels.invalidate();
    });
  }

  /* ============================================================
     URL 参数
     ?view= / ?select= / ?time= / ?pos=&tgt= / ?exposure= / ?sunmul=
     ============================================================ */
  function readQuery() {
    const q = GG.query;
    const qTime = q.get('time');
    setTime(qTime || 'noon');

    const qp = q.get('pos');
    const qt = q.get('tgt');
    if (qp) {
      const a = qp.split(',').map(Number);
      stage.camera.position.set(a[0], a[1], a[2]);
      if (qt) {
        const b = qt.split(',').map(Number);
        orbit.target.set(b[0], b[1], b[2]);
      } else {
        orbit.target.set(0, 20, 0);
      }
      stage.camera.lookAt(orbit.target);
      orbit.syncFromCamera();
    }

    const qv = q.get('view');
    if (!qp && qv && views.get(qv)) {
      views.applyInstant(qv);
      const qs = q.get('select');
      if (qs) {
        const target = registry.find((x) => x.userData.info && x.userData.info.name === qs);
        if (target) setTimeout(() => selectBuilding(target), 180);
      }
    }

    setStep('成 金', 100);
    setTimeout(() => document.getElementById('loader').classList.add('done'), 260);
    if (!qv && !qp) setTimeout(() => views.set('overview'), 480);
  }

  /* ============================================================
     主循环
     ============================================================ */
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    if (!STILL) {
      views.step();
      if (!views.isFlying()) orbit.update(dt);
      stage.tick(dt);
    } else if (stage.skyDome) {
      // 冻结动画，但穹顶仍要跟随相机，否则地平线会偏
      stage.skyDome.position.copy(stage.camera.position);
    }

    picker.update(dt);

    labelFrame++;
    if (labelFrame % C.label.updateEvery === 0) labels.update();

    stage.render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
