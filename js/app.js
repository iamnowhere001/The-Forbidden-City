/* ============================================================
   应用主程序
   只做编排：创建舞台 → 布置场景 → 装配交互 → 主循环。
   ============================================================ */
(function () {
  const GG = window.GG;
  const C = GG.CONFIG;
  /* ?still=1：冻结相机、云层与水面动画，供截图回归做确定性比对 */
  const STILL = GG.query.get('still') === '1';

  let stage, orbit, views, labels, picker, ui, tour, quests, eras, fps;
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
  let labelGroupIdx = 0;               // 标注分组，指向 C.label.groups
  let altFrame = 0;                    // 画布摘要的更新节流
  /* 动态分辨率：每秒结算帧率，掉帧先降渲染倍率，稳定后再升回 */
  const DRS = C.quality.drs;
  const drs = { i: 0, acc: 0, frames: 0, good: 0 };
  /* 悬停拾取节流：pointermove 只记坐标，实际拾取每帧至多一次
     （射线检测要过全部建筑组，鼠标快动时一帧多次纯浪费） */
  let hoverX = -1, hoverY = -1, hoverDirty = false;
  /* 点击抑制：按下到松开位移超过 6px 视为拖拽，不再触发选择 / 关闭 */
  let downX = 0, downY = 0, downMoved = false;
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
    const info = entry.userData.info || {};
    ui.show(info);
    picker.setHover(entry);
    picker.setSelected(entry);
    /* 漫游时信息卡被隐藏，屏幕阅读器读不到刚点开的词条 */
    if (fps.active) {
      GG.a11y.announce(GG.i18n.t(
        '准星选中 ' + info.name + '，按 Esc 退出漫游可阅读词条',
        'Selected ' + (info.en || info.name) + '. Press Esc to leave walk mode and read the entry.'
      ));
    }
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
    picker.setSelected(null);
  }

  /** 词条名 → 场景实体：导览、探索清单、朝代对比共用一条查找路径 */
  function findEntry(name) {
    return registry.find((x) => x.userData.info && x.userData.info.name === name);
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
     标注分组：只让当前分类的标签留在 Tab 顺序里
     顺序、按钮文案、键位、URL 参数都从 C.label.groups 推导
     ============================================================ */
  function labelGroups() {
    return C.label.groups || [''];
  }

  function labelGroupText(cat) {
    const suffix = cat
      ? (GG.i18n.lang === 'en' ? GG.i18n.cat(cat) : cat)
      : GG.i18n.t('全部', 'All');
    return GG.i18n.t('标注 · ', 'Labels · ') + suffix;
  }

  function syncLabelGroupBtn() {
    const b = document.getElementById('btn-label-group');
    if (!b) return;
    const cat = labelGroups()[labelGroupIdx] || '';
    const text = labelGroupText(cat);
    b.textContent = text;
    b.title = text + GG.i18n.t('（[ / ] 切换）', ' ([ / ] to cycle)');
    b.setAttribute('aria-label', b.title);
    b.setAttribute('aria-pressed', String(!!cat));
    b.classList.toggle('active', !!cat);
  }

  function setLabelGroup(cat, quiet) {
    const list = labelGroups();
    const idx = list.indexOf(cat || '');
    labelGroupIdx = idx < 0 ? 0 : idx;
    if (labels) labels.setGroup(list[labelGroupIdx], quiet);
    syncLabelGroupBtn();
    return list[labelGroupIdx];
  }

  function cycleLabelGroup(dir) {
    const list = labelGroups();
    const cat = setLabelGroup(list[(labelGroupIdx + dir + list.length) % list.length]);
    const msg = labelGroupText(cat);
    GG.a11y.announce(msg);
    toast(msg);
  }

  function syncCanvasAltLabel() {
    if (dom.canvas) {
      dom.canvas.setAttribute('aria-label',
        GG.i18n.t('紫禁城三维场景', 'Forbidden City 3D scene'));
    }
    const alt = document.getElementById('scene-alt');
    if (alt) {
      alt.setAttribute('aria-label',
        GG.i18n.t('画布内容摘要', 'Scene description'));
    }
  }

  /** 画布的文本替代：机位尺度 + 可见标注 + 选中建筑，每 120 帧刷新一次 */
  function updateSceneAlt() {
    if (fps.active) {
      GG.a11y.sceneAlt(GG.i18n.t(
        '第一人称漫游，眼高 1.7 米。WASD 移动、鼠标转头，按 Esc 退出。信息卡在漫游中隐藏。',
        'Walk mode at eye height 1.7 m. WASD to move, mouse to look, Esc to exit. The info card is hidden while walking.'
      ));
      return;
    }
    const vis = labels.items.filter((L) => L.visible).map((L) => L.name);
    const dist = stage.camera.position.distanceTo(orbit.target);
    const scale = dist > 1200
      ? GG.i18n.t('远景', 'distant view')
      : dist > 400 ? GG.i18n.t('中景', 'mid view') : GG.i18n.t('近景', 'close view');
    const parts = [
      GG.i18n.t('紫禁城与京师三维场景，' + scale, '3D scene of the Forbidden City and Beijing, ' + scale),
      GG.i18n.t('可见标注 ' + vis.length + ' 个', vis.length + ' visible labels'),
      vis.length
        ? vis.slice(0, 24).join('、')
        : GG.i18n.t(
            '当前机位未显示标注，可用左侧宫殿索引浏览全部 ' + ui.items.length + ' 条',
            'No labels at this distance; use the palace index to browse all ' + ui.items.length + ' entries'
          )
    ];
    if (selected && selected.userData.info) {
      const info = selected.userData.info;
      parts.push(GG.i18n.t('已选中 ' + info.name, 'Selected ' + (info.en || info.name)));
    }
    GG.a11y.sceneAlt(parts.join(GG.i18n.t('。', '. ')));
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

  /** 把当前机位、注视点、选中建筑、日照与界面状态编码进链接。
      清单只分享「面板是否打开」，进度按约定不进链接。 */
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
    if (GG.weather && GG.weather.name !== 'clear') q.set('weather', GG.weather.name);
    if (eras && GG.ERAS && eras.id !== GG.ERAS.initial) q.set('era', eras.id);
    /* 两个面板共用左侧栏位置，同一时刻只开一个；era 优先 */
    if (quests && quests.isOpen() && !(eras && eras.isOpen())) q.set('quest', '1');
    const lg = labelGroups()[labelGroupIdx];
    if (lg) q.set('labelgroup', lg);
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
    const cls = fps >= 50 ? 'st-ok' : fps >= 30 ? 'st-warn' : 'st-bad';
    statsEl.innerHTML =
      'fps  <span class="' + cls + '">' + fps.toFixed(0).padStart(3) + '</span>   ' + ms.toFixed(1) + ' ms\n' +
      'draw ' + String(info.render.calls).padStart(3) +
      '   tri ' + (tri >= 1000 ? (tri / 1000).toFixed(0) + 'k' : String(tri)) + '\n' +
      'geo  ' + String(info.memory.geometries).padStart(3) +
      '   tex ' + info.memory.textures + '\n' +
      'res  ' + stage.resolutionScale().toFixed(2) +
      '   shdw ' + (stage.renderer.shadowMap.autoUpdate ? 'auto' : 'on-demand');
    statsAcc = 0;
    statsFrames = 0;
  }

  /* ============================================================
     初始化
     ============================================================ */
  function init() {
    const canvas = document.getElementById('scene');
    /* ?nofade=1：截图回归专用。加载层直接隐藏，不等 0.9s 淡出——
       虚拟时间预算下 CSS 过渡不跟虚拟钟走，会把加载层截进画面。 */
    if (GG.query.get('nofade') === '1') {
      const l = document.getElementById('loader');
      l.style.transition = 'none';
      l.style.display = 'none';
    }
    setStep('相 地', 8);

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
        era: document.getElementById('info-era'),
        eraCap: document.getElementById('info-era-cap'),
        eraText: document.getElementById('info-era-text'),
        note: document.getElementById('info-note'),
        noteText: document.getElementById('info-note-text'),
        rel: document.getElementById('info-rel')
      },
      onPick: focusBuilding,
      onRel: (name) => {
        const entry = findEntry(name);
        if (entry) focusBuilding(entry);
      },
      /* 信息卡里的朝代差异由 eras 提供；布局完成前返回 null */
      eraNote: (info) => (eras ? eras.noteFor(info) : null)
    });

    stage = new GG.Stage(canvas);

    /* 光圈先于场景布局创建：与 v0.9 的对象创建顺序保持一致，
       这样 ?seed=1 时两边的随机数流才对得上，截图可复现。 */
    picker = new GG.Picker({
      canvas, camera: stage.camera, scene: stage.scene, registry: []
    });

    /* 布局分五段进行、段间让出主线程：加载条反映真实进度 */
    runLayout(canvas);
  }

  /* 布局各段的加载文案（与 palace.js 的 step 百分比对应） */
  function loadLabel(pct) {
    if (pct <= 30) return '相 地';
    if (pct <= 52) return '前 朝';
    if (pct <= 66) return '宫 阙';
    if (pct <= 74) return '城 垣';
    if (pct <= 82) return '坛 庙';
    if (pct <= 94) return '林 木';
    return '宫 灯';
  }

  async function runLayout(canvas) {
    registry = await GG.layout(stage.scene, (pct) => setStep(loadLabel(pct), pct));
    picker.registry = registry;
    stage.scene.updateMatrixWorld(true);
    stage.normalizeEnvIntensity(0.22);
    /* 静态合并：殿身 / 院墙 / 铺装按（材质 × 投影 × 受影）分桶合成，
       逐像素等价（顶点色与 UV 原样携带），draw call 大幅下降 */
    window.__mark && window.__mark('pre-merge');
    window.__cap = true;
    GG.geo.optimizeStatics(stage.scene);
    /* 第二遍跨组合并：城墙、地坪、坛墙这类不参与拾取的静态块
       按材质烘成世界坐标合批，draw call 再降一个量级 */
    window.__mark && window.__mark('pre-worldmerge');
    const mergedWorld = GG.geo.mergeWorldStatics(stage.scene);
    window.__mark && window.__mark('post-worldmerge');
    GG.debug.worldMerged = mergedWorld;
    window.__cap = false;
    window.__mark && window.__mark('post-merge');
    /* 晨 / 暮环境贴图补烘：放在布局后，保证布局期随机流与旧版一致 */
    stage.bakeDawnEnvs();
    setStep('铺 陈', 97);

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

    views = new GG.Views({ camera: stage.camera, orbit, root: dom.views });

    tour = new GG.Tour({
      views,
      findEntry,
      onStop: (entry) => {
        closeInfo();
        picker.setHover(entry);
      },
      onExit: () => picker.setHover(null),
      onFinish: () => toast(GG.i18n.t('导览结束', 'Tour finished'))
    });

    /* 探索清单：判定复用 ui 的「已阅」集合，不另存进度 */
    quests = new GG.Quests({
      hasVisited: (name) => ui.hasVisited(name),
      findEntry,
      onFocus: focusBuilding
    });

    /* 朝代对比：切换后若信息卡开着，立刻重绘那段差异注记 */
    eras = new GG.Eras({
      findEntry,
      onFocus: focusBuilding,
      onChange: () => {
        if (selected) ui.show(selected.userData.info);
      }
    });

    fps = new GG.FPS({
      camera: stage.camera,
      canvas,
      orbit,
      views,
      picker,
      registry,
      onEnter: () => {
        if (tour.active) tour.stop();
        closeInfo();
        quests.close();
        eras.close();
        toast(GG.i18n.t('已进入漫游 · Esc 退出', 'Walk mode · press Esc to exit'));
      },
      onExit: () => toast(GG.i18n.t('已回到全景视角', 'Back to the orbit view'))
    });

    GG.i18n.applyStatic();
    syncLangButton();
    syncLabelGroupBtn();
    syncCanvasAltLabel();

    clock = new THREE.Clock();
    bindEvents(canvas);
    initStats();
    readQuery();
    /* tools/probe.html 依赖这里的引用做拾取 / 规模断言 */
    window.__dbg = {
      stage, orbit, registry, GG, THREE, picker, labels, views, ui, quests, eras, fps,
      viewLink, setLabelGroup, updateSceneAlt
    };
    animate();
    window.__mark && window.__mark('first-frame-done');
  }

  /** 语言切换：静态文案、机位按钮、侧栏、标签、导览一起刷新 */
  function applyLang() {
    GG.i18n.applyStatic();
    if (views) views.refresh();
    if (ui) ui.refresh();
    if (labels) labels.build(registry);
    if (tour) tour.refresh();
    syncLangButton();
    syncLabelGroupBtn();
    syncCanvasAltLabel();
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
    /* 搜索命中 → 标签高亮。ui.js 每次过滤后派发，这里只做接线 */
    document.addEventListener('gg:filter', (e) => {
      if (labels) labels.setMatches(e.detail.names, e.detail.active);
    });

    /* 悬停拾取：只记录坐标，实际射线检测在 animate 里每帧做一次；
       拖拽 / 平移中直接不拾取，转视角不触发高亮 */
    canvas.addEventListener('pointermove', (e) => {
      hoverX = e.clientX; hoverY = e.clientY; hoverDirty = true;
    });
    canvas.addEventListener('pointerdown', (e) => {
      downX = e.clientX; downY = e.clientY; downMoved = false;
    });
    const noteUp = (e) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) downMoved = true;
    };
    canvas.addEventListener('pointerup', noteUp);
    canvas.addEventListener('pointercancel', noteUp);
    canvas.addEventListener('click', (e) => {
      if (downMoved) { downMoved = false; return; }   // 拖拽后的抬起不算点击
      if (fps.active) {
        /* Pointer Lock 下 clientX/Y 停在锁定前，拾取改用画面中心（准星） */
        const rect = canvas.getBoundingClientRect();
        const hit = picker.pickAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
        if (hit) selectBuilding(hit);
        return;
      }
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

    /* 导览开始 / 退出给一次 toast，状态变化有反馈 */
    const toggleTour = () => {
      if (tour.active) {
        tour.stop();
        toast(GG.i18n.t('已退出导览', 'Tour exited'));
      } else {
        closeInfo();
        quests.close();
        eras.close();
        tour.start();
        toast(GG.i18n.t('导览开始，共 ' + (tour.stops.length || 0) + ' 站',
          'Tour started, ' + (tour.stops.length || 0) + ' stops'));
      }
    };

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
    const syncRotateBtn = () => {
      rotateBtn.classList.toggle('active', orbit.autoRotate);
      rotateBtn.setAttribute('aria-pressed', String(orbit.autoRotate));
    };
    /* 用户一上手（拖拽 / 滚轮）就停下自动旋转，按钮状态同步回来 */
    GG.onAutoRotateOff = syncRotateBtn;
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
    document.getElementById('btn-label-group').addEventListener('click', () => cycleLabelGroup(1));

    /* 探索 / 朝代对比共用左侧栏位置，同一时刻只开一个 */
    document.getElementById('btn-quests').addEventListener('click', () => eras.close());
    document.getElementById('btn-era').addEventListener('click', () => quests.close());
    document.getElementById('btn-fps').addEventListener('click', () => fps.enter());

    document.getElementById('btn-reset').addEventListener('click', () => {
      closeInfo();
      views.set('overview');
    });
    document.getElementById('btn-tour').addEventListener('click', toggleTour);
    document.getElementById('btn-share').addEventListener('click', shareView);
    document.getElementById('btn-shot').addEventListener('click', saveShot);
    document.getElementById('btn-lang').addEventListener('click', () => GG.i18n.toggle());
    document.addEventListener('gg:lang', applyLang);
    /* ☰：宽屏收起侧栏，窄屏唤出抽屉（body.sb-open） */
    document.getElementById('panel-toggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('collapsed');
      document.body.classList.toggle('sb-open');
    });
    /* 点遮罩收起抽屉；从索引里点中一项也顺手收起 */
    document.getElementById('scrim').addEventListener('click', () => {
      document.body.classList.remove('sb-open');
    });
    document.getElementById('list').addEventListener('click', () => {
      document.body.classList.remove('sb-open');
    });

    // 键位从机位表生成，新增机位不用再改这里
    const keyMap = {};
    for (const v of C.views) if (v.key) keyMap[v.key] = v.id;

    window.addEventListener('keydown', (e) => {
      const k = e.key;

      /* 第一人称接管相机：Esc / F 退出，其余键位由 fps.js 自己处理。
         这段要放在输入框判断之前，否则焦点残留在搜索框时退不出去。 */
      if (fps.active) {
        if (k === 'Escape' || k === 'f' || k === 'F') {
          e.preventDefault();
          fps.exit();
        }
        return;
      }

      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      /* 导览进行中，方向键与空格交给导览 */
      if (tour.active) {
        if (k === 'ArrowRight') { tour.next(); return; }
        if (k === 'ArrowLeft') { tour.prev(); return; }
        if (k === ' ') { e.preventDefault(); tour.toggle(); return; }
        if (k === 'Escape') { tour.stop(); return; }
      }

      if (keyMap[k]) { views.set(keyMap[k]); return; }
      if (k === 'r' || k === 'R') { closeInfo(); views.set('overview'); return; }
      if (k === '[') { cycleLabelGroup(-1); return; }
      if (k === ']') { cycleLabelGroup(1); return; }
      if (k === 'h' || k === 'H') {
        const on = document.body.classList.toggle('hide-ui');
        toast(on
          ? GG.i18n.t('界面已隐藏 · 按 H 恢复', 'UI hidden · press H to show')
          : GG.i18n.t('界面已恢复', 'UI shown'));
        return;
      }
      if (k === 'Escape') { closeInfo(); return; }
      if (k === 't' || k === 'T') {
        toggleTour();
        return;
      }
      if (k === 'q' || k === 'Q') { quests.toggle(); eras.close(); return; }
      if (k === 'e' || k === 'E') { eras.toggle(); quests.close(); return; }
      if (k === 'f' || k === 'F') { fps.enter(); return; }
      if (k === ' ') {
        e.preventDefault();
        orbit.autoRotate = !orbit.autoRotate;
        const b = document.getElementById('btn-rotate');
        b.classList.toggle('active', orbit.autoRotate);
        b.setAttribute('aria-pressed', String(orbit.autoRotate));
      }
    });

    /* 窗口 resize 防抖：连续拖动边缘只做一次重建；
       拉宽到桌面宽度时清掉抽屉状态，遮罩不残留 */
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        stage.resize();
        labels.invalidate();
        if (window.innerWidth > 1080) document.body.classList.remove('sb-open');
      }, 120);
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

    const qGroup = q.get('labelgroup');
    if (qGroup) setLabelGroup(qGroup, true);
    /* 朝代先落地、清单后展开：两者同现时保留朝代状态、只让清单占左侧栏 */
    const qEra = q.get('era');
    if (qEra === 'ming' || qEra === 'qing') { quests.close(); eras.set(qEra); eras.open(); }
    if (q.get('quest') === '1') { eras.close(); quests.open(); }
    /* ?fps=1 供自动化与演示：不请求 Pointer Lock，避免无头环境卡住 */
    if (q.get('fps') === '1') setTimeout(() => fps.enter({ noLock: true }), 900);
  }

  /* 动态分辨率结算：每秒一次，掉帧先降档、稳定两窗再升档 */
  function updateDrs(dt) {
    if (STILL) return;
    drs.acc += dt;
    drs.frames++;
    if (drs.acc < 1) return;
    const fps = drs.frames / drs.acc;
    drs.acc = 0;
    drs.frames = 0;
    const n = DRS.scales.length;
    if (fps < DRS.downFps && drs.i < n - 1) {
      drs.i++;
      drs.good = 0;
      stage.setResolutionScale(DRS.scales[drs.i]);
    } else if (fps >= DRS.upFps && drs.i > 0) {
      drs.good++;
      if (drs.good >= DRS.needGood) {
        drs.i--;
        drs.good = 0;
        stage.setResolutionScale(DRS.scales[drs.i]);
      }
    } else {
      drs.good = 0;
    }
  }

  /* ============================================================
     主循环
     ============================================================ */
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    if (!STILL) {
      if (fps.active) {
        /* orbit.enabled=false，此刻只有 fps 写相机，不能让轨道更新覆盖它 */
        fps.update(dt);
      } else {
        views.step();
        if (!views.isFlying()) orbit.update(dt);
      }
      if (dayPlay) stepDay(dt);
      stage.tick(dt);
    } else if (stage.skyDome) {
      // 冻结动画，但穹顶仍要跟随相机，否则地平线会偏
      stage.skyDome.position.copy(stage.camera.position);
    }

    /* 阴影锚点：第一人称跟人走，否则跟轨道注视点 */
    const anchor = fps.active ? fps.anchor() : orbit.target;
    stage.setShadowAnchor(anchor.x, anchor.y, anchor.z);
    stage.updateShadowFit();

    picker.update(dt);
    /* 悬停拾取每帧至多一次；第一人称改用准星拾取（在 fps.update 里节流） */
    if (!fps.active && hoverDirty && !orbit.dragging && !orbit.panning) {
      hoverDirty = false;
      picker.setHover(picker.pickAt(hoverX, hoverY));
    } else if (fps.active) {
      hoverDirty = false;
    }
    if (!fps.active) updateCompass();
    /* 粒子的下落由 dt 驱动；STILL 时 dt 传 0，位置仍跟随相机 */
    if (GG.weather) GG.weather.tick(STILL ? 0 : dt, stage.camera);

    /* 第一人称下标签层被隐藏，不必再算投影与避让 */
    if (!fps.active) {
      labelFrame++;
      if (labelFrame % C.label.updateEvery === 0) labels.update();
    }
    /* 画布文本替代：约 2 秒一次，避免反复触发可访问性树重算 */
    altFrame++;
    if (altFrame % 120 === 0) updateSceneAlt();

    stage.render();
    updateStats(dt);
    updateDrs(dt);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
