/* ============================================================
   应用主程序
   只做编排：创建舞台 → 布置场景 → 装配交互 → 主循环。
   ============================================================ */
(function () {
  const GG = window.GG;
  const C = GG.CONFIG;
  /* ?still=1：冻结相机、云层与水面动画，供截图回归做确定性比对 */
  const STILL = GG.query.get('still') === '1';

  let stage, orbit, views, labels, picker, ui, tour;
  let registry = [];
  let selected = null;
  let clock;
  let labelFrame = 0;
  let toastTimer = null;
  let dayPlay = false;                 // 昼夜流转开关
  let dayDir = 1;                      // 1 = 晨→暮，-1 = 暮→晨（往返）
  let dayT = C.sun.defaultT;           // 当前时刻（与滑块同步）
  let compassRose = null;              // 指北针罗盘（随视线旋转）
  let lastRoseDeg = null;
  let statsEl = null;                  // ?stats=1 性能面板
  let statsAcc = 0;
  let statsFrames = 0;
  const _v3 = new THREE.Vector3();

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
    const spot = views.spotFor(entry);
    views.moveTo(spot.p, spot.t, 1.5);
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
    dayT = Math.max(0, Math.min(1, t));
    stage.setSun(dayT);
    const sl = document.getElementById('sun');
    if (sl) sl.value = String(Math.round(dayT * 100));
  }

  /* ---------- 昼夜流转：45 秒单程，往返约 90 秒一昼夜 ---------- */
  function setDayPlay(on) {
    if (STILL) return;                 // 冻结模式下不开动画
    dayPlay = !!on;
    const b = document.getElementById('btn-tplay');
    if (b) {
      b.textContent = dayPlay ? '⏸' : '▶';
      b.classList.toggle('active', dayPlay);
      b.setAttribute('aria-pressed', String(dayPlay));
    }
  }

  function stepDay(dt) {
    dayT += dayDir * dt / 45;
    if (dayT >= 1) { dayT = 1; dayDir = -1; }
    else if (dayT <= 0) { dayT = 0; dayDir = 1; }
    stage.setSun(dayT);
    const sl = document.getElementById('sun');
    if (sl) sl.value = String(Math.round(dayT * 100));
  }

  /* ============================================================
     指北针：罗盘随视线旋转，点击回正北
     ============================================================ */
  function updateCompass() {
    if (!compassRose) return;
    _v3.copy(orbit.target).sub(stage.camera.position);
    // 量化到 0.1°：视线不动时不反复写 DOM
    const deg = Math.round(-Math.atan2(_v3.x, -_v3.z) * 1800 / Math.PI) / 10;
    if (lastRoseDeg === deg) return;
    lastRoseDeg = deg;
    compassRose.style.transform = 'rotate(' + deg.toFixed(1) + 'deg)';
  }

  function faceNorth() {
    const twoPi = Math.PI * 2;
    orbit.tTheta = Math.round(orbit.tTheta / twoPi) * twoPi;
  }

  /* ============================================================
     提示条 / 分享 / 存图
     ============================================================ */
  function toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
  }

  /** 把当前机位、注视点、选中建筑与日照编码进链接 */
  function viewLink() {
    const c = stage.camera.position;
    const t = orbit.target;
    const q = new URLSearchParams();
    q.set('pos', [c.x, c.y, c.z].map((n) => n.toFixed(1)).join(','));
    q.set('tgt', [t.x, t.y, t.z].map((n) => n.toFixed(1)).join(','));
    if (selected && selected.userData.info) q.set('select', selected.userData.info.name);
    const sl = document.getElementById('sun');
    if (sl) q.set('time', (sl.value / 100).toFixed(2));
    if (GG.i18n.lang === 'en') q.set('lang', 'en');
    return location.href.split('?')[0] + '?' + q.toString();
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy') ? resolve() : reject(new Error('copy failed'));
      } catch (e) {
        reject(e);
      } finally {
        document.body.removeChild(ta);
      }
    });
  }

  function shareView() {
    const url = viewLink();
    copyText(url)
      .then(() => toast(GG.i18n.t('链接已复制', 'Link copied')))
      .catch(() => {
        window.prompt(GG.i18n.t('复制下面的链接', 'Copy this link'), url);
      });
  }

  /** 当前画面导出 PNG，左下角加水印 */
  function saveShot() {
    stage.render();
    const src = stage.renderer.domElement;
    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
    const ctx = out.getContext('2d');
    ctx.drawImage(src, 0, 0);

    const pad = Math.round(out.width * 0.022);
    const barH = Math.round(out.width * 0.062);
    const grad = ctx.createLinearGradient(0, out.height - barH, 0, out.height);
    grad.addColorStop(0, 'rgba(10,8,6,0)');
    grad.addColorStop(1, 'rgba(10,8,6,0.72)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, out.height - barH, out.width, barH);

    const titleSize = Math.round(out.width * 0.015);
    const subSize = Math.round(out.width * 0.0095);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#d9b661';
    ctx.font = `${titleSize}px "Songti SC", "STSong", serif`;
    ctx.fillText('紫禁城', pad, out.height - pad * 0.9);

    const name = selected && selected.userData.info ? selected.userData.info.name : '';
    const date = new Date().toLocaleDateString('zh-CN');
    const sub = [name, date].filter(Boolean).join(' · ');
    ctx.fillStyle = 'rgba(242,234,217,0.72)';
    ctx.font = `${subSize}px "PingFang SC", sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(sub, out.width - pad, out.height - pad * 0.9);

    const a = document.createElement('a');
    a.download = ['紫禁城', name || '全景', date.replace(/\//g, '-')].join('-') + '.png';
    a.href = out.toDataURL('image/png');
    a.click();
    toast(GG.i18n.t('画面已保存', 'Image saved'));
  }

  /* ============================================================
     性能面板：?stats=1
     每 0.5 秒汇总一次，避免每帧写 DOM 反过来影响测量。
     draw call 与三角形数取 renderer.info，包含阴影 pass 之外的主 pass。
     ============================================================ */
  function initStats() {
    if (GG.query.get('stats') !== '1') return;
    statsEl = document.getElementById('stats');
    if (statsEl) statsEl.hidden = false;
  }

  function updateStats(dt) {
    if (!statsEl) return;
    statsAcc += dt;
    statsFrames++;
    if (statsAcc < 0.5) return;
    const info = stage.renderer.info;
    const fps = statsFrames / statsAcc;
    const ms = (statsAcc * 1000) / statsFrames;
    const tri = info.render.triangles;
    statsEl.textContent =
      'fps  ' + fps.toFixed(0).padStart(3) + '   ' + ms.toFixed(1) + ' ms\n' +
      'draw ' + String(info.render.calls).padStart(3) +
      '   tri ' + (tri >= 1000 ? (tri / 1000).toFixed(0) + 'k' : String(tri)) + '\n' +
      'geo  ' + String(info.memory.geometries).padStart(3) +
      '   tex ' + info.memory.textures;
    statsAcc = 0;
    statsFrames = 0;
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
        noteText: document.getElementById('info-note-text'),
        rel: document.getElementById('info-rel')
      },
      onPick: focusBuilding,
      onRel: (name) => {
        const entry = registry.find((x) => x.userData.info && x.userData.info.name === name);
        if (entry) focusBuilding(entry);
      }
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

    tour = new GG.Tour({
      views,
      findEntry: (name) => registry.find(
        (x) => x.userData.info && x.userData.info.name === name
      ),
      onStop: (entry) => {
        closeInfo();
        picker.setHover(entry);
      },
      onExit: () => picker.setHover(null),
      onFinish: () => toast(GG.i18n.t('导览结束', 'Tour finished'))
    });

    GG.i18n.applyStatic();
    syncLangButton();

    clock = new THREE.Clock();
    bindEvents(canvas);
    initStats();
    readQuery();
    animate();
  }

  /** 语言切换：静态文案、机位按钮、侧栏、标签、导览一起刷新 */
  function applyLang() {
    GG.i18n.applyStatic();
    if (views) views.refresh();
    if (ui) ui.refresh();
    if (labels) labels.build(registry);
    if (tour) tour.refresh();
    syncLangButton();
  }

  function syncLangButton() {
    const b = document.getElementById('btn-lang');
    if (!b) return;
    const en = GG.i18n.lang === 'en';
    b.textContent = en ? '中' : 'EN';
    b.title = en ? '切换到中文' : '切换到英文';
    b.setAttribute('aria-label', b.title);
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
    sunSlider.addEventListener('input', () => {
      if (dayPlay) setDayPlay(false);  // 手动拖动即停住流转
      dayT = sunSlider.value / 100;
      stage.setSun(dayT);
    });

    const tplayBtn = document.getElementById('btn-tplay');
    if (tplayBtn) tplayBtn.addEventListener('click', () => setDayPlay(!dayPlay));

    compassRose = document.querySelector('#compass .rose');
    const compassEl = document.getElementById('compass');
    if (compassEl) {
      compassEl.addEventListener('click', faceNorth);
      compassEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          faceNorth();
        }
      });
    }

    const rotateBtn = document.getElementById('btn-rotate');
    rotateBtn.setAttribute('aria-pressed', 'false');
    rotateBtn.addEventListener('click', (e) => {
      orbit.autoRotate = !orbit.autoRotate;
      e.currentTarget.classList.toggle('active', orbit.autoRotate);
      e.currentTarget.setAttribute('aria-pressed', String(orbit.autoRotate));
    });

    const labelsBtn = document.getElementById('btn-labels');
    labelsBtn.setAttribute('aria-pressed', 'false');
    labelsBtn.addEventListener('click', (e) => {
      dom.labels.classList.toggle('show-all');
      document.body.classList.toggle('hide-labels');
      const on = e.currentTarget.classList.toggle('active');
      e.currentTarget.setAttribute('aria-pressed', String(on));
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
      closeInfo();
      views.set('overview');
    });
    document.getElementById('btn-tour').addEventListener('click', () => {
      if (tour.active) tour.stop();
      else {
        closeInfo();
        tour.start();
      }
    });
    document.getElementById('btn-share').addEventListener('click', shareView);
    document.getElementById('btn-shot').addEventListener('click', saveShot);
    document.getElementById('btn-lang').addEventListener('click', () => GG.i18n.toggle());
    document.addEventListener('gg:lang', applyLang);
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

      /* 导览进行中，方向键与空格交给导览 */
      if (tour.active) {
        if (k === 'ArrowRight') { tour.next(); return; }
        if (k === 'ArrowLeft') { tour.prev(); return; }
        if (k === ' ') { e.preventDefault(); tour.toggle(); return; }
        if (k === 'Escape') { tour.stop(); return; }
      }

      if (keyMap[k]) { views.set(keyMap[k]); return; }
      if (k === 'r' || k === 'R') { closeInfo(); views.set('overview'); return; }
      if (k === 'h' || k === 'H') {
        const on = document.body.classList.toggle('hide-ui');
        toast(on
          ? GG.i18n.t('界面已隐藏 · 按 H 恢复', 'UI hidden · press H to show')
          : GG.i18n.t('界面已恢复', 'UI shown'));
        return;
      }
      if (k === 'Escape') { closeInfo(); return; }
      if (k === 't' || k === 'T') {
        if (tour.active) tour.stop();
        else { closeInfo(); tour.start(); }
        return;
      }
      if (k === ' ') {
        e.preventDefault();
        orbit.autoRotate = !orbit.autoRotate;
        const b = document.getElementById('btn-rotate');
        b.classList.toggle('active', orbit.autoRotate);
        b.setAttribute('aria-pressed', String(orbit.autoRotate));
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

    /* 天候先落地：它改材质颜色与 tint，setSun 会读这些值 */
    if (GG.weather) GG.weather.apply(q.get('weather') || 'clear', stage);

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
    if (!qp && qv && views.get(qv)) views.applyInstant(qv);

    /* select 允许与 view 或 pos 组合：深链分享正是 pos + select */
    const qs = q.get('select');
    if (qs && (qv || qp)) {
      const target = registry.find((x) => x.userData.info && x.userData.info.name === qs);
      if (target) setTimeout(() => selectBuilding(target), qp ? 350 : 180);
    }

    setStep('成 金', 100);
    setTimeout(() => document.getElementById('loader').classList.add('done'), 260);
    if (!qv && !qp) setTimeout(() => views.set('overview'), 480);
    if (q.get('tour') === '1') setTimeout(() => tour.start(), 800);
    if (q.get('play') === '1') setDayPlay(true);
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
      if (dayPlay) stepDay(dt);
      stage.tick(dt);
    } else if (stage.skyDome) {
      // 冻结动画，但穹顶仍要跟随相机，否则地平线会偏
      stage.skyDome.position.copy(stage.camera.position);
    }

    picker.update(dt);
    updateCompass();
    /* 粒子的下落由 dt 驱动；STILL 时 dt 传 0，位置仍跟随相机 */
    if (GG.weather) GG.weather.tick(STILL ? 0 : dt, stage.camera);

    labelFrame++;
    if (labelFrame % C.label.updateEvery === 0) labels.update();

    stage.render();
    updateStats(dt);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
