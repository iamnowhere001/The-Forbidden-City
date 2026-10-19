/* ============================================================
   总平面布置 —— 紫禁城
   坐标：X 东西（+东），Z 南北（+南），Y 高度。单位：米
   ============================================================ */
(function () {
  const GG = (window.GG = window.GG || {});
  const B = () => GG.build;
  const G = () => GG.geo;

  const REG = [];

  const INFO = GG.INFO || {};

  function add(scene, g, cfg) {
    g.position.set(cfg.x || 0, cfg.y || 0, cfg.z || 0);
    if (cfg.ry) g.rotation.y = cfg.ry;
    if (g.userData.isBuilding) {
      REG.push(g);
    }
    scene.add(g);
    return g;
  }

  function hall(scene, cfg) {
    const info = cfg.info || {};
    const g = GG.build.createHall(Object.assign({}, cfg, { info: info }));
    return add(scene, g, cfg);
  }

  /* ---------------- 六宫院落 ---------------- */
  function courtyard(scene, cfg) {
    const M = GG.build.buildMaterials();
    const group = new THREE.Group();
    const W = cfg.w, D = cfg.d;

    // 院墙
    const wallH = 5.5;
    const t = 1.2;
    const segs = [
      { x: 0, z: -D / 2, len: W, ry: 0 },
      { x: -W / 2, z: 0, len: D, ry: Math.PI / 2 },
      { x: W / 2, z: 0, len: D, ry: Math.PI / 2 }
    ];
    for (const s of segs) {
      const w = new THREE.Mesh(GG.geo.fitUV(new THREE.BoxGeometry(s.len, wallH, t), 0.3, wallH), M.wall);
      w.position.set(s.x, wallH / 2, s.z);
      w.rotation.y = s.ry;
      w.castShadow = true;
      w.receiveShadow = true;
      group.add(w);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(s.len, 0.7, t + 0.8), M.tileCap);
      cap.position.set(s.x, wallH + 0.35, s.z);
      cap.rotation.y = s.ry;
      group.add(cap);
    }
    // 南面墙留院门
    for (const sx of [-1, 1]) {
      const gw = W * 0.32;
      const w = new THREE.Mesh(GG.geo.fitUV(new THREE.BoxGeometry(gw, wallH, t), 0.3, wallH), M.wall);
      w.position.set(sx * (W / 2 - gw / 2), wallH / 2, D / 2);
      w.castShadow = true;
      group.add(w);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(gw, 0.7, t + 0.8), M.tileCap);
      cap.position.set(sx * (W / 2 - gw / 2), wallH + 0.35, D / 2);
      group.add(cap);
    }
    // 院门
    const gate = GG.build.createHall({
      w: W * 0.3, d: 6, h: 5.2, roofH: 3.4, style: 'xieshan',
      tiers: 1, tierH: 0.9, railing: false, stairs: false, eave: 1.4,
      green: cfg.green, info: null
    });
    gate.position.set(0, 0, D / 2);
    group.add(gate);

    // 正殿
    const main = GG.build.createHall({
      w: W * 0.62, d: D * 0.42, h: 7.6, roofH: 5.4,
      style: 'xieshan', tiers: 1, tierH: 1.6, eave: 2.2,
      green: cfg.green, info: cfg.info || {}, plaque: (cfg.info && cfg.info.name) || null
    });
    main.position.set(0, 0, -D * 0.2);
    group.add(main);
    REG.push(main);

    // 东西配殿
    for (const sx of [-1, 1]) {
      const side = GG.build.createHall({
        w: 9, d: 20, h: 5.6, roofH: 4.2, style: 'gable',
        tiers: 1, tierH: 0.9, railing: false, stairs: false, eave: 1.3,
        green: cfg.green, info: null
      });
      side.position.set(sx * W * 0.31, 0, -D * 0.05);
      side.rotation.y = Math.PI / 2;
      group.add(side);
    }

    group.position.set(cfg.x, 0, cfg.z);
    scene.add(group);
    return group;
  }

  /* ---------------- 地面 / 绿化 / 陈设小件 ---------------- */
  // 草坪：宫苑草地，略高于城砖地坪（innerPave 在 0.004）避免共面闪烁
  function lawn(scene, w, d, x, z, y) {
    const tx = GG.getTextures().grass.clone();
    tx.needsUpdate = true;
    tx.repeat.set(Math.max(1, Math.round(w / 7)), Math.max(1, Math.round(d / 7)));
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({ map: tx, color: 0x9ab47c, roughness: 1 })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y == null ? 0.014 : y, z);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  // 甬路：园内浅色步道，压在草坪之上
  function path(scene, w, d, x, z, y) {
    const tx = GG.getTextures().paving.clone();
    tx.needsUpdate = true;
    tx.repeat.set(Math.max(1, Math.round(w / 5)), Math.max(1, Math.round(d / 5)));
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({ map: tx, color: 0xb3ad9d, roughness: 0.94 })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y == null ? 0.024 : y, z);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  // 甬路（南北向一段，自动算长宽）
  function pathNS(scene, len, w, x, z) { return path(scene, w, len, x, z); }

  // 花坛：砖砌池 + 土面 + 几丛花色
  function bed(scene, x, z, r) {
    const M = GG.build.buildMaterials();
    const g = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.BoxGeometry(r * 2, 0.55, r * 2), M.marble);
    rim.position.y = 0.28;
    rim.castShadow = true;
    rim.receiveShadow = true;
    g.add(rim);
    const soil = new THREE.Mesh(
      new THREE.BoxGeometry(r * 2 - 0.3, 0.12, r * 2 - 0.3),
      new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 1 })
    );
    soil.position.y = 0.5;
    g.add(soil);
    const bloom = [];
    const cols = [0xc0453f, 0xd2793a, 0xcfc06a, 0xb8548a];
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2, rr = Math.random() * (r - 0.6);
      bloom.push(GG.geo.xform(new THREE.SphereGeometry(0.34 + Math.random() * 0.2, 6, 5), {
        x: Math.cos(a) * rr, y: 0.78 + Math.random() * 0.22, z: Math.sin(a) * rr,
        sx: 1.2, sy: 0.7
      }));
    }
    const bm = new THREE.Mesh(GG.geo.merge(bloom), new THREE.MeshStandardMaterial({ color: 0xc0453f, roughness: 0.9 }));
    g.add(bm);
    g.position.set(x, 0, z);
    scene.add(g);
    return g;
  }

  // 水池：宫苑小水面，配石岸
  function pool(scene, w, d, x, z) {
    const M = GG.build.buildMaterials();
    const g = new THREE.Group();
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x8d887c, roughness: 0.95 });
    for (const sx of [-1, 1]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 0.5, 1.0), rimMat);
      r.position.set(sx * 0, 0.25, sx * (d / 2 + 0.4));
      r.receiveShadow = true;
      g.add(r);
    }
    for (const sx of [-1, 1]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, d + 1.2), rimMat);
      r.position.set(sx * (w / 2 + 0.4), 0.25, 0);
      r.receiveShadow = true;
      g.add(r);
    }
    const wm = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.water);
    wm.rotation.x = -Math.PI / 2;
    wm.position.y = 0.1;
    g.add(wm);
    g.position.set(x, 0, z);
    scene.add(g);
    return g;
  }

  // 铜狮：基座 + 蹲身 + 卷毛头（比简化方盒耐看）
  function lion(scene, x, z, ry) {
    const M = GG.build.buildMaterials();
    const g = new THREE.Group();
    const parts = [];
    parts.push(GG.geo.box(3.0, 1.5, 4.2, { y: 0.75 }));                     // 须弥座
    parts.push(GG.geo.box(2.4, 0.9, 1.0, { y: 1.9, z: -1.2 }));             // 后胯
    parts.push(GG.geo.xform(new THREE.SphereGeometry(1.15, 10, 8), { y: 2.35, z: -0.4, sy: 0.95 }));
    parts.push(GG.geo.xform(new THREE.SphereGeometry(0.78, 10, 8), { y: 3.05, z: 0.7, sx: 0.92, sz: 0.85 })); // 头
    parts.push(GG.geo.box(1.5, 0.9, 1.7, { y: 3.3, z: 1.35 }));             // 鬃毛
    for (const sx of [-1, 1]) {
      parts.push(GG.geo.box(0.5, 2.2, 0.55, { x: sx * 0.62, y: 2.1, z: 1.15 })); // 前腿
    }
    const m = new THREE.Mesh(GG.geo.merge(parts), M.bronze);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    g.position.set(x, 0, z);
    if (ry) g.rotation.y = ry;
    scene.add(g);
    return g;
  }

  // 假山：多面体碎石堆
  function rockery(scene, x, z, count, spread, yBase) {
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x5c564c, roughness: 1, flatShading: true });
    const rs = [];
    for (let i = 0; i < count; i++) {
      const r = 1.6 + Math.random() * (spread * 0.5);
      rs.push(GG.geo.xform(new THREE.DodecahedronGeometry(r, 0), {
        x: (Math.random() - 0.5) * spread,
        y: (yBase || 2) + Math.random() * (spread * 0.45),
        z: (Math.random() - 0.5) * spread * 0.8,
        ry: Math.random() * 3, sx: 1.15, sy: 0.72
      }));
    }
    const m = new THREE.Mesh(GG.geo.merge(rs), rockMat);
    m.position.set(x, 0, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  // 一段院墙（两端带瓦顶，随调用摆放）；ry = 0 时沿 X 向
  function wallRun(scene, len, x, z, ry, h) {
    const w = GG.build.createWall({ length: len, h: h || 5.5, t: 1.2 });
    w.position.set(x, 0, z);
    w.rotation.y = ry || 0;
    scene.add(w);
    return w;
  }

  // 围合一座矩形院落：北、东、西三面整墙，南面留出门洞
  function wallBox(scene, cx, cz, w, d, h, gateW) {
    wallRun(scene, w, cx, cz - d / 2, 0, h);
    wallRun(scene, d, cx - w / 2, cz, Math.PI / 2, h);
    wallRun(scene, d, cx + w / 2, cz, Math.PI / 2, h);
    const gw = gateW || 0;
    const seg = (w - gw) / 2;
    wallRun(scene, seg, cx - gw / 2 - seg / 2, cz + d / 2, 0, h);
    wallRun(scene, seg, cx + gw / 2 + seg / 2, cz + d / 2, 0, h);
  }

  // 院内地面：比城砖地坪略亮，把院落"铺"出来
  function yardPave(scene, w, d, x, z, y) {
    const tx = GG.getTextures().paving.clone();
    tx.needsUpdate = true;
    tx.repeat.set(Math.max(1, Math.round(w / 6)), Math.max(1, Math.round(d / 6)));
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({ map: tx, color: 0xa29c8e, roughness: 0.96 })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y == null ? 0.012 : y, z);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  /* ============================================================
     主入口：布置整个紫禁城
     ============================================================ */
  GG.layout = function (scene) {
    const M = GG.build.buildMaterials();
    const t = GG.getTextures();
    REG.length = 0;

    const HALL = (o) => hall(scene, o);

    /* ---------- 地面 ---------- */
    const groundMat = new THREE.MeshStandardMaterial({
      map: t.ground, color: 0x7d8163, roughness: 1
    });
    const groundTex = t.ground.clone();
    groundTex.needsUpdate = true;
    groundTex.repeat.set(320, 350);
    groundMat.map = groundTex;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9800), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.15;
    ground.receiveShadow = true;
    scene.add(ground);

    /* ---------- 远山：收束地平线，避免大地平面边缘露白 ---------- */
    const hills = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + Math.random() * 0.2;
      const rr = 3200 + Math.random() * 1300;
      const hx = Math.cos(a) * rr;
      const hz = Math.sin(a) * rr * 1.15;
      const base = 420 + Math.random() * 620;
      const hh = 80 + Math.random() * 150;
      const g = new THREE.SphereGeometry(base, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      g.scale(1, hh / base, 0.72 + Math.random() * 0.5);
      hills.push(GG.geo.xform(g, { x: hx, y: -8, z: hz, ry: Math.random() * 3 }));
    }
    const hillRing = new THREE.Mesh(
      GG.geo.merge(hills),
      new THREE.MeshStandardMaterial({ color: 0x57614d, roughness: 1 })
    );
    scene.add(hillRing);

    /* 城外地坪：整片灰砖 */
    const inTex = t.paving.clone();
    inTex.needsUpdate = true;
    inTex.repeat.set(66, 84);
    const innerPave = new THREE.Mesh(
      new THREE.PlaneGeometry(748, 958),
      new THREE.MeshStandardMaterial({ map: inTex, color: 0x8a8880, roughness: 0.97 })
    );
    innerPave.rotation.x = -Math.PI / 2;
    innerPave.position.y = 0.004;
    innerPave.receiveShadow = true;
    scene.add(innerPave);

    /* 中轴铺装带 */
    const paveTex = t.paving.clone();
    paveTex.needsUpdate = true;
    paveTex.repeat.set(40, 160);
    const pave = new THREE.Mesh(
      new THREE.PlaneGeometry(230, 940),
      new THREE.MeshStandardMaterial({ map: paveTex, color: 0x9a968b, roughness: 0.97 })
    );
    pave.rotation.x = -Math.PI / 2;
    pave.position.set(0, 0.02, 0);
    pave.receiveShadow = true;
    scene.add(pave);

    /* 侧路铺装 */
    for (const sx of [-1, 1]) {
      const st = t.paving.clone();
      st.needsUpdate = true;
      st.repeat.set(30, 30);
      const p = new THREE.Mesh(
        new THREE.PlaneGeometry(280, 640),
        new THREE.MeshStandardMaterial({ map: st, color: 0x8c887d, roughness: 0.97 })
      );
      p.rotation.x = -Math.PI / 2;
      p.position.set(sx * 250, 0.01, -120);
      p.receiveShadow = true;
      scene.add(p);
    }

    /* ---------- 三台（三大殿共用的三层须弥座） ---------- */
    const TAI_Z = 65, TAI_L = 236, TAI_W = 122, TAI_H = 8.1;
    const t3 = GG.geo.terraceGeometry(TAI_W, TAI_L, TAI_H, 3);
    const taiMesh = new THREE.Mesh(t3.geo, M.stone);
    taiMesh.position.set(0, 0, TAI_Z);
    taiMesh.castShadow = true;
    taiMesh.receiveShadow = true;
    scene.add(taiMesh);

    // 三台栏杆（每层）
    for (let i = 0; i < 3; i++) {
      const w = TAI_W - i * 2.6 + 0.4;
      const l = TAI_L - i * 2.6 + 0.4;
      const rail = GG.geo.railingGeometry(w, l, 1.1, 0.85);
      const rm = new THREE.Mesh(rail, M.marble);
      rm.position.set(0, TAI_H * ((i + 1) / 3) - 0.15, TAI_Z);
      rm.castShadow = true;
      scene.add(rm);
    }
    // 三台南面大台阶（御路）
    const bigStair = GG.geo.stairsGeometry(26, TAI_H, 12, 12, 's');
    const bs = new THREE.Mesh(bigStair, M.stone);
    bs.position.set(0, 0, TAI_Z + TAI_L / 2 - 0.4);
    bs.castShadow = true;
    bs.receiveShadow = true;
    scene.add(bs);
    // 北面台阶
    const bStair = GG.geo.stairsGeometry(20, TAI_H, 12, 9, 's');
    const bsm = new THREE.Mesh(bStair, M.stone);
    bsm.position.set(0, 0, TAI_Z - TAI_L / 2 + 0.4);
    bsm.rotation.y = Math.PI;
    bsm.castShadow = true;
    scene.add(bsm);

    /* ---------- 内金水河 & 金水桥 ---------- */
    const riverPts = [
      new THREE.Vector3(-108, 0, 352),
      new THREE.Vector3(-64, 0, 342),
      new THREE.Vector3(-24, 0, 336),
      new THREE.Vector3(24, 0, 336),
      new THREE.Vector3(64, 0, 342),
      new THREE.Vector3(108, 0, 352)
    ];
    const riverCurve = new THREE.CatmullRomCurve3(riverPts);
    const riverGeo = new THREE.TubeGeometry(riverCurve, 48, 6.2, 10, false);
    riverGeo.scale(1, 0.055, 1);
    const river = new THREE.Mesh(riverGeo, M.water);
    river.position.y = 0.35;
    scene.add(river);

    // 河岸石沿
    for (const off of [-1, 1]) {
      const bankPts = riverPts.map((p) => new THREE.Vector3(p.x, 0, p.z + off * 6.8));
      const bc = new THREE.CatmullRomCurve3(bankPts);
      const bg = new THREE.TubeGeometry(bc, 40, 0.55, 4, false);
      bg.scale(1, 0.55, 1);
      const bm = new THREE.Mesh(bg, M.marble);
      bm.position.y = 0.55;
      bm.receiveShadow = true;
      scene.add(bm);
    }

    // 五座金水桥
    const bridgeX = [-72, -36, 0, 36, 72];
    const bridgeW = [7, 9.5, 13, 9.5, 7];
    bridgeX.forEach((bx, i) => {
      const bw = bridgeW[i];
      const bz = i < 3 ? (i === 0 ? 346 : i === 1 ? 339 : 337) : (i === 3 ? 339 : 346);
      const deck = new THREE.Mesh(new THREE.BoxGeometry(bw, 1.5, 17), M.marble);
      deck.position.set(bx, 1.05, bz + 1);
      deck.castShadow = true;
      deck.receiveShadow = true;
      scene.add(deck);
      // 桥栏
      for (const sx of [-1, 1]) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.1, 17), M.marble);
        r.position.set(bx + sx * (bw / 2 - 0.2), 2.2, bz + 1);
        scene.add(r);
      }
    });

    /* ================= 中轴建筑 ================= */

    // 午门
    const wumen = GG.build.createGateTower({
      w: 96, d: 46, h: 12.5,
      mainW: 62, mainD: 24, mainH: 13, roofH: 10,
      doors: 3, info: INFO.wumen, plaque: '午门'
    });
    add(scene, wumen, { x: 0, z: 452 });

    // 太和门
    HALL({
      x: 0, z: 302, ry: 0, info: INFO.taihemen, plaque: '太和门',
      w: 42, d: 17, h: 10.5, roofH: 9, style: 'xieshan', double: true,
      tiers: 2, tierH: 2.0, eave: 2.6
    });

    // 太和殿（位于三台之上）
    const thd = HALL({
      x: 0, y: TAI_H, z: 140, info: INFO.taihedian, plaque: '太和殿',
      w: 64, d: 37, h: 15.5, roofH: 12.5, style: 'hip', double: true,
      tiers: 1, tierH: 1.0, eave: 3.0, colStep: 4.6
    });
    // 月台
    const yt = GG.geo.terraceGeometry(84, 46, 2.4, 1);
    const ytm = new THREE.Mesh(yt.geo, M.stone);
    ytm.position.set(0, TAI_H, 148);
    ytm.castShadow = true;
    ytm.receiveShadow = true;
    scene.add(ytm);
    const ytr = new THREE.Mesh(GG.geo.railingGeometry(84, 46, 1.0, 0.8), M.marble);
    ytr.position.set(0, TAI_H + 2.4, 148);
    scene.add(ytr);

    // 中和殿
    HALL({
      x: 0, y: TAI_H, z: 62, info: INFO.zhonghedian, plaque: '中和殿',
      w: 26, d: 26, h: 9, roofH: 8.5, style: 'pyramid',
      tiers: 1, tierH: 2.0, eave: 2.8, railing: true
    });

    // 保和殿
    HALL({
      x: 0, y: TAI_H, z: -14, info: INFO.baohedian, plaque: '保和殿',
      w: 50, d: 26, h: 11, roofH: 11, style: 'xieshan', double: true,
      tiers: 1, tierH: 2.0, eave: 3.0
    });

    // 乾清门
    HALL({
      x: 0, z: -108, info: INFO.qianqingmen, plaque: '乾清门',
      w: 32, d: 15, h: 8, roofH: 6, style: 'xieshan',
      tiers: 1, tierH: 1.8, eave: 2.2, double: false
    });

    // 乾清宫
    HALL({
      x: 0, z: -190, info: INFO.qianqinggong, plaque: '乾清宫',
      w: 46, d: 26, h: 10.5, roofH: 11, style: 'hip', double: true,
      tiers: 1, tierH: 2.0, eave: 2.9
    });
    // 交泰殿
    HALL({
      x: 0, z: -248, info: INFO.jiaotaidian, plaque: '交泰殿',
      w: 17, d: 17, h: 7, roofH: 6.5, style: 'pyramid',
      tiers: 1, tierH: 1.6, eave: 2.0
    });
    // 坤宁宫
    HALL({
      x: 0, z: -302, info: INFO.kunninggong, plaque: '坤宁宫',
      w: 40, d: 22, h: 10, roofH: 10.5, style: 'hip', double: true,
      tiers: 1, tierH: 2.0, eave: 2.8
    });
    // 坤宁门
    HALL({
      x: 0, z: -354, info: INFO.kunningmen, plaque: '坤宁门',
      w: 22, d: 11, h: 6.5, roofH: 5, style: 'xieshan',
      tiers: 1, tierH: 1.4, eave: 1.8
    });

    // 神武门
    const swm = GG.build.createGateTower({
      w: 62, d: 26, h: 12,
      mainW: 42, mainD: 16, mainH: 10, roofH: 8,
      doors: 1, wings: false, info: INFO.shenwumen, plaque: '神武门'
    });
    add(scene, swm, { x: 0, z: -462 });

    /* ---------- 太和殿广场：御路、品级山、铜陈设 ---------- */
    // 御路（中轴浅色石板带）
    const axisTex = t.paving.clone();
    axisTex.needsUpdate = true;
    axisTex.repeat.set(4, 40);
    const axisRoad = new THREE.Mesh(
      new THREE.PlaneGeometry(15, 116),
      new THREE.MeshStandardMaterial({ map: axisTex, color: 0xc4bfae, roughness: 0.94 })
    );
    axisRoad.rotation.x = -Math.PI / 2;
    axisRoad.position.set(0, 0.035, 243);
    axisRoad.receiveShadow = true;
    scene.add(axisRoad);

    // 三台大台阶中央的云龙御路
    const yuLu = new THREE.Mesh(
      new THREE.BoxGeometry(6.6, 0.34, 14.6),
      new THREE.MeshStandardMaterial({
        map: t.carvedStone, bumpMap: t.carvedStone, bumpScale: 0.55,
        color: 0xded8c6, roughness: 0.82, metalness: 0.03
      })
    );
    yuLu.position.set(0, 4.12, 188.6);
    yuLu.rotation.x = 0.594;
    yuLu.castShadow = true;
    yuLu.receiveShadow = true;
    scene.add(yuLu);

    // 品级山：广场东西各九座
    const pins = [];
    for (let i = 0; i < 9; i++) {
      const z = 200 + i * 10.5;
      for (const sx of [-1, 1]) {
        pins.push(GG.geo.box(1.15, 1.0, 0.95, { x: sx * 9.5, y: 0.5, z }));
        pins.push(GG.geo.box(1.35, 0.18, 1.15, { x: sx * 9.5, y: 1.06, z }));
      }
    }
    const pinMesh = new THREE.Mesh(GG.geo.merge(pins), M.marble);
    pinMesh.castShadow = true;
    pinMesh.receiveShadow = true;
    scene.add(pinMesh);

    // 月台上的铜鹤、铜龟、日晷、嘉量
    const BR = GG.build.createBronzeSet;
    const Y_TAI = TAI_H + 2.4;
    for (const sx of [-1, 1]) {
      const crane = BR('crane', sx * 16, 158);
      crane.position.y = Y_TAI;
      crane.rotation.y = sx > 0 ? -0.4 : 0.4;
      scene.add(crane);
      const vat = BR('vat', sx * 9, 158);
      vat.position.y = Y_TAI;
      vat.scale.setScalar(0.82);
      scene.add(vat);
    }
    for (const [sx, z] of [[1, 150], [-1, 150]]) {
      const gn = BR('sundial', sx * 27, z);
      gn.position.y = Y_TAI;
      scene.add(gn);
    }

    // 广场太平缸
    for (const [vx, vz] of [[-56, 258], [56, 258], [-56, 214], [56, 214]]) {
      const v = BR('vat', vx, vz);
      v.scale.setScalar(1.25);
      scene.add(v);
    }

    /* ================= 前朝两翼 ================= */

    // 体仁阁 / 弘义阁
    HALL({
      x: 92, z: 140, info: INFO.tirenge, plaque: '体仁阁',
      w: 30, d: 18, h: 11.5, roofH: 8.5, style: 'xieshan', double: true,
      tiers: 2, tierH: 1.6, eave: 2.4
    });
    HALL({
      x: -92, z: 140, info: INFO.hongyige, plaque: '弘义阁',
      w: 30, d: 18, h: 11.5, roofH: 8.5, style: 'xieshan', double: true,
      tiers: 2, tierH: 1.6, eave: 2.4
    });

    // 太和殿广场东西庑
    for (const sx of [-1, 1]) {
      const c = GG.build.createCorridor({
        length: 108, depth: 9, h: 5.2, roofH: 4.6, info: null
      });
      add(scene, c, { x: sx * 104, z: 242, ry: Math.PI / 2 });
    }
    // 太和门广场东西庑
    for (const sx of [-1, 1]) {
      const c = GG.build.createCorridor({
        length: 120, depth: 9, h: 5.0, roofH: 4.4, info: null
      });
      add(scene, c, { x: sx * 104, z: 378, ry: Math.PI / 2 });
    }

    // 协和门 / 熙和门
    HALL({
      x: 104, z: 318, ry: Math.PI / 2, info: INFO.xiehemen, plaque: '协和门',
      w: 22, d: 12, h: 8, roofH: 6.5, style: 'xieshan',
      tiers: 1, tierH: 1.4, eave: 1.8
    });
    HALL({
      x: -104, z: 318, ry: Math.PI / 2, info: INFO.xihemen, plaque: '熙和门',
      w: 22, d: 12, h: 8, roofH: 6.5, style: 'xieshan',
      tiers: 1, tierH: 1.4, eave: 1.8
    });

    // 后三宫东西庑
    for (const sx of [-1, 1]) {
      const c = GG.build.createCorridor({ length: 150, depth: 8.5, h: 4.8, roofH: 4.2, info: null });
      add(scene, c, { x: sx * 46, z: -230, ry: Math.PI / 2 });
    }

    /* ---------- 内廷门阙：把各段广场与两路的边界立起来 ---------- */
    // 贞度门 / 昭德门：太和门两翼，前朝正门的东西侧门
    for (const sx of [-1, 1]) {
      HALL({
        x: sx * 56, z: 306, info: null,
        plaque: sx > 0 ? '贞度门' : '昭德门',
        w: 16, d: 10, h: 7, roofH: 5.4, style: 'xieshan',
        tiers: 1, tierH: 1.2, eave: 1.6
      });
    }
    // 后左门 / 后右门：三台东西两阙，乾清门广场的南口
    for (const sx of [-1, 1]) {
      HALL({
        x: sx * 72, z: -56, info: null,
        plaque: sx > 0 ? '后左门' : '后右门',
        w: 15, d: 9.5, h: 6.6, roofH: 5, style: 'xieshan',
        tiers: 1, tierH: 1.2, eave: 1.5
      });
    }
    // 景运门 / 隆宗门：乾清门广场东西两阙（清代军机处即在隆宗门内值房）
    for (const sx of [-1, 1]) {
      HALL({
        x: sx * 52, z: -108, info: sx > 0 ? INFO.jingyunmen : INFO.longzongmen,
        plaque: sx > 0 ? '景运门' : '隆宗门',
        w: 17, d: 10, h: 7, roofH: 5.6, style: 'xieshan',
        tiers: 1, tierH: 1.4, eave: 1.7
      });
    }
    // 乾清门前铜狮（与太和门一对东西对峙）
    for (const sx of [-1, 1]) lion(scene, sx * 11, -98, sx > 0 ? -0.22 : 0.22);

    /* ---------- 内廷两侧院落：养心殿 / 斋宫 / 毓庆宫 + 乾清宫东西小殿 ---------- */
    // 乾清宫东西小殿：弘德殿（西）/ 昭仁殿（东）
    HALL({
      x: -34, z: -190, info: INFO.hongdedian, plaque: '弘德殿',
      w: 10, d: 10, h: 6.2, roofH: 4.6, style: 'xieshan',
      tiers: 1, tierH: 1.2, eave: 1.5
    });
    HALL({
      x: 34, z: -190, info: INFO.zhaorendian, plaque: '昭仁殿',
      w: 10, d: 10, h: 6.2, roofH: 4.6, style: 'xieshan',
      tiers: 1, tierH: 1.2, eave: 1.5
    });

    // 养心殿院落（内廷西路，雍正以后皇帝的实际寝宫与理政之所）
    const YX = { x: -88, z: -150, w: 52, d: 62 };
    yardPave(scene, YX.w - 4, YX.d - 4, YX.x, YX.z);
    wallBox(scene, YX.x, YX.z, YX.w, YX.d, 5.2, 14);
    HALL({
      x: YX.x, z: -117, info: null, plaque: '养心门',
      w: 14, d: 8, h: 6.2, roofH: 4.8, style: 'xieshan',
      tiers: 1, tierH: 1.1, eave: 1.5
    });
    HALL({
      x: YX.x, z: -146, info: INFO.yangxindian, plaque: '养心殿',
      w: 30, d: 16, h: 9, roofH: 7, style: 'xieshan',
      tiers: 1, tierH: 1.8, eave: 2.2
    });
    HALL({
      x: YX.x, z: -172, info: null,
      w: 24, d: 12, h: 7, roofH: 5.4, style: 'xieshan',
      tiers: 1, tierH: 1.4, eave: 1.8
    });
    for (const sx of [-1, 1]) {
      const side = GG.build.createHall({
        w: 7, d: 15, h: 5.2, roofH: 3.9, style: 'gable',
        tiers: 1, tierH: 0.8, railing: false, stairs: false, eave: 1.2, info: null
      });
      side.position.set(YX.x + sx * 18, 0, -146);
      side.rotation.y = Math.PI / 2;
      scene.add(side);
    }
    // 军机处值房（隆宗门内，清代最高承旨机构）
    const jjc = GG.build.createCorridor({ length: 26, depth: 9, h: 4.2, roofH: 3.4, info: INFO.junjichu });
    add(scene, jjc, { x: YX.x, z: -96, ry: Math.PI / 2 });

    // 斋宫院落（内廷东路，大祀前斋戒之所）
    const ZG = { x: 88, z: -136, w: 48, d: 54 };
    yardPave(scene, ZG.w - 4, ZG.d - 4, ZG.x, ZG.z);
    wallBox(scene, ZG.x, ZG.z, ZG.w, ZG.d, 5.0, 14);
    HALL({
      x: ZG.x, z: -134, info: INFO.zhaigong, plaque: '斋宫',
      w: 26, d: 15, h: 8.5, roofH: 6.6, style: 'xieshan', double: true,
      tiers: 1, tierH: 1.6, eave: 2.0
    });
    for (const sx of [-1, 1]) {
      const side = GG.build.createHall({
        w: 7, d: 14, h: 4.8, roofH: 3.6, style: 'gable',
        tiers: 1, tierH: 0.8, railing: false, stairs: false, eave: 1.1, info: null
      });
      side.position.set(ZG.x + sx * 15, 0, -136);
      side.rotation.y = Math.PI / 2;
      scene.add(side);
    }

    // 毓庆宫院落（斋宫之北，皇子读书、居住之地）
    const YQ = { x: 88, z: -204, w: 48, d: 54 };
    yardPave(scene, YQ.w - 4, YQ.d - 4, YQ.x, YQ.z);
    wallBox(scene, YQ.x, YQ.z, YQ.w, YQ.d, 5.0, 14);
    HALL({
      x: YQ.x, z: -202, info: INFO.yuqingong, plaque: '毓庆宫',
      w: 26, d: 15, h: 8.5, roofH: 6.6, style: 'xieshan', double: true,
      tiers: 1, tierH: 1.6, eave: 2.0
    });

    /* ================= 东西两路 ================= */

    // 文华殿
    HALL({
      x: 186, z: 250, info: INFO.wenhuadian, plaque: '文华殿',
      w: 34, d: 22, h: 10, roofH: 8, style: 'xieshan',
      tiers: 2, tierH: 1.6, eave: 2.4, green: false
    });
    // 武英殿
    HALL({
      x: -186, z: 250, info: INFO.wuyingdian, plaque: '武英殿',
      w: 34, d: 22, h: 10, roofH: 8, style: 'xieshan',
      tiers: 2, tierH: 1.6, eave: 2.4
    });
    // 奉先殿
    HALL({
      x: 150, z: -30, info: INFO.fengxiandian, plaque: '奉先殿',
      w: 36, d: 20, h: 10.5, roofH: 8, style: 'hip', double: true,
      tiers: 2, tierH: 1.6, eave: 2.4
    });
    // 慈宁宫
    HALL({
      x: -200, z: -55, info: INFO.cininggong, plaque: '慈宁宫',
      w: 36, d: 22, h: 10, roofH: 8, style: 'xieshan', double: true,
      tiers: 2, tierH: 1.6, eave: 2.4
    });
    // 寿康宫
    HALL({
      x: -286, z: -55, info: INFO.shoukanggong, plaque: '寿康宫',
      w: 26, d: 16, h: 8.5, roofH: 6.5, style: 'xieshan',
      tiers: 1, tierH: 1.6, eave: 2.0
    });
    /* 皇极殿已迁入下方「宁寿宫区」院落内居中布置，见东路一节 */

    /* ---------- 文华殿后 / 武英殿后：配套院落 ---------- */
    // 文华殿后：主敬殿 + 文渊阁（黑瓦绿剪边，藏《四库全书》）
    HALL({
      x: 186, z: 222, info: INFO.zhuijingdian, plaque: '主敬殿',
      w: 26, d: 14, h: 8, roofH: 6.4, style: 'xieshan',
      tiers: 1, tierH: 1.4, eave: 1.9
    });
    HALL({
      x: 186, z: 196, info: INFO.wenyuange, plaque: '文渊阁',
      w: 28, d: 15, h: 9, roofH: 7, style: 'xieshan', green: true,
      tiers: 1, tierH: 1.5, eave: 2.0
    });
    // 武英殿后：浴德堂 + 南薰殿
    HALL({
      x: -186, z: 222, info: INFO.nudetang, plaque: '浴德堂',
      w: 18, d: 12, h: 6.5, roofH: 5, style: 'xieshan',
      tiers: 1, tierH: 1.2, eave: 1.6
    });
    HALL({
      x: -186, z: 288, info: INFO.nanxundian, plaque: '南薰殿',
      w: 26, d: 14, h: 7.5, roofH: 6, style: 'xieshan',
      tiers: 1, tierH: 1.4, eave: 1.8
    });

    /* ================= 东六宫 ================= */
    const eastSix = [
      [INFO.jingrengong, 150, -150], [INFO.chengqiangong, 150, -212], [INFO.zhongcuigong, 150, -274],
      [INFO.yanxigong, 224, -150], [INFO.yonghegong, 224, -212], [INFO.jingyanggong, 224, -274]
    ];
    for (const [info, x, z] of eastSix) {
      courtyard(scene, { x, z, w: 62, d: 66, info });
    }

    /* ================= 西六宫 ================= */
    const westSix = [
      [INFO.yongshougong, -150, -150], [INFO.yikungong, -150, -212], [INFO.chuxiugong, -150, -274],
      [INFO.qixianggong, -224, -150], [INFO.changchungong, -224, -212], [INFO.xianfugong, -224, -274]
    ];
    for (const [info, x, z] of westSix) {
      courtyard(scene, { x, z, w: 62, d: 66, info });
    }

    /* ================= 东西华门 & 附属值房 ================= */
    for (const sx of [-1, 1]) {
      const g = GG.build.createHall({
        w: 22, d: 14, h: 8.5, roofH: 7, style: 'xieshan', double: true,
        tiers: 2, tierH: 1.4, eave: 2.0,
        info: sx > 0 ? INFO.donghuamen : INFO.xihuamen,
        plaque: sx > 0 ? '东华门' : '西华门'
      });
      g.position.set(sx * 376, 0, 196);   // 落在城墙缺口上，两侧不再被实墙挡住
      g.rotation.y = Math.PI / 2;
      scene.add(g);
      REG.push(g);
    }

    // 城墙内侧的值房 / 库房（填充东西两翼与北侧空地）
    const fills = [
      [-316, 300], [-316, 268], [-316, 168], [-316, 60], [-316, -10],
      [316, 300], [316, 268], [316, 168], [316, 60], [316, -40],
      [-316, -230], [316, -230], [316, -140],
      [280, -180], [280, -250], [-280, -250],
      [-160, -440], [-160, -390], [160, -390], [160, -440],
      [-112, -440], [112, -440], [-330, -440], [330, -440],
      [272, -350]
    ];
    for (const [fx, fz] of fills) {
      const c = GG.build.createCorridor({
        length: 62, depth: 11, h: 4.6, roofH: 3.8, info: null
      });
      c.position.set(fx, 0, fz);
      c.rotation.y = Math.PI / 2;
      scene.add(c);
    }

    /* ================= 外东路：南三所 / 箭亭 / 上驷院 ================= */
    // 南三所：三所并列的皇子居所，绿琉璃瓦（俗称“阿哥所”）
    for (let i = 0; i < 3; i++) {
      const cx = 232 + i * 30;
      yardPave(scene, 26, 56, cx, 256);
      wallBox(scene, cx, 256, 30, 60, 5.0, 12);
      HALL({
        x: cx, z: 246, info: i === 1 ? INFO.nansansuo : null,
        plaque: i === 1 ? '南三所' : null, green: true,
        w: 20, d: 12, h: 7, roofH: 5.6, style: 'xieshan',
        tiers: 1, tierH: 1.3, eave: 1.7
      });
    }
    // 箭亭：四面开敞的方殿（习射、阅武之所）
    HALL({
      x: 250, z: 150, info: INFO.jianting, plaque: '箭亭',
      w: 20, d: 20, h: 7, roofH: 6, style: 'xieshan',
      tiers: 1, tierH: 1.4, eave: 1.9, railing: false, stairs: false
    });
    // 上驷院：御马衙署
    yardPave(scene, 36, 56, 200, 150);
    wallBox(scene, 200, 150, 40, 60, 5.0, 12);
    HALL({
      x: 200, z: 140, info: INFO.shangsiyuan, plaque: '上驷院',
      w: 24, d: 14, h: 7, roofH: 5.6, style: 'xieshan',
      tiers: 1, tierH: 1.3, eave: 1.7
    });
    // 东华门内的库房值房（补齐东南角近墙空地）
    for (const [fx, fz] of [[348, 300], [348, 120], [270, 60], [200, 300]]) {
      const c = GG.build.createCorridor({ length: 46, depth: 11, h: 4.4, roofH: 3.6, info: null });
      c.position.set(fx, 0, fz);
      c.rotation.y = Math.PI / 2;
      scene.add(c);
    }

    /* ================= 外西路：咸安宫 / 英华殿 / 内务府 ================= */
    yardPave(scene, 52, 60, -250, 150);
    wallBox(scene, -250, 150, 56, 64, 5.2, 14);
    HALL({
      x: -250, z: 142, info: INFO.xianangong, plaque: '咸安宫',
      w: 30, d: 16, h: 8, roofH: 6.4, style: 'xieshan',
      tiers: 1, tierH: 1.5, eave: 1.9
    });
    HALL({
      x: -290, z: 60, info: INFO.yinghuadian, plaque: '英华殿',
      w: 26, d: 16, h: 8.5, roofH: 6.5, style: 'xieshan',
      tiers: 1, tierH: 1.5, eave: 1.9
    });
    HALL({
      x: -140, z: 90, info: INFO.neiwufu, plaque: '内务府',
      w: 32, d: 18, h: 7.5, roofH: 6, style: 'xieshan',
      tiers: 1, tierH: 1.5, eave: 1.9
    });
    // 西侧近墙库房值房（补齐西南角空地）
    for (const [fx, fz] of [[-348, 300], [-348, 120], [-140, 150], [-330, 30]]) {
      const c = GG.build.createCorridor({ length: 46, depth: 11, h: 4.4, roofH: 3.6, info: null });
      c.position.set(fx, 0, fz);
      c.rotation.y = Math.PI / 2;
      scene.add(c);
    }

    /* ---------- 西路：寿安宫 + 慈宁宫花园 ---------- */
    HALL({
      x: -245, z: -25, info: INFO.shouangong, plaque: '寿安宫',
      w: 26, d: 16, h: 8.5, roofH: 6.5, style: 'xieshan', double: true,
      tiers: 2, tierH: 1.6, eave: 2.0
    });

    // 慈宁宫花园：咸若馆 / 临溪亭 / 含清斋 围一方水池
    const CNG = { x: -318, z: -135, w: 90, d: 150 };
    yardPave(scene, CNG.w - 6, CNG.d - 6, CNG.x, CNG.z);
    wallBox(scene, CNG.x, CNG.z, CNG.w, CNG.d, 5.5, 18);
    HALL({
      x: CNG.x, z: -196, info: null, plaque: '咸若馆',
      w: 20, d: 12, h: 8, roofH: 6, style: 'xieshan',
      tiers: 1, tierH: 1.4, eave: 1.8
    });
    const lxt = GG.build.createPavilion({
      w: 9, h: 4.6, roofH: 5, tiers: 1, info: INFO.linxiting
    });
    add(scene, lxt, { x: CNG.x, z: -152 });
    HALL({
      x: CNG.x, z: -100, info: null, plaque: '含清斋',
      w: 22, d: 13, h: 8, roofH: 6, style: 'xieshan',
      tiers: 1, tierH: 1.4, eave: 1.8
    });
    pool(scene, 22, 34, CNG.x, -128);
    lawn(scene, CNG.w - 14, 32, CNG.x, -128);
    bed(scene, CNG.x - 26, -100, 2.6);
    bed(scene, CNG.x + 26, -100, 2.6);

    /* ---------- 东路：宁寿宫区（乾隆内廷） + 乾隆花园 ---------- */
    const NS = { x: 236, z: -398, w: 120, d: 152 };
    yardPave(scene, NS.w - 8, NS.d - 8, NS.x, NS.z);
    wallBox(scene, NS.x, NS.z, NS.w, NS.d, 5.5, 26);
    // 皇极门：南口
    HALL({
      x: NS.x, z: -322, info: null, plaque: '皇极门',
      w: 24, d: 12, h: 8, roofH: 6, style: 'xieshan',
      tiers: 1, tierH: 1.4, eave: 1.8
    });
    // 皇极殿：正殿（原址 z=-330 孤立在院落南侧，北移入院内居中）
    HALL({
      x: NS.x, z: -352, info: INFO.huangjidian, plaque: '皇极殿',
      w: 38, d: 22, h: 11, roofH: 8.5, style: 'xieshan', double: true,
      tiers: 2, tierH: 1.8, eave: 2.6
    });
    // 宁寿宫：皇极殿之后的寝宫
    HALL({
      x: NS.x, z: -392, info: INFO.ningshougong, plaque: '宁寿宫',
      w: 32, d: 18, h: 10, roofH: 8, style: 'xieshan', double: true,
      tiers: 2, tierH: 1.6, eave: 2.4
    });
    // 养性殿：北端正殿
    HALL({
      x: NS.x, z: -434, info: INFO.yangxingdian, plaque: '养性殿',
      w: 28, d: 16, h: 9, roofH: 7, style: 'xieshan', double: true,
      tiers: 1, tierH: 1.6, eave: 2.0
    });
    // 乐寿堂：东路
    HALL({
      x: 272, z: -412, info: INFO.leshoutang, plaque: '乐寿堂',
      w: 22, d: 14, h: 8, roofH: 6.5, style: 'xieshan',
      tiers: 1, tierH: 1.4, eave: 1.8
    });
    // 畅音阁：西路大戏台，三层檐
    HALL({
      x: 200, z: -374, info: INFO.changyinge, plaque: '畅音阁',
      w: 20, d: 13, h: 8.5, roofH: 6.5, style: 'xieshan',
      tiers: 3, tierH: 1.6, eave: 1.9
    });
    // 倦勤斋：西路
    HALL({
      x: 200, z: -432, info: INFO.juanqinzhai, plaque: '倦勤斋',
      w: 18, d: 12, h: 7, roofH: 5.5, style: 'gable',
      tiers: 1, tierH: 1.2, eave: 1.5
    });
    lawn(scene, NS.w - 26, 30, NS.x, -400);

    // 乾隆花园：符望阁 / 古华轩 / 禊赏亭 + 假山
    const QLG = { x: 336, z: -375, w: 76, d: 92 };
    yardPave(scene, QLG.w - 6, QLG.d - 6, QLG.x, QLG.z);
    wallBox(scene, QLG.x, QLG.z, QLG.w, QLG.d, 4.6, 14);
    HALL({
      x: QLG.x, z: -390, info: INFO.fuwangge, plaque: '符望阁',
      w: 14, d: 14, h: 7, roofH: 6.5, style: 'pyramid',
      tiers: 2, tierH: 1.6, eave: 2.0, green: true
    });
    const ghx = GG.build.createPavilion({
      w: 10, h: 4.6, roofH: 4.4, tiers: 2, info: null, green: true
    });
    add(scene, ghx, { x: 322, z: -352 });
    const xst = GG.build.createPavilion({
      w: 7, h: 4, roofH: 4, tiers: 1, info: null, green: true
    });
    add(scene, xst, { x: 354, z: -398 });
    rockery(scene, QLG.x, -414, 8, 12, 2);
    lawn(scene, QLG.w - 16, 34, QLG.x, -366);
    bed(scene, 312, -396, 2.2);

    /* ================= 御花园 ================= */
    const GARDEN_Z = -410;
    // 钦安殿
    HALL({
      x: 0, z: GARDEN_Z + 12, info: INFO.qinandian, plaque: '钦安殿',
      w: 20, d: 14, h: 8, roofH: 5.5, style: 'xieshan', double: true,
      tiers: 2, tierH: 1.2, eave: 2.0
    });
    // 万春亭 / 千秋亭
    const wc = GG.build.createPavilion({
      w: 11, h: 5.4, roofH: 7, tiers: 2, info: INFO.wanchunting
    });
    add(scene, wc, { x: 40, z: GARDEN_Z - 4 });
    const qq = GG.build.createPavilion({
      w: 11, h: 5.4, roofH: 7, tiers: 2, info: INFO.qianqiuting
    });
    add(scene, qq, { x: -40, z: GARDEN_Z - 4 });
    // 浮碧亭 / 澄瑞亭
    for (const sx of [-1, 1]) {
      const p = GG.build.createPavilion({ w: 8, h: 4.4, roofH: 5, tiers: 1, info: null });
      add(scene, p, { x: sx * 40, z: GARDEN_Z - 44 });
    }

    // 堆秀山（假山 + 御景亭）
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x5c564c, roughness: 1, flatShading: true });
    const rocks = [];
    for (let i = 0; i < 14; i++) {
      const r = 3 + Math.random() * 3.4;
      rocks.push(
        GG.geo.xform(new THREE.DodecahedronGeometry(r, 0), {
          x: (Math.random() - 0.5) * 16,
          y: 2 + Math.random() * 6,
          z: (Math.random() - 0.5) * 12,
          ry: Math.random() * 3, sx: 1.2, sy: 0.8
        })
      );
    }
    const rockMesh = new THREE.Mesh(GG.geo.merge(rocks), rockMat);
    rockMesh.position.set(-52, 0, GARDEN_Z - 58);
    rockMesh.castShadow = true;
    rockMesh.receiveShadow = true;
    scene.add(rockMesh);
    const yjt = GG.build.createPavilion({ w: 7, h: 4, roofH: 4.2, tiers: 1, info: INFO.duixiushan });
    add(scene, yjt, { x: -52, y: 10, z: GARDEN_Z - 58 });

    /* ---------- 御花园的地面：草坪 / 甬路 / 水池 / 花坛 / 井亭 ---------- */
    // 整园铺草，殿宇台基从草里长出来
    lawn(scene, 158, 112, 0, GARDEN_Z - 10);
    // 万春亭—千秋亭前的一方水池，把中轴甬路分成南北两段
    pool(scene, 60, 14, 0, GARDEN_Z - 24);
    // 中轴甬路：坤宁门 → 水池 → 神武门
    path(scene, 11, 52, 0, GARDEN_Z - 10);
    path(scene, 11, 29, 0, GARDEN_Z - 45);
    // 东西向甬路：万春亭—千秋亭一线与南端一路
    path(scene, 116, 8, 0, GARDEN_Z - 4);
    path(scene, 96, 7, 0, GARDEN_Z - 50);
    // 花坛若干（避开殿宇台基、水池与神武门）
    for (const [bx, bz] of [
      [0, GARDEN_Z - 30], [-62, GARDEN_Z + 6], [62, GARDEN_Z + 6],
      [-58, GARDEN_Z - 56], [58, GARDEN_Z - 56], [44, GARDEN_Z - 58]
    ]) {
      bed(scene, bx, bz, 3.0);
    }
    // 四角井亭（园内四角的小亭）
    for (const sx of [-1, 1]) {
      for (const zoff of [-32, -50]) {
        const jt = GG.build.createPavilion({ w: 5, h: 3.2, roofH: 3.0, tiers: 1, info: null, green: true });
        add(scene, jt, { x: sx * 66, z: GARDEN_Z + zoff });
      }
    }

    /* ================= 城墙 & 角楼 ================= */
    const WALL_X = 376, WALL_Z = 480, WALL_H = 9.6;
    /* 四面城墙各依城门留缺口：午门、神武门居中，东西华门位于 z=196 偏南 */
    const wallRuns = [
      { axis: 'x', pos: WALL_Z, from: -WALL_X, to: WALL_X, gaps: [[-50, 50]] },   // 南墙 · 午门
      { axis: 'x', pos: -WALL_Z, from: -WALL_X, to: WALL_X, gaps: [[-33, 33]] },  // 北墙 · 神武门
      { axis: 'z', pos: WALL_X, from: -WALL_Z, to: WALL_Z, gaps: [[180, 212]] },  // 东墙 · 东华门
      { axis: 'z', pos: -WALL_X, from: -WALL_Z, to: WALL_Z, gaps: [[180, 212]] }  // 西墙 · 西华门
    ];
    for (const run of wallRuns) {
      const spans = [];
      let cursor = run.from;
      for (const gap of run.gaps) {
        if (gap[0] > cursor) spans.push([cursor, gap[0]]);
        cursor = gap[1];
      }
      if (cursor < run.to) spans.push([cursor, run.to]);
      for (const [a, b] of spans) {
        const w = GG.build.createWall({ length: b - a, h: WALL_H, t: 2.6, crenel: true });
        if (run.axis === 'x') {
          w.position.set((a + b) / 2, 0, run.pos);
        } else {
          w.position.set(run.pos, 0, (a + b) / 2);
          w.rotation.y = Math.PI / 2;
        }
        scene.add(w);
      }
    }

    // 四角马道：城内地面登上城墙顶的斜坡（高端抵墙体内侧）
    const RD = 26;
    const ramps = [
      { x: WALL_X - 28, z: WALL_Z - 14, ry: Math.PI },      // 南墙东段
      { x: -WALL_X + 28, z: WALL_Z - 14, ry: Math.PI },     // 南墙西段
      { x: WALL_X - 28, z: -WALL_Z + 14, ry: 0 },           // 北墙东段
      { x: -WALL_X + 28, z: -WALL_Z + 14, ry: 0 }           // 北墙西段
    ];
    for (const r of ramps) {
      const rp = GG.build.createRamp({ w: 6, len: RD, rise: WALL_H + 1.1 });
      rp.position.set(r.x, 0, r.z);
      rp.rotation.y = r.ry;
      scene.add(rp);
    }

    // 角楼
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const g = new THREE.Group();
        // 台座
        const base = new THREE.Mesh(new THREE.BoxGeometry(17, 3, 17), M.stone);
        base.position.y = 1.5;
        base.castShadow = true;
        base.receiveShadow = true;
        g.add(base);
        // 三层楼身
        let y = 3, w = 13, h = 5.0;
        for (let i = 0; i < 3; i++) {
          const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), M.wall);
          body.position.y = y + h / 2;
          g.add(body);
          // 十字歇山用两个交叉的两坡顶拼合
          for (let k = 0; k < 2; k++) {
            const rg = GG.geo.roofGeometry({
              hw: w / 2 + 2.2, hd: w / 2 + 2.2, topX: w / 2 + 2.2, topZ: 0,
              h: 2.6 + (2 - i) * 1.4, curv: GG.CONFIG.roof.curv, lift: 0.75,
              uSeg: 8, vSeg: 3, withSides: false, sideVMax: 0
            });
            const rm = new THREE.Mesh(rg, M.tile);
            rm.position.y = y + h;
            rm.rotation.y = k * Math.PI / 2;
            rm.castShadow = true;
            g.add(rm);
          }
          y += h + 1.0;
          w *= 0.76;
          h *= 0.82;
        }
        g.position.set(sx * (WALL_X - 14), 0, sz * (WALL_Z - 14));
        g.userData.info = INFO.jiaolou;
        g.userData.isBuilding = true;
        g.userData.labelY = 22;
        g.userData.pickRadius = 14;
        REG.push(g);
        scene.add(g);
      }
    }

    /* ================= 护城河 ================= */
    const moatShape = new THREE.Shape();
    const MW = WALL_X + 62, MZ = WALL_Z + 62;
    moatShape.moveTo(-MW, -MZ);
    moatShape.lineTo(MW, -MZ);
    moatShape.lineTo(MW, MZ);
    moatShape.lineTo(-MW, MZ);
    moatShape.lineTo(-MW, -MZ);
    const hole = new THREE.Path();
    const IW = WALL_X + 14, IZ = WALL_Z + 14;
    hole.moveTo(-IW, -IZ);
    hole.lineTo(-IW, IZ);
    hole.lineTo(IW, IZ);
    hole.lineTo(IW, -IZ);
    hole.lineTo(-IW, -IZ);
    moatShape.holes.push(hole);
    const moatGeo = new THREE.ShapeGeometry(moatShape);
    const moat = new THREE.Mesh(moatGeo, M.water);
    moat.rotation.x = -Math.PI / 2;
    moat.position.y = 0.08;
    scene.add(moat);
    // 河岸
    const bankGeo = new THREE.ShapeGeometry(moatShape);
    const bank = new THREE.Mesh(bankGeo, new THREE.MeshStandardMaterial({ color: 0x7d7a6c, roughness: 1 }));
    bank.rotation.x = -Math.PI / 2;
    bank.position.y = 0.02;
    bank.receiveShadow = true;
    scene.add(bank);

    /* 护城河上的四座石桥：东华门 / 西华门 / 午门（南） / 神武门（北） */
    for (const b of [
      { x: 414, z: 196, along: 'x' },
      { x: -414, z: 196, along: 'x' },
      { x: 0, z: 518, along: 'z' },
      { x: 0, z: -518, along: 'z' }
    ]) {
      const span = 52, wide = 14;
      const deck = new THREE.Mesh(
        b.along === 'x'
          ? new THREE.BoxGeometry(span, 1.3, wide)
          : new THREE.BoxGeometry(wide, 1.3, span),
        M.marble
      );
      deck.position.set(b.x, 0.75, b.z);
      deck.castShadow = true;
      deck.receiveShadow = true;
      scene.add(deck);
      for (const s of [-1, 1]) {
        const rail = new THREE.Mesh(
          b.along === 'x'
            ? new THREE.BoxGeometry(span, 1.1, 0.5)
            : new THREE.BoxGeometry(0.5, 1.1, span),
          M.marble
        );
        rail.position.set(
          b.along === 'x' ? b.x : b.x + s * (wide / 2 - 0.3),
          1.4,
          b.along === 'x' ? b.z + s * (wide / 2 - 0.3) : b.z
        );
        rail.castShadow = true;
        scene.add(rail);
      }
    }

    /* ================= 景山（紫禁城北面的万岁山，中轴线的收束） ================= */
    const HILL = { x: 0, z: -880, r: 200, h: 46 };
    const hillGeo = new THREE.SphereGeometry(HILL.r, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    hillGeo.scale(1, HILL.h / HILL.r, 0.72);
    const hillMat = new THREE.MeshStandardMaterial({
      map: t.ground, color: 0x6f7452, roughness: 1
    });
    const hillTex = t.ground.clone();
    hillTex.needsUpdate = true;
    hillTex.repeat.set(26, 18);
    hillMat.map = hillTex;
    const hill = new THREE.Mesh(hillGeo, hillMat);
    hill.position.set(HILL.x, -0.1, HILL.z);
    hill.receiveShadow = true;
    scene.add(hill);

    // 山面高度函数（树与亭都贴着坡面落座）
    const hillY = (x, z) => {
      const dx = (x - HILL.x) / HILL.r;
      const dz = (z - HILL.z) / (HILL.r * 0.72);
      const dd = dx * dx + dz * dz;
      return dd >= 1 ? 0 : Math.max(0, HILL.h * Math.sqrt(1 - dd) - 1.2);
    };
    // 山巅万春亭
    const wz = GG.build.createPavilion({ w: 9, h: 5, roofH: 5.6, tiers: 2, info: null });
    wz.position.set(HILL.x, HILL.h - 0.6, HILL.z);
    scene.add(wz);
    // 山肩四亭：周赏 / 观妙 / 辑芳 / 富览
    const hillPav = [
      { x: 150, z: -880, p: '周赏亭' },
      { x: -150, z: -880, p: '观妙亭' },
      { x: 0, z: -1010, p: '辑芳亭' },
      { x: 0, z: -750, p: '富览亭' }
    ];
    for (const hp of hillPav) {
      const p = GG.build.createPavilion({ w: 8, h: 4.4, roofH: 5, tiers: 1, info: null });
      add(scene, p, { x: hp.x, y: hillY(hp.x, hp.z), z: hp.z });
    }
    // 寿皇殿建筑群：景山东麓的独立院落
    const SH = { x: 270, z: -900, w: 120, d: 110 };
    yardPave(scene, SH.w - 8, SH.d - 8, SH.x, SH.z);
    wallBox(scene, SH.x, SH.z, SH.w, SH.d, 5.5, 22);
    HALL({
      x: SH.x, z: -852, info: null, plaque: '寿皇门',
      w: 22, d: 11, h: 8, roofH: 6, style: 'xieshan',
      tiers: 1, tierH: 1.4, eave: 1.8
    });
    HALL({
      x: SH.x, z: -908, info: INFO.shouhuangdian, plaque: '寿皇殿',
      w: 34, d: 20, h: 10, roofH: 8, style: 'xieshan', double: true,
      tiers: 2, tierH: 1.6, eave: 2.4
    });
    for (const sx of [-1, 1]) {
      const side = GG.build.createHall({
        w: 15, d: 19, h: 6.6, roofH: 4.8, style: 'gable',
        tiers: 1, tierH: 0.9, railing: false, stairs: false, eave: 1.3, info: null
      });
      side.position.set(sx * 44, 0, -908);
      side.rotation.y = Math.PI / 2;
      scene.add(side);
      REG.push(side);
    }

    /* ================= 宫城外 · 南面中轴（端门—天安门—大清门） ================= */
    // 前广场铺装：午门外到天安门（压在护城河外的城砖地上）
    {
      const tx = t.paving.clone();
      tx.needsUpdate = true;
      tx.repeat.set(38, 30);
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(360, 280),
        new THREE.MeshStandardMaterial({ map: tx, color: 0x9c968a, roughness: 0.96 })
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(0, 0.01, 688);
      m.receiveShadow = true;
      scene.add(m);
    }
    // 千步廊：天安门到大清门之间的长街，两侧连檐通脊的红墙
    for (const sx of [-1, 1]) {
      wallRun(scene, 150, sx * 118, 725, Math.PI / 2, 6.2);
    }
    wallRun(scene, 240, 0, 800, 0, 6.2);
    // 大清门（明代大明门，清代大清门）
    const dqm = GG.build.createGateTower({
      w: 36, d: 13, h: 9.5,
      mainW: 20, mainD: 9, mainH: 7.5, roofH: 5.5,
      doors: 3, wings: false, style: 'xieshan',
      info: INFO.daqingmen, plaque: '大清门'
    });
    add(scene, dqm, { x: 0, z: 818 });
    // 天安门：外城正门，重檐歇山顶，城台开五门
    const tam = GG.build.createGateTower({
      w: 66, d: 25, h: 12.5,
      mainW: 46, mainD: 16, mainH: 10, roofH: 8,
      doors: 5, wings: false, style: 'xieshan',
      info: INFO.tiananmen, plaque: '天安门'
    });
    add(scene, tam, { x: 0, z: 700 });
    // 天安门前的铜狮与华表
    for (const sx of [-1, 1]) lion(scene, sx * 17, 726, sx > 0 ? -0.2 : 0.2);
    {
      const orn2 = [];
      for (const sx of [-1, 1]) {
        orn2.push(GG.geo.xform(new THREE.CylinderGeometry(0.7, 0.9, 9, 10), { x: sx * 30, y: 4.5, z: 744 }));
        orn2.push(GG.geo.box(2.6, 0.6, 2.6, { x: sx * 30, y: 9, z: 744 }));
      }
      const om = new THREE.Mesh(GG.geo.merge(orn2), M.darkStone);
      om.castShadow = true;
      scene.add(om);
    }
    // 端门：宫城正门的第一重，重檐歇山顶
    const dm = GG.build.createGateTower({
      w: 54, d: 22, h: 11,
      mainW: 36, mainD: 14, mainH: 9, roofH: 7.5,
      doors: 3, wings: false, style: 'xieshan',
      info: INFO.duanmen, plaque: '端门'
    });
    add(scene, dm, { x: 0, z: 590 });

    // 太庙（劳动人民文化宫）：午门东南、中轴东侧的皇家祖庙
    const TM = { x: 295, z: 720, w: 190, d: 148 };
    yardPave(scene, TM.w - 8, TM.d - 8, TM.x, TM.z);
    wallBox(scene, TM.x, TM.z, TM.w, TM.d, 5.8, 20);
    HALL({
      x: TM.x, z: 790, info: null, plaque: '戟门',
      w: 20, d: 11, h: 7.5, roofH: 5.5, style: 'xieshan',
      tiers: 1, tierH: 1.4, eave: 1.8
    });
    HALL({
      x: TM.x, z: 700, info: INFO.taimiao, plaque: '享殿',
      w: 62, d: 32, h: 12, roofH: 10, style: 'hip', double: true,
      tiers: 2, tierH: 1.8, eave: 2.6
    });
    for (const sx of [-1, 1]) {
      const side = GG.build.createHall({
        w: 18, d: 32, h: 7, roofH: 5, style: 'gable',
        tiers: 1, tierH: 0.9, railing: false, stairs: false, eave: 1.3, info: null
      });
      side.position.set(sx * 60, 0, 700);
      side.rotation.y = Math.PI / 2;
      scene.add(side);
      REG.push(side);
    }
    lawn(scene, TM.w - 16, 40, TM.x, 668);
    bed(scene, TM.x - 70, 668, 3.2);
    bed(scene, TM.x + 70, 668, 3.2);

    // 社稷坛（中山公园）：中轴西侧，五色土祭坛 + 拜殿
    const SJ = { x: -295, z: 720, w: 190, d: 148 };
    yardPave(scene, SJ.w - 8, SJ.d - 8, SJ.x, SJ.z);
    wallBox(scene, SJ.x, SJ.z, SJ.w, SJ.d, 5.8, 20);
    HALL({
      x: SJ.x, z: 790, info: null, plaque: '戟门',
      w: 20, d: 11, h: 7.5, roofH: 5.5, style: 'xieshan',
      tiers: 1, tierH: 1.4, eave: 1.8
    });
    HALL({
      x: SJ.x, z: 748, info: null, plaque: '拜殿',
      w: 62, d: 26, h: 9, roofH: 8, style: 'xieshan', double: true,
      tiers: 2, tierH: 1.6, eave: 2.2
    });
    // 社稷坛：三层方坛 + 五色土
    {
      const alt = new THREE.Group();
      const altGeo = GG.geo.terraceGeometry(46, 46, 3.2, 3);
      const am = new THREE.Mesh(altGeo.geo, M.stone);
      am.castShadow = true;
      am.receiveShadow = true;
      alt.add(am);
      const ar = new THREE.Mesh(GG.geo.railingGeometry(46, 46, 1.0, 0.8), M.marble);
      ar.position.y = 3.2;
      ar.castShadow = true;
      alt.add(ar);
      // 五色土：东青、南赤、中黄、西白、北黑
      const soilCols = [0x5f8f86, 0xb06a4a, 0xc9a94e, 0xd8d2c2, 0x5a5a60];
      const soilMats = soilCols.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
      const top = 3.32;
      const cells = [
        { x: 10, z: 0, m: 0 },   // 东青
        { x: 0, z: 10, m: 1 },   // 南赤
        { x: 0, z: 0, m: 2 },    // 中黄
        { x: -10, z: 0, m: 3 },  // 西白
        { x: 0, z: -10, m: 4 }   // 北黑
      ];
      for (const cell of cells) {
        const s = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), soilMats[cell.m]);
        s.rotation.x = -Math.PI / 2;
        s.position.set(cell.x, top, cell.z);
        s.receiveShadow = true;
        alt.add(s);
      }
      // 坛 central 社主石柱
      const zhu = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 5.6, 10), M.marble);
      zhu.position.set(0, top + 2.8, 0);
      zhu.castShadow = true;
      alt.add(zhu);
      alt.position.set(SJ.x, 0, SJ.z - 62);
      alt.userData.info = INFO.shejitan;
      alt.userData.isBuilding = true;
      alt.userData.labelY = 9;
      alt.userData.pickRadius = 30;
      scene.add(alt);
      REG.push(alt);
    }

    /* ================= 树木 ================= */
    const tg = GG.build.treeGeometries();
    const pinePos = [];
    const cypPos = [];

    // 在矩形区域内散布（带成簇效果，避免均匀网格感）
    function scatter(list, count, x0, x1, z0, z1, sMin, sMax, yFn) {
      const clusters = Math.max(2, Math.round(count / 6));
      const cs = [];
      for (let c = 0; c < clusters; c++) {
        cs.push([x0 + Math.random() * (x1 - x0), z0 + Math.random() * (z1 - z0)]);
      }
      for (let i = 0; i < count; i++) {
        const useCluster = Math.random() < 0.72;
        let x, z;
        if (useCluster) {
          const c = cs[Math.floor(Math.random() * cs.length)];
          const a = Math.random() * Math.PI * 2, r = Math.pow(Math.random(), 0.6) * (Math.min(x1 - x0, z1 - z0) * 0.22 + 6);
          x = c[0] + Math.cos(a) * r;
          z = c[1] + Math.sin(a) * r;
        } else {
          x = x0 + Math.random() * (x1 - x0);
          z = z0 + Math.random() * (z1 - z0);
        }
        x = Math.max(x0, Math.min(x1, x));
        z = Math.max(z0, Math.min(z1, z));
        const s = sMin + Math.random() * (sMax - sMin);
        list.push([x, z, s, yFn ? yFn(x, z) : 0]);
      }
    }

    // 御花园：最密
    scatter(cypPos, 16, -56, 56, GARDEN_Z - 40, GARDEN_Z + 34, 0.72, 1.05);
    scatter(pinePos, 20, -58, 58, GARDEN_Z - 42, GARDEN_Z + 36, 0.68, 1.0);
    // 慈宁宫花园（西路，含清斋前一方水池边）
    scatter(cypPos, 7, -356, -280, -206, -62, 0.66, 0.95);
    scatter(pinePos, 8, -356, -280, -206, -62, 0.62, 0.9);
    // 宁寿宫区与乾隆花园
    scatter(cypPos, 7, 186, 288, -462, -330, 0.6, 0.92);
    scatter(pinePos, 8, 186, 288, -462, -330, 0.58, 0.9);
    scatter(cypPos, 8, 302, 368, -416, -334, 0.55, 0.85);
    scatter(pinePos, 6, 302, 368, -416, -334, 0.52, 0.8);
    // 寿皇殿院与景山东麓
    scatter(pinePos, 10, 214, 326, -950, -850, 0.6, 0.9);
    scatter(cypPos, 8, 214, 326, -950, -850, 0.58, 0.85);
    scatter(pinePos, 26, -250, 200, -1015, -790, 0.75, 1.25, hillY);
    // 太庙 / 社稷坛
    scatter(pinePos, 30, 210, 380, 662, 780, 0.7, 1.1);
    scatter(cypPos, 12, 210, 380, 662, 780, 0.68, 1.0);
    scatter(cypPos, 26, -380, -210, 662, 780, 0.7, 1.1);
    // 东西六宫各院前庭
    const sixCourts = [
      [150, -150], [150, -212], [150, -274], [224, -150], [224, -212], [224, -274],
      [-150, -150], [-150, -212], [-150, -274], [-224, -150], [-224, -212], [-224, -274]
    ];
    for (const [cx, cz] of sixCourts) {
      scatter(cypPos, 2, cx - 18, cx + 18, cz + 6, cz + 24, 0.5, 0.78);
      scatter(pinePos, 1, cx - 18, cx + 18, cz + 6, cz + 24, 0.5, 0.75);
    }
    // 城墙内侧林荫（避开四角马道：x 322..344）
    for (const sx of [-1, 1]) {
      scatter(pinePos, 18, sx > 0 ? 322 : -362, sx > 0 ? 344 : -322, -430, 430, 0.75, 1.15);
      scatter(cypPos, 10, sx > 0 ? 322 : -362, sx > 0 ? 344 : -322, -430, 430, 0.7, 1.05);
    }
    // 东西路院落间隙（北半段；南半段已布置外东路 / 外西路院落，不再撒树）
    for (const sx of [-1, 1]) {
      scatter(cypPos, 9, sx > 0 ? 262 : -318, sx > 0 ? 318 : -262, -330, 20, 0.6, 0.9);
      scatter(pinePos, 7, sx > 0 ? 262 : -318, sx > 0 ? 318 : -262, -330, 20, 0.55, 0.85);
    }
    // 前朝两翼（文华殿 / 武英殿 内侧）古树成行
    scatter(pinePos, 10, 112, 162, 150, 290, 0.7, 1.05);
    scatter(cypPos, 7, 112, 162, 150, 290, 0.66, 0.98);
    scatter(pinePos, 10, -162, -112, 150, 290, 0.7, 1.05);
    scatter(cypPos, 7, -162, -112, 150, 290, 0.66, 0.98);
    // 外东路 / 外西路南段院落之南
    scatter(pinePos, 8, 210, 330, 300, 400, 0.7, 1.05);
    scatter(cypPos, 6, 210, 330, 300, 400, 0.66, 1.0);
    scatter(pinePos, 8, -330, -210, 300, 400, 0.7, 1.05);
    scatter(cypPos, 6, -330, -210, 300, 400, 0.66, 1.0);
    // 景山：满山松柏（hillY 已在景山一节定义）
    scatter(pinePos, 90, HILL.x - HILL.r, HILL.x + HILL.r, HILL.z - HILL.r * 0.72, HILL.z + HILL.r * 0.72, 0.9, 1.5, hillY);
    scatter(cypPos, 60, HILL.x - HILL.r, HILL.x + HILL.r, HILL.z - HILL.r * 0.72, HILL.z + HILL.r * 0.72, 0.85, 1.35, hillY);
    // 护城河外林带
    scatter(pinePos, 30, -620, 620, -700, -560, 1.0, 1.55);
    scatter(pinePos, 26, -620, 620, 560, 720, 1.0, 1.55);
    scatter(cypPos, 22, 520, 700, -560, 560, 1.0, 1.5);
    scatter(cypPos, 22, -700, -520, -560, 560, 1.0, 1.5);

    const dummy = new THREE.Object3D();
    const _tc = new THREE.Color();
    function inst(geo, mat, list, shadow, tint) {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      im.castShadow = shadow;
      im.receiveShadow = true;
      list.forEach((p, i) => {
        dummy.position.set(p[0], p[3] || 0, p[1]);
        dummy.scale.setScalar(p[2]);
        dummy.rotation.y = Math.random() * Math.PI * 2;
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
        if (tint) {
          const v = 0.72 + Math.random() * 0.62;
          _tc.setRGB(v * (0.9 + Math.random() * 0.2), v, v * (0.85 + Math.random() * 0.2));
          im.setColorAt(i, _tc);
        }
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      scene.add(im);
      return im;
    }
    inst(tg.pine.trunk, M.trunk, pinePos, false);
    inst(tg.pine.leaf, M.leaf, pinePos, true, true);
    inst(tg.pine.top, M.leaf2, pinePos, false, true);
    inst(tg.cypress.trunk, M.trunk, cypPos, false);
    inst(tg.cypress.leaf, M.leaf, cypPos, true, true);
    inst(tg.cypress.top, M.leaf2, cypPos, false, true);

    /* ================= 华表 / 铜狮 之类的小品（简） ================= */
    const ornament = [];
    // 太和门前的铜狮（体仁阁 / 弘义阁也各有一对）
    for (const sx of [-1, 1]) lion(scene, sx * 14, 318, sx > 0 ? -0.2 : 0.2);
    for (const sx of [-1, 1]) lion(scene, sx * 66, 140, sx > 0 ? -0.2 : 0.2);
    // 午门前的华表
    for (const sx of [-1, 1]) {
      ornament.push(GG.geo.xform(new THREE.CylinderGeometry(0.7, 0.9, 8, 10), { x: sx * 22, y: 4, z: 432 }));
      ornament.push(GG.geo.box(2.6, 0.6, 2.6, { x: sx * 22, y: 8.3, z: 432 }));
    }
    const orn = new THREE.Mesh(GG.geo.merge(ornament), M.darkStone);
    orn.castShadow = true;
    scene.add(orn);

    return REG;
  };

  GG.INFO = INFO;
  GG.REGISTRY = REG;
})();
