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
    // 皇极殿（宁寿宫区）
    HALL({
      x: 236, z: -330, info: INFO.huangjidian, plaque: '皇极殿',
      w: 38, d: 22, h: 11, roofH: 8.5, style: 'xieshan', double: true,
      tiers: 2, tierH: 1.8, eave: 2.6
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
      g.position.set(sx * 372, 0, 196);
      g.rotation.y = Math.PI / 2;
      scene.add(g);
      REG.push(g);
    }

    // 城墙内侧的值房 / 库房（填充东西两翼）
    const fills = [
      [-316, 268], [-316, 168], [-316, 60], [-316, -40], [-316, -140],
      [316, 268], [316, 168], [316, 60], [316, -40], [316, -140],
      [-300, -250], [300, -250], [-300, -330], [300, -330]
    ];
    for (const [fx, fz] of fills) {
      const c = GG.build.createCorridor({
        length: 62, depth: 11, h: 4.6, roofH: 3.8, info: null
      });
      c.position.set(fx, 0, fz);
      c.rotation.y = Math.PI / 2;
      scene.add(c);
    }

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

    /* ================= 城墙 & 角楼 ================= */
    const WALL_X = 376, WALL_Z = 480, WALL_H = 9.6;
    const wallSegs = [
      { x: 0, z: WALL_Z, len: WALL_X * 2, ry: 0, skip: 100 },
      { x: 0, z: -WALL_Z, len: WALL_X * 2, ry: 0, skip: 66 },
      { x: WALL_X, z: 0, len: WALL_Z * 2, ry: Math.PI / 2, skip: 0 },
      { x: -WALL_X, z: 0, len: WALL_Z * 2, ry: Math.PI / 2, skip: 0 }
    ];
    for (const s of wallSegs) {
      if (s.skip > 0) {
        const segLen = (s.len - s.skip) / 2;
        for (const sx of [-1, 1]) {
          const w = GG.build.createWall({ length: segLen, h: WALL_H, t: 2.6 });
          w.position.set(sx * (s.skip / 2 + segLen / 2), 0, s.z);
          scene.add(w);
        }
      } else {
        const w = GG.build.createWall({ length: s.len, h: WALL_H, t: 2.6 });
        w.position.set(s.x, 0, s.z);
        w.rotation.y = s.ry;
        scene.add(w);
      }
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
    // 山巅万春亭
    const wz = GG.build.createPavilion({ w: 9, h: 5, roofH: 5.6, tiers: 2, info: null });
    wz.position.set(HILL.x, HILL.h - 0.6, HILL.z);
    scene.add(wz);

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
    // 慈宁宫花园
    scatter(cypPos, 7, -305, -258, 30, 96, 0.66, 0.95);
    scatter(pinePos, 8, -305, -258, 30, 96, 0.62, 0.9);
    // 城墙内侧林荫
    for (const sx of [-1, 1]) {
      scatter(pinePos, 20, sx > 0 ? 322 : -362, sx > 0 ? 362 : -322, -430, 430, 0.75, 1.15);
      scatter(cypPos, 12, sx > 0 ? 322 : -362, sx > 0 ? 362 : -322, -430, 430, 0.7, 1.05);
    }
    // 东西路院落间隙
    for (const sx of [-1, 1]) {
      scatter(cypPos, 9, sx > 0 ? 262 : -318, sx > 0 ? 318 : -262, -330, 300, 0.6, 0.9);
      scatter(pinePos, 7, sx > 0 ? 262 : -318, sx > 0 ? 318 : -262, -330, 300, 0.55, 0.85);
    }
    // 景山：满山松柏
    const hillY = (x, z) => {
      const dx = (x - HILL.x) / (HILL.r * 1.0);
      const dz = (z - HILL.z) / (HILL.r * 0.72);
      const dd = dx * dx + dz * dz;
      return dd >= 1 ? 0 : HILL.h * Math.sqrt(1 - dd) - 1.2;
    };
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
    // 太和门前的铜狮
    for (const sx of [-1, 1]) {
      ornament.push(GG.geo.box(2.2, 3.4, 3.4, { x: sx * 14, y: 1.7, z: 318 }));
    }
    // 华表
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
