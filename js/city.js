/* ============================================================
   京师 —— 皇城 / 内城 / 外城
   ------------------------------------------------------------
   宫城之外的城市骨架：城墙、城门、坛庙、太液池、胡同院落。
   只做体量与剪影，不做测绘；单位米，中轴 x=0，+z 向南。

   坐标（与宫城同一套）：
     宫城    x ±376,  z ±480
     皇城    x ±1120, z +800 … -1700
     内城    x ±3300, z +1650 … -2400
     外城    x ±3900, z +1650 … +4400

   铁律：
   - 本模块不消耗 Math.random（胡同布局用独立 LCG），
     否则 ?seed=1 下宫城内的树与散布会整体漂移。
   - 地标（城门 / 坛庙 / 三海）通过 register 挂进 REG，可点击；
     四合院是实例化体块，不进索引。
   ============================================================ */
(function () {
  const GG = (window.GG = window.GG || {});

  const HC = { x: 1120, s: 800, n: -1700, h: 7.5, t: 3.2 };
  const NC = { x: 3300, s: 1650, n: -2400, h: 12.5, t: 10 };
  const WC = { x: 3900, s: 4400, n: 1650, h: 10.5, t: 8 };

  /* 城内树位：由 scatterLayer 统一并进实例化，省 draw call */
  const treeSpots = { pine: [], cyp: [] };

  let M = null;                 // 建筑材质表
  let grayWall = null;          // 内城 / 外城的灰砖墙
  let cityLamp = null;          // 夜间万家灯火
  let register = null;          // 由 palace.js 注入：把城门 / 坛庙挂进 REG

  function mark(group, key, labelY, radius) {
    if (!register || !group || !key) return;
    register(group, key, labelY, radius);
  }

  /* ---------------- 基础构件 ---------------- */

  function wallSeg(scene, x1, z1, x2, z2, cfg) {
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 2) return;
    const g = GG.build.createWall(Object.assign({ length: len }, cfg));
    g.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
    g.rotation.y = Math.atan2(-dz, dx);
    scene.add(g);
  }

  /* 沿轴走一段墙，gaps 是沿墙方向的 [a,b] 区间（城门洞） */
  function wallLine(scene, axis, fixed, from, to, gaps, cfg) {
    const gs = (gaps || []).slice().sort((a, b) => a[0] - b[0]);
    let cur = from;
    const seg = (a, b) => {
      if (b - a < 2) return;
      if (axis === 'x') wallSeg(scene, a, fixed, b, fixed, cfg);
      else wallSeg(scene, fixed, a, fixed, b, cfg);
    };
    for (const g of gs) {
      if (g[0] > cur) seg(cur, g[0]);
      cur = Math.max(cur, g[1]);
    }
    seg(cur, to);
  }

  function gate(scene, o) {
    const g = GG.build.createGateTower({
      w: o.w, d: o.d, h: o.h,
      mainW: o.mw, mainD: o.md, mainH: o.mh, roofH: o.rh,
      doors: o.doors || 3, wings: false,
      style: o.style || 'xieshan', info: null, plaque: null,
      baseMat: o.city ? grayWall : null
    });
    g.position.set(o.x, 0, o.z);
    g.rotation.y = o.ry || 0;
    scene.add(g);
    if (o.key) mark(g, o.key);
    return g;
  }

  function cornerTower(scene, x, z, h) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(26, h, 26), grayWall);
    base.position.set(x, h / 2, z);
    base.castShadow = true;
    base.receiveShadow = true;
    scene.add(base);
    const p = GG.build.createPavilion({ w: 15, h: 5.2, roofH: 5.4, tiers: 2, info: null });
    p.position.set(x, h, z);
    scene.add(p);
  }

  function treeLine(x0, z0, x1, z1, count, scale, cypressShare) {
    const cyp = cypressShare == null ? 0.45 : cypressShare;
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const x = x0 + (x1 - x0) * t;
      const z = z0 + (z1 - z0) * t;
      const s = scale * (0.85 + 0.3 * ((i * 37) % 11) / 10);
      (i % 10 < cyp * 10 ? treeSpots.cyp : treeSpots.pine).push([x, z, s, 0]);
    }
  }

  /* ---------------- 城门 ---------------- */
  const HC_GATES = [
    { x: 0, z: HC.n, ry: Math.PI, w: 46, d: 22, h: 8.5, mw: 28, md: 13, mh: 7, rh: 5.6, doors: 3, key: 'dianmen' },
    { x: HC.x, z: 300, ry: Math.PI / 2, w: 40, d: 20, h: 8, mw: 24, md: 12, mh: 6.5, rh: 5.2, doors: 3, key: 'donganmen' },
    { x: -HC.x, z: 300, ry: -Math.PI / 2, w: 40, d: 20, h: 8, mw: 24, md: 12, mh: 6.5, rh: 5.2, doors: 3, key: 'xianmen' }
  ];

  const NC_GATES = [
    { x: 0, z: NC.s, ry: 0, w: 100, d: 46, h: 13, mw: 64, md: 24, mh: 10, rh: 8.6, doors: 5, key: 'zhengyangmen' },
    { x: 1150, z: NC.s, ry: 0, w: 56, d: 30, h: 11, mw: 34, md: 16, mh: 8, rh: 6.6, key: 'chongwenmen' },
    { x: -1150, z: NC.s, ry: 0, w: 56, d: 30, h: 11, mw: 34, md: 16, mh: 8, rh: 6.6, key: 'xuanwumen' },
    { x: NC.x, z: 700, ry: Math.PI / 2, w: 56, d: 30, h: 11, mw: 34, md: 16, mh: 8, rh: 6.6, key: 'chaoyangmen' },
    { x: NC.x, z: -1100, ry: Math.PI / 2, w: 56, d: 30, h: 11, mw: 34, md: 16, mh: 8, rh: 6.6, key: 'dongzhimen' },
    { x: -NC.x, z: 700, ry: -Math.PI / 2, w: 56, d: 30, h: 11, mw: 34, md: 16, mh: 8, rh: 6.6, key: 'fuchengmen' },
    { x: -NC.x, z: -1100, ry: -Math.PI / 2, w: 56, d: 30, h: 11, mw: 34, md: 16, mh: 8, rh: 6.6, key: 'xizhimen' },
    { x: 900, z: NC.n, ry: Math.PI, w: 56, d: 30, h: 11, mw: 34, md: 16, mh: 8, rh: 6.6, key: 'andingmen' },
    { x: -900, z: NC.n, ry: Math.PI, w: 56, d: 30, h: 11, mw: 34, md: 16, mh: 8, rh: 6.6, key: 'deshengmen' }
  ];

  const WC_GATES = [
    { x: 0, z: WC.s, ry: 0, w: 76, d: 34, h: 11.5, mw: 46, md: 18, mh: 8.5, rh: 7, doors: 3, key: 'yongdingmen' },
    { x: 1900, z: WC.s, ry: 0, w: 52, d: 28, h: 10, mw: 30, md: 15, mh: 7.4, rh: 6, key: 'zuoanmen' },
    { x: -1900, z: WC.s, ry: 0, w: 52, d: 28, h: 10, mw: 30, md: 15, mh: 7.4, rh: 6, key: 'youanmen' },
    { x: WC.x, z: 3000, ry: Math.PI / 2, w: 52, d: 28, h: 10, mw: 30, md: 15, mh: 7.4, rh: 6, key: 'guangqumen' },
    { x: -WC.x, z: 3000, ry: -Math.PI / 2, w: 52, d: 28, h: 10, mw: 30, md: 15, mh: 7.4, rh: 6, key: 'guanganmen' }
  ];

  function gapsFor(list, fixed, axis) {
    return list
      .filter((g) => (axis === 'x' ? g.z === fixed : g.x === fixed))
      .map((g) => [axis === 'x' ? g.x - g.w / 2 : g.z - g.w / 2,
                   axis === 'x' ? g.x + g.w / 2 : g.z + g.w / 2]);
  }

  /* ============================================================
     太液池 —— 北海与中南海
     ------------------------------------------------------------
     上一版是"一块蓝色多边形压在灰地上"：水面平、岸线硬、
     岛上只有一层绿饼。这一版把三件事拆开做：
       1. 水面（着色器负责颜色与高光）
       2. 岸线（条石驳岸 + 压面石 + 浅滩带）
       3. 岛（抬高到 3~30 m，加驳岸、山石、建筑与树）
     ============================================================ */

  /* 北海湖岸（相对湖心，单位米）——不规则的水面才有园林感 */
  const BH = {
    cx: -700, cz: -1250,
    pts: [
      [-250, -300], [-90, -365], [110, -345], [240, -250],
      [300, -110], [262, 40], [296, 170], [206, 300],
      [40, 356], [-120, 330], [-232, 226], [-292, 96],
      [-268, -70], [-286, -210]
    ]
  };

  /* 中南海湖岸：中海宽、南海收，中间一段窄水 */
  const ZNH = {
    cx: -720, cz: -60,
    pts: [
      [-70, -500], [40, -545], [125, -470], [100, -350], [55, -230],
      [85, -110], [60, 10], [95, 130], [70, 260], [15, 385],
      [-70, 420], [-150, 355], [-165, 240], [-135, 120], [-160, 0],
      [-140, -120], [-168, -250], [-150, -390], [-118, -470]
    ]
  };

  /** 点是否落在湖岸多边形内（world 坐标） */
  function inLake(x, z, lake, k) {
    const pts = lake.pts;
    const cx = lake.cx, cz = lake.cz;
    const kk = k == null ? 1 : k;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = cx + pts[i][0] * kk, zi = cz + pts[i][1] * kk;
      const xj = cx + pts[j][0] * kk, zj = cz + pts[j][1] * kk;
      if (((zi > z) !== (zj > z)) &&
          (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) inside = !inside;
    }
    return inside;
  }

  function lakeCurve(lake, k) {
    const kk = k == null ? 1 : k;
    return new THREE.CatmullRomCurve3(
      lake.pts.map((p) => new THREE.Vector3(p[0] * kk, 0, p[1] * kk)),
      true, 'catmullrom', 0.5
    );
  }

  /** 岸线浅滩带：贴着水岸向内的一圈半透明浅色，补出"水浅"的过渡。
      用两条缩放后的岸线夹出来，不依赖法线方向 —— 岸线是凹多边形时
      逐点求内法线会翻面，缩放法在星形湖岸上永远朝里。 */
  function shoreBand(lake, y, kIn) {
    const N = 160;
    const outer = lakeCurve(lake, 1).getSpacedPoints(N);
    const inner = lakeCurve(lake, kIn == null ? 0.975 : kIn).getSpacedPoints(N);
    const pos = [], aT = [], idx = [];
    for (let i = 0; i < N; i++) {
      pos.push(outer[i].x, 0, outer[i].z); aT.push(1);
      pos.push(inner[i].x, 0, inner[i].z); aT.push(0);
    }
    for (let i = 0; i < N; i++) {
      const a = i * 2, b = a + 1, c = ((i + 1) % N) * 2, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, GG.water.createShore());
    m.position.set(lake.cx, y + 0.016, lake.cz);
    m.renderOrder = 2;
    return m;
  }

  /** 条石驳岸：沿湖岸等距摆一段段石条，比一圈纯色描边读得出"砌" */
  function revetment(scene, lake, y, stoneMat, copingMat) {
    const curve = lakeCurve(lake, 1);
    const perim = curve.getLength();
    const step = 4.6;
    const n = Math.max(24, Math.round(perim / step));
    const pts = curve.getSpacedPoints(n);
    const curb = [], cop = [];
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const p0 = pts[(i + n - 1) % n], p1 = pts[(i + 1) % n];
      const ang = Math.atan2(-(p1.z - p0.z), p1.x - p0.x);
      /* 驳岸石：水下 -0.25 到水面上 0.95 */
      curb.push(GG.geo.box(step * 1.06, 1.2, 1.9, { x: p.x, y: 0.35, z: p.z, ry: ang }));
      /* 压面石：比驳岸宽一圈，形成一道明显的岸线 */
      cop.push(GG.geo.box(step * 1.04, 0.22, 2.5, { x: p.x, y: 1.06, z: p.z, ry: ang }));
    }
    const cm = new THREE.Mesh(GG.geo.merge(curb), stoneMat);
    cm.position.set(lake.cx, y, lake.cz);
    cm.receiveShadow = true;
    cm.castShadow = true;
    scene.add(cm);
    const pm = new THREE.Mesh(GG.geo.merge(cop), copingMat);
    pm.position.set(lake.cx, y, lake.cz);
    pm.receiveShadow = true;
    scene.add(pm);
  }

  /** 湖面 + 岸线 + 浅滩 一次建好，返回水面 mesh */
  function lakeBody(scene, lake, y, copingMat) {
    const curve = lakeCurve(lake, 1);
    const samples = curve.getSpacedPoints(180);
    const shape = new THREE.Shape(
      samples.map((p) => new THREE.Vector2(p.x, -p.z))
    );
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(geo, M.water);
    water.position.set(lake.cx, y, lake.cz);
    scene.add(water);

    scene.add(shoreBand(lake, y, 0.972));
    revetment(scene, lake, y - 0.02, M.stone, copingMat || M.stone);
    return water;
  }

  /** 湖心岛：半球隆起 + 山石裙边，不再是浮在水上的绿饼 */
  function lakeIsland(scene, o) {
    const g = new THREE.SphereGeometry(o.r, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(o.sx == null ? 1 : o.sx, o.h / o.r, o.sz == null ? 0.82 : o.sz);
    const mat = GG.build.groundMaterial('ground', o.color || 0x5c7048, 1);
    const m = new THREE.Mesh(g, mat);
    m.position.set(o.cx, o.y0 == null ? 0.1 : o.y0, o.cz);
    m.receiveShadow = true;
    scene.add(m);

    /* 山石裙边：岛脚一圈乱石，把"绿饼"的边压碎 */
    const rocks = [];
    const n = Math.max(10, Math.round(o.r / 6));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (i % 3) * 0.21;
      const rr = o.r * (0.9 + ((i * 7) % 5) * 0.035);
      rocks.push(GG.geo.xform(new THREE.DodecahedronGeometry(3.2 + (i % 4) * 1.5, 0), {
        x: o.cx + Math.cos(a) * rr * (o.sx == null ? 1 : o.sx),
        y: (o.y0 == null ? 0.1 : o.y0) + 0.4 + (i % 3) * 0.5,
        z: o.cz + Math.sin(a) * rr * (o.sz == null ? 0.82 : o.sz),
        ry: a * 2.1, sx: 1.2, sy: 0.62
      }));
    }
    const rm = new THREE.Mesh(GG.geo.merge(rocks), M.darkStone);
    rm.castShadow = true;
    rm.receiveShadow = true;
    scene.add(rm);
    return m;
  }

  /* ---------------- 坛庙 ----------------
     天坛已拆到 js/tiantan.js（清乾隆十九年定型格局），
     本文件只保留先农坛与其余城市骨架。 */

  function xianNongTan(scene, cx, cz) {
    const HALF = 330;
    const wallCfg = {
      h: 5.2, t: 2.2, crenel: false, capRise: 0.5, capOver: 0.45,
      capMat: M.tileCapGreen, ridgeMat: M.ridge
    };
    wallLine(scene, 'x', cz - HALF, cx - HALF, cx + HALF, [], wallCfg);
    wallLine(scene, 'x', cz + HALF, cx - HALF, cx + HALF, [], wallCfg);
    wallLine(scene, 'z', cx - HALF, cz - HALF, cz + HALF, [[cz + 10, cz + 70]], wallCfg);
    wallLine(scene, 'z', cx + HALF, cz - HALF, cz + HALF, [], wallCfg);
    const lawn = new THREE.Mesh(
      GG.geo.uvScale(new THREE.PlaneGeometry(600, 600), 46, 46),
      GG.build.groundMaterial('grass', 0x4c5838)
    );
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(cx, 0.3, cz);
    lawn.receiveShadow = true;
    scene.add(lawn);
    const hall = GG.build.createHall({
      w: 48, d: 26, h: 11, roofH: 8.5, style: 'xieshan', double: true,
      tiers: 2, tierH: 1.7, eave: 2.2, green: true, info: null, dimWin: true
    });
    hall.position.set(cx, 0, cz - 20);
    scene.add(hall);
    mark(hall, 'xiannongtan');
    const gateHall = GG.build.createHall({
      w: 22, d: 11, h: 7.5, roofH: 5.4, style: 'xieshan',
      tiers: 1, tierH: 1.2, eave: 1.7, green: true, info: null
    });
    gateHall.position.set(cx, 0, cz + 110);
    scene.add(gateHall);
  }

  /* ---------------- 北海（琼华岛 + 白塔） ---------------- */
  function beihai(scene) {
    const cx = BH.cx, cz = BH.cz;
    /* 琼华岛沿岸是汉白玉栏杆与石岸，压面石用白石 */
    lakeBody(scene, BH, 0.16, M.marble);

    /* 琼华岛：偏南，岛高 30 m，白塔再往上 30 m —— 天际线要立得住 */
    const IX = cx + 10, IZ = cz + 30;
    lakeIsland(scene, { cx: IX, cz: IZ, r: 150, h: 30, sx: 1, sz: 0.9, color: 0x5b6f47 });

    /* 白塔：覆钵式塔身 + 塔刹。合成一组，供拾取与标签挂载 */
    const pagoda = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(13, 17, 6, 20), M.marble);
    base.position.set(0, 2.6, 0);
    base.castShadow = true;
    base.receiveShadow = true;
    pagoda.add(base);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 11.5, 16, 22), M.marble);
    body.position.set(0, 13, 0);
    body.castShadow = true;
    pagoda.add(body);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(11.5, 22, 16), M.marble);
    belly.position.set(0, 23, 0);
    belly.castShadow = true;
    pagoda.add(belly);
    /* 塔脖子与相轮 */
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.4, 8, 16), M.marble);
    neck.position.set(0, 34, 0);
    neck.castShadow = true;
    pagoda.add(neck);
    for (let i = 0; i < 5; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.4 - i * 0.36, 0.28, 6, 18), M.gold);
      ring.position.set(0, 34.6 + i * 1.1, 0);
      ring.rotation.x = Math.PI / 2;
      pagoda.add(ring);
    }
    const spire = new THREE.Mesh(new THREE.ConeGeometry(2.6, 10, 14), M.gold);
    spire.position.set(0, 44, 0);
    pagoda.add(spire);
    pagoda.position.set(IX, 29.5, IZ);
    pagoda.userData.labelY = 58;
    pagoda.userData.pickRadius = 120;
    scene.add(pagoda);
    mark(pagoda, 'beihai');

    /* 岛南麓：永安寺一组，坡面上错落三座殿 */
    const templeSpots = [
      { z: 108, w: 26, h: 6.6, roofH: 5.2, y: 7 },
      { z: 74, w: 22, h: 6.2, roofH: 4.8, y: 13 },
      { z: 42, w: 18, h: 5.8, roofH: 4.4, y: 19 }
    ];
    for (const t of templeSpots) {
      const h = GG.build.createHall({
        w: t.w, d: 13, h: t.h, roofH: t.roofH, style: 'xieshan',
        tiers: 1, tierH: 1.1, eave: 1.6, info: null, dimWin: true
      });
      h.position.set(IX, t.y, IZ + t.z);
      scene.add(h);
    }
    /* 岛北麓：漪澜堂临水 */
    const ylt = GG.build.createHall({
      w: 30, d: 13, h: 6.8, roofH: 5.4, style: 'xieshan',
      tiers: 1, tierH: 1.2, eave: 1.7, info: null, dimWin: true
    });
    ylt.position.set(IX - 10, 2.2, IZ - 118);
    scene.add(ylt);

    /* 北岸五龙亭：五座小亭挑在水上 */
    for (let i = -2; i <= 2; i++) {
      const p = GG.build.createPavilion({
        w: 7, h: 4.2, roofH: 4.2, tiers: 1, info: null, green: true
      });
      p.position.set(cx + i * 22, 1.1, cz - 300 - Math.abs(i) * 6);
      scene.add(p);
    }

    /* 岛上的树：环岛两圈，坡上再散一些 */
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2 + (i % 5) * 0.13;
      const rr = 150 * (0.35 + ((i * 11) % 60) / 100);
      const px = IX + Math.cos(a) * rr;
      const pz = IZ + Math.sin(a) * rr * 0.9;
      const dx = (px - IX) / 150, dz = (pz - IZ) / (150 * 0.9);
      const dd = dx * dx + dz * dz;
      const yy = dd >= 1 ? 0 : Math.max(0, 30 * Math.sqrt(1 - dd) - 0.6);
      treeSpots.cyp.push([px, pz, 0.62 + (i % 4) * 0.1, yy]);
    }
    /* 沿岸柳柏 */
    const shore = lakeCurve(BH, 1.06).getSpacedPoints(80);
    for (let i = 0; i < shore.length; i++) {
      treeSpots.cyp.push([cx + shore[i].x, cz + shore[i].z, 0.72 + (i % 4) * 0.08, 0]);
    }
  }

  /* ---------------- 中南海（中海 + 南海） ---------------- */
  function zhongnanhai(scene) {
    const cx = ZNH.cx, cz = ZNH.cz;
    const water = lakeBody(scene, ZNH, 0.16);
    water.userData.labelY = 6;
    water.userData.pickRadius = 190;
    mark(water, 'zhongnanhai');

    /* 瀛台：湖心主岛，抬高到 4 m，上面一组殿宇 */
    const YT = { x: cx - 20, z: cz - 250, r: 46, h: 4.2 };
    lakeIsland(scene, {
      cx: YT.x, cz: YT.z, r: YT.r, h: YT.h, sx: 1.25, sz: 0.85, color: 0x60734b
    });
    const hanyuan = GG.build.createHall({
      w: 20, d: 12, h: 6.6, roofH: 5.4, style: 'xieshan', double: true,
      tiers: 1, tierH: 1.2, eave: 1.6, info: null, dimWin: true
    });
    hanyuan.position.set(YT.x, 3.4, YT.z - 6);
    scene.add(hanyuan);
    for (const sx of [-1, 1]) {
      const side = GG.build.createHall({
        w: 9, d: 7, h: 5.2, roofH: 4.0, style: 'gable',
        tiers: 1, tierH: 0.9, railing: false, stairs: false, eave: 1.2, info: null
      });
      side.position.set(YT.x + sx * 20, 2.6, YT.z - 4);
      side.rotation.y = Math.PI / 2;
      scene.add(side);
    }
    /* 小洲（南海） */
    lakeIsland(scene, {
      cx: cx + 10, cz: cz + 250, r: 30, h: 2.6, sx: 1.2, sz: 0.85, color: 0x62744c
    });

    /* 湖腰石桥：中海与南海之间唯一的陆路，桥面微拱 */
    const BX = cx - 40, BZ = cz - 10;
    const deckParts = [];
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const y = 1.0 + Math.sin(t * Math.PI) * 1.1;
      deckParts.push(GG.geo.box(22, 0.9, 10.4, { x: -88 + i * 22, y: y, z: 0 }));
    }
    const deck = new THREE.Mesh(GG.geo.merge(deckParts), M.marble);
    deck.position.set(BX, 0, BZ);
    deck.castShadow = true;
    deck.receiveShadow = true;
    scene.add(deck);
    for (const sz of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(200, 0.9, 0.45), M.marble);
      rail.position.set(BX, 2.6, BZ + sz * 4.9);
      rail.castShadow = true;
      scene.add(rail);
      const posts = [];
      for (let i = 0; i <= 20; i++) {
        posts.push(GG.geo.box(0.34, 1.5, 0.34, { x: BX - 100 + i * 10, y: 2.4, z: BZ + sz * 4.9 }));
      }
      scene.add(new THREE.Mesh(GG.geo.merge(posts), M.marble));
    }

    /* 东岸的几座殿堂：中南海的建筑群只取剪影 */
    for (const [z, ww] of [[250, 26], [-120, 22], [-380, 20]]) {
      const hall = GG.build.createHall({
        w: ww, d: 14, h: 7, roofH: 5.6, style: 'xieshan',
        tiers: 1, tierH: 1.2, eave: 1.6, info: null, dimWin: true
      });
      hall.position.set(-548, 0, z);
      scene.add(hall);
    }

    /* 沿岸树带：湖岸外侧一圈，隔着驳岸看才有层次 */
    const shore = lakeCurve(ZNH, 1.07).getSpacedPoints(72);
    for (let i = 0; i < shore.length; i++) {
      treeSpots.cyp.push([cx + shore[i].x, cz + shore[i].z, 0.7 + (i % 4) * 0.09, 0]);
    }
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      treeSpots.cyp.push([
        YT.x + Math.cos(a) * YT.r * 0.8,
        YT.z + Math.sin(a) * YT.r * 0.66,
        0.5 + (i % 3) * 0.07, 3.2
      ]);
    }
  }

  /* ============================================================
     四合院群落
     ------------------------------------------------------------
     上一版是网格撒点：一万多间独立小屋，远看均匀灰点、近看棚子。
     这一版按北京城的真实肌理排：东西向胡同、院落坐北朝南、
     两排院落背靠背夹一条胡同。近处（宫城周边与前三门）用
     带门楼、影壁、厢房的完整院落；远处用两坡顶 + 墙身的
     简化体块，两个 InstancedMesh 承载，只买剪影不买细节。
     ============================================================ */

  /* 两坡顶：脊沿 x，底面 y=0。UV 按世界尺度铺，瓦垄约 0.27 m 一道 */
  function prism(w, h, d, o) {
    const hw = w / 2, hd = d / 2;
    const v = [
      [-hw, 0, hd], [hw, 0, hd], [hw, h, 0], [-hw, h, 0],
      [hw, 0, -hd], [-hw, 0, -hd], [-hw, h, 0], [hw, h, 0]
    ];
    const idx = [
      0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7,
      5, 0, 3, 5, 3, 6, 1, 4, 7, 1, 7, 2
    ];
    const pos = [], uv = [];
    for (const i of idx) {
      const p = v[i];
      pos.push(p[0], p[1], p[2]);
      uv.push(p[0] / 3.1, p[2] / 4.6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return GG.geo.xform(g, o || {});
  }

  /** 完整四合院：墙身与屋顶分两批返回，便于两种材质分别实例化 */
  function siheyuanGeoms(kind) {
    const big = kind === 'big';
    const W = big ? 34 : 26;
    const D = big ? 40 : 32;
    const wallH = big ? 3.1 : 2.7;
    const t = 0.5;
    const gateW = big ? 6.0 : 4.6;
    const wall = [], roof = [];
    const B = (w, h, d, o) => wall.push(GG.geo.box(w, h, d, o));
    const R = (w, h, d, o) => roof.push(prism(w, h, d, o));

    /* 院墙：北、东、西整面，南面留门洞 */
    B(W, wallH, t, { y: wallH / 2, z: -D / 2 });
    B(t, wallH, D, { x: W / 2, y: wallH / 2 });
    B(t, wallH, D, { x: -W / 2, y: wallH / 2 });
    const seg = (W - gateW) / 2;
    B(seg, wallH, t, { x: -(gateW / 2 + seg / 2), y: wallH / 2, z: D / 2 });
    B(seg, wallH, t, { x: gateW / 2 + seg / 2, y: wallH / 2, z: D / 2 });

    /* 院墙压顶：一条小两坡瓦顶。胡同里最能认出"这是院墙"的
       就是墙头那道连续的灰瓦线，没有它就是一道水泥板。 */
    const capH = 0.34, capD = t + 1.05;
    R(W + 0.7, capH, capD, { y: wallH, z: -D / 2 });
    R(D + 0.7, capH, capD, { y: wallH, x: W / 2, ry: Math.PI / 2 });
    R(D + 0.7, capH, capD, { y: wallH, x: -W / 2, ry: Math.PI / 2 });
    R(seg + 0.5, capH, capD, { y: wallH, x: -(gateW / 2 + seg / 2), z: D / 2 });
    R(seg + 0.5, capH, capD, { y: wallH, x: gateW / 2 + seg / 2, z: D / 2 });

    /* 门楼：门洞两侧的门框墙 + 小坡顶 + 门墩 */
    const gh = big ? 4.0 : 3.3;
    B(gateW, gh, 1.5, { y: gh / 2, z: D / 2 });
    R(gateW + 1.6, big ? 1.5 : 1.2, 3.2, { y: gh, z: D / 2 });
    for (const sx of [-1, 1]) {
      B(0.62, 0.95, 0.62, { x: sx * (gateW / 2 - 0.5), y: 0.48, z: D / 2 + 0.9 });
      B(0.34, 2.2, 0.34, { x: sx * (gateW / 2 + 0.2), y: 1.1, z: D / 2 - 0.6 });
    }

    if (big) {
      /* 倒座房（南）：留出东侧门道 */
      B(20, 3.4, 5.6, { x: -4, y: 1.7, z: D / 2 - 5.5 });
      R(21.2, 1.9, 6.4, { x: -4, y: 3.4, z: D / 2 - 5.5 });
      /* 影壁：进门迎面一道 */
      B(5.4, 2.6, 0.42, { x: 7.4, y: 1.3, z: D / 2 - 3.6 });
      R(6.0, 0.55, 1.2, { x: 7.4, y: 2.6, z: D / 2 - 3.6 });
      /* 垂花门：前后院之间 */
      B(6.4, 3.6, 3.0, { y: 1.8, z: 2 });
      R(7.6, 1.6, 4.0, { y: 3.6, z: 2 });
      /* 正房 + 耳房 */
      B(24, 4.4, 8.6, { y: 2.2, z: -13 });
      R(25.4, 2.6, 9.6, { y: 4.4, z: -13 });
      for (const sx of [-1, 1]) {
        B(4.2, 3.3, 6.2, { x: sx * 13.6, y: 1.65, z: -13 });
        R(4.9, 1.5, 7.0, { x: sx * 13.6, y: 3.3, z: -13 });
      }
      /* 东西厢房 */
      for (const sx of [-1, 1]) {
        B(6.4, 3.4, 11, { x: sx * 11.4, y: 1.7, z: -4.5 });
        R(7.2, 1.9, 11.8, { x: sx * 11.4, y: 3.4, z: -4.5 });
      }
    } else {
      /* 正房（北） */
      B(18, 3.9, 8, { y: 1.95, z: -D / 2 + 6.5 });
      R(19.2, 2.2, 9.0, { y: 3.9, z: -D / 2 + 6.5 });
      /* 东西厢房 */
      for (const sx of [-1, 1]) {
        B(5.8, 3.1, 9, { x: sx * 9.2, y: 1.55, z: -2 });
        R(6.6, 1.7, 9.8, { x: sx * 9.2, y: 3.1, z: -2 });
      }
      /* 倒座房（南）：留出东侧门道 */
      B(12, 3.1, 5.2, { x: -3.6, y: 1.55, z: D / 2 - 4.5 });
      R(13, 1.7, 6.0, { x: -3.6, y: 3.1, z: D / 2 - 4.5 });
    }

    /* 墙身按世界尺度重算 UV：砖缝不能随院子大小缩放 */
    const walls = GG.geo.fitUV(GG.geo.merge(wall), 0.36, 3.0);
    return { walls: walls, roofs: GG.geo.merge(roof), W: W, D: D };
  }

  /* 远处城市的简化体块：一段"连排"——三间共墙的房子并排，
     屋脊高度略有参差。胡同里的房本来就联排，一院一栋的散点
     从空中看是撒芝麻，连排才读得出街巷肌理。 */
  function simpleGeoms() {
    const W = 26, D = 34, H = 3.0;
    const walls = GG.geo.fitUV(
      GG.geo.merge([
        GG.geo.box(W - 1.2, H, D, { x: -W, y: H / 2 }),
        GG.geo.box(W - 1.2, H, D, { x: 0, y: H / 2 }),
        GG.geo.box(W - 1.2, H, D, { x: W, y: H / 2 })
      ]), 0.36, 3.0
    );
    const roofs = GG.geo.merge([
      prism(W + 1.2, 2.6, D + 1.2, { x: -W, y: H }),
      prism(W + 1.2, 2.35, D + 1.2, { x: 0, y: H }),
      prism(W + 1.2, 2.75, D + 1.2, { x: W, y: H })
    ]);
    return { walls: walls, roofs: roofs, span: W * 3 };
  }

  function courtyards(scene) {
    /* 独立 LCG：不碰 Math.random，宫城的既有随机流不受影响 */
    let s = 20261019;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };

    const near = [];    // [x, z, rot, scale, kind]  kind: 0 小院 / 1 大宅
    const far = [];     // [x, z, rot, scale]
    const lights = [];
    const hutongs = []; // [x1, x2, z]

    const ROW = 50;     // 胡同一周期：胡同 9 m + 院落 40 m + 夹道
    const HUT = 9;      // 胡同宽
    const CELL = 26;    // 院面宽步长
    const BLOCK = CELL * 3;  // 连排块：三间共墙，78 m
    const nearR = 1150; // 精细院落范围（距宫城中心）

    function blocked(x, z) {
      /* 宫城 + 护城河 */
      if (Math.abs(x) < 470 && Math.abs(z) < 590) return true;
      /* 千步廊（大清门—天安门之间的御道）两侧留空 */
      if (Math.abs(x) < 150 && z > 640 && z < 840) return true;
      /* 景山与寿皇殿 */
      if (Math.hypot(x, z + 880) < 235) return true;
      if (Math.abs(x) < 80 && z < -1000 && z > -1160) return true;
      /* 太液池 */
      if (inLake(x, z, BH, 1.045)) return true;
      if (inLake(x, z, ZNH, 1.045)) return true;
      /* 坛庙：天坛外坛 1703 × 1657，先农坛 700 见方 */
      if (x > 1470 && x < 3230 && z > 2270 && z < 3990) return true;
      if (Math.abs(x + 2350) < 350 && Math.abs(z - 3300) < 350) return true;
      if (Math.abs(x - 295) < 105 && Math.abs(z - 720) < 85) return true;
      if (Math.abs(x + 295) < 105 && Math.abs(z - 720) < 85) return true;
      /* 正阳门瓮城 */
      if (Math.abs(x) < 90 && Math.abs(z - 1700) < 130) return true;
      /* 城墙内侧留出马道 */
      if (Math.abs(x) > 3230 && z < 1600) return true;
      if (Math.abs(x) > 3820) return true;
      /* 主街：前门大街、长安街、崇文门—宣武门大街 */
      if (Math.abs(x) < 30 && z > 860) return true;
      if (Math.abs(z - 880) < 34) return true;
      if (Math.abs(Math.abs(x) - 1150) < 22) return true;
      return false;
    }

    /* 近景范围：宫城周边 + 前三门大街两侧，其余交给连排层 */
    function isNear(x, z) {
      if (Math.hypot(x, z + 150) < nearR) return true;
      if (Math.abs(x) < 320 && z > 1600 && z < 3000) return true;
      return false;
    }

    /* 一行一行排：z 是胡同中线，院落只排在胡同北侧（坐北朝南）。
       近景按 26 m 一间排，远景按 78 m 一段连排 —— 两种尺度不能混在
       一个循环里，否则边界会出现"半间房"的缺口。 */
    for (let zh = -2330; zh <= 4370; zh += ROW) {
      const cz = zh - HUT / 2 - 20;

      /* 胡同地面：按未遮挡的连续区间铺 */
      let runStart = null;
      for (let x = -3780; x <= 3780; x += CELL) {
        const bad = blocked(x, cz) || blocked(x + CELL, cz) || blocked(x, zh);
        if (bad) {
          if (runStart !== null && x - runStart > 24) hutongs.push([runStart, x, zh]);
          runStart = null;
        } else if (runStart === null) {
          runStart = x;
        }
      }
      if (runStart !== null && 3780 - runStart > 24) hutongs.push([runStart, 3780, zh]);

      /* 院落 */
      for (let bx = -3780; bx < 3780; bx += BLOCK) {
        /* 逐格判断遮挡，不能一格越界就把整段 78 m 都丢掉 ——
           湖岸、坛墙这类边界会把整条街挖出一片空地 */
        const ok = [0, 1, 2].map((i) => !blocked(bx + CELL * (i + 0.5), cz));
        const n = ok[0] + ok[1] + ok[2];
        if (!n) continue;
        /* 街区级留白：整段空出来，城市才有大院、庙宇与空地。
           用哈希而不是取模，否则留白会排成一条条等距的直线。 */
        if (rnd() < 0.14) continue;

        if (isNear(bx + BLOCK / 2, cz)) {
          for (let i = 0; i < 3; i++) {
            if (!ok[i]) continue;
            const x = bx + CELL * (i + 0.5);
            if (rnd() > 0.9) continue;
            const big = rnd() < 0.16;
            const sc = 0.94 + rnd() * 0.14;
            near.push([x, cz, rnd() < 0.1 ? Math.PI : 0, big ? 1.0 : sc, big ? 1 : 0]);
            if (near.length % 6 === 0) lights.push([x, cz, sc]);
          }
        } else {
          if (rnd() > 0.96) continue;
          const sc = 0.96 + rnd() * 0.09;
          /* 只占一段时按有效格数横向缩窄，位置落在有效格的中心 */
          const first = ok.indexOf(true);
          const last = 2 - [ok[2], ok[1], ok[0]].indexOf(true);
          const span = (last - first + 1) / 3;
          const midX = bx + CELL * ((first + last) / 2 + 0.5);
          far.push({
            x: midX + (rnd() - 0.5) * 3,
            z: cz + (rnd() - 0.5) * 4,
            rot: rnd() < 0.06 ? Math.PI : 0,
            sc: sc,
            big: rnd() < 0.035,
            sx: span
          });
          if (far.length % 12 === 0) lights.push([midX, cz, sc]);
        }
      }
    }

    /* ---------- 精细院落 ---------- */
    const small = siheyuanGeoms('small');
    const bigG = siheyuanGeoms('big');
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();

    function buildLayer(list, geos) {
      const n = list.length;
      if (!n) return null;
      const wm = new THREE.InstancedMesh(geos.walls, M.brick, n);
      const rm = new THREE.InstancedMesh(geos.roofs, M.tileGray, n);
      wm.castShadow = true;
      wm.receiveShadow = true;
      rm.castShadow = true;
      rm.receiveShadow = true;
      wm.frustumCulled = false;
      rm.frustumCulled = false;
      list.forEach((p, i) => {
        dummy.position.set(p[0], 0, p[1]);
        dummy.rotation.set(0, p[2], 0);
        dummy.scale.setScalar(p[3]);
        dummy.updateMatrix();
        wm.setMatrixAt(i, dummy.matrix);
        rm.setMatrixAt(i, dummy.matrix);
        /* 每院一点色差：整片灰瓦里不能是同一个灰 */
        const v = 0.86 + ((i * 37) % 11) / 55;
        col.setRGB(v * 0.99, v, v * 1.01);
        wm.setColorAt(i, col);
        const rv = 0.82 + ((i * 53) % 13) / 48;
        col.setRGB(rv, rv, rv * 1.02);
        rm.setColorAt(i, col);
      });
      wm.instanceMatrix.needsUpdate = true;
      rm.instanceMatrix.needsUpdate = true;
      if (wm.instanceColor) wm.instanceColor.needsUpdate = true;
      if (rm.instanceColor) rm.instanceColor.needsUpdate = true;
      scene.add(wm);
      scene.add(rm);
      return { wm: wm, rm: rm };
    }

    const smallList = near.filter((p) => p[4] === 0);
    const bigList = near.filter((p) => p[4] === 1);
    buildLayer(smallList, small);
    buildLayer(bigList, bigG);

    /* ---------- 远景肌理：一个 InstancedMesh 一对，2 个 draw call ---------- */
    if (far.length) {
      const sg = simpleGeoms();
      const n = far.length;
      const wm = new THREE.InstancedMesh(sg.walls, M.brick, n);
      const rm = new THREE.InstancedMesh(sg.roofs, M.tileGray, n);
      wm.receiveShadow = true;
      rm.receiveShadow = true;
      wm.frustumCulled = false;
      rm.frustumCulled = false;
      far.forEach((p, i) => {
        dummy.position.set(p.x, 0, p.z);
        dummy.rotation.set(0, p.rot, 0);
        /* sx 是横向占比：贴着湖岸 / 坛墙时只占两三格 */
        if (p.big) dummy.scale.set(p.sx * p.sc * 1.05, p.sc * 1.9, p.sc * 1.05);
        else dummy.scale.set(p.sx * p.sc, p.sc, p.sc);
        dummy.updateMatrix();
        wm.setMatrixAt(i, dummy.matrix);
        rm.setMatrixAt(i, dummy.matrix);
        const v = 0.8 + ((i * 41) % 13) / 42;
        col.setRGB(v, v, v * 1.01);
        wm.setColorAt(i, col);
        const rv = 0.7 + ((i * 29) % 13) / 42;
        col.setRGB(rv, rv, rv * 1.02);
        rm.setColorAt(i, col);
      });
      wm.instanceMatrix.needsUpdate = true;
      rm.instanceMatrix.needsUpdate = true;
      if (wm.instanceColor) wm.instanceColor.needsUpdate = true;
      if (rm.instanceColor) rm.instanceColor.needsUpdate = true;
      scene.add(wm);
      scene.add(rm);
    }

    /* ---------- 胡同地面：把街巷"画"出来 ---------- */
    const strip = [];
    for (const [x1, x2, z] of hutongs) {
      const w = x2 - x1;
      if (w < 20) continue;
      /* 一段胡同只要两个三角：贴图密度写进 UV，别用分段几何堆三角形 */
      const g = GG.geo.uvScale(new THREE.PlaneGeometry(w, HUT, 1, 1), w / 8, HUT / 8);
      g.rotateX(-Math.PI / 2);
      g.translate((x1 + x2) / 2, 0, z);
      strip.push(g);
    }
    if (strip.length) {
      const sm = new THREE.Mesh(GG.geo.merge(strip), GG.build.groundMaterial('paving', 0x8f8b80, 0.97));
      sm.receiveShadow = true;
      scene.add(sm);
    }

    /* ---------- 院树：胡同两侧，三五户一棵 ---------- */
    for (let i = 0; i < near.length; i += 3) {
      const p = near[i];
      treeSpots.cyp.push([p[0] + 9, p[1] + 19, 0.42 + (i % 3) * 0.05, 0]);
    }
    for (let i = 0; i < far.length; i += 3) {
      const p = far[i];
      treeSpots.cyp.push([p.x - 8, p.z + 20, 0.44 + (i % 4) * 0.05, 0]);
    }

    /* ---------- 夜间窗火 ---------- */
    cityLamp = new THREE.MeshBasicMaterial({
      color: 0xffb469, transparent: true, opacity: 0, depthWrite: false
    });
    const lampGeo = new THREE.PlaneGeometry(3.0, 2.0);
    lampGeo.rotateX(-Math.PI / 2);
    const lamp = new THREE.InstancedMesh(lampGeo, cityLamp, Math.max(1, lights.length));
    lamp.frustumCulled = false;
    if (!lights.length) lamp.count = 0;   // 没有窗火就别在原点留一盏
    lights.forEach((p, i) => {
      dummy.rotation.set(0, 0, 0);
      dummy.position.set(p[0], 5.4 * p[2], p[1]);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      lamp.setMatrixAt(i, dummy.matrix);
    });
    lamp.instanceMatrix.needsUpdate = true;
    scene.add(lamp);
    M.cityLamp = cityLamp;

    return { near: near.length, far: far.length, hutongs: hutongs.length };
  }

  /* ---------------- 总装 ---------------- */

  GG.city = {
    treeSpots,
    build(scene, reg) {
      register = reg || null;
      M = GG.build.buildMaterials();
      const t = GG.getTextures();
      grayWall = new THREE.MeshStandardMaterial({
        map: t.brickGray, bumpMap: t.brickGray, bumpScale: 0.24,
        color: 0x8d8a80, roughness: 0.96, metalness: 0, envMapIntensity: 0.18
      });

      /* ---------- 城外地坪（城市底色） ----------
         中间挖掉宫城所在的方块：innerPave 就在洞里，两张平面不重叠。
         重叠 5 cm 的两块地坪在 2 km 外会因深度精度不足互相闪烁。 */
      const shape = new THREE.Shape();
      shape.moveTo(-4300, -3550);
      shape.lineTo(4300, -3550);
      shape.lineTo(4300, 3550);
      shape.lineTo(-4300, 3550);
      shape.closePath();
      const hole = new THREE.Path();
      hole.moveTo(-382, -487);
      hole.lineTo(382, -487);
      hole.lineTo(382, 487);
      hole.lineTo(-382, 487);
      hole.closePath();
      shape.holes.push(hole);
      /* 天坛外坛 1703 × 1657 也从城市地坪里挖掉。不挖的话，
         外坛草地与城市地坪只差 17 cm，3 km 外深度精度不够，
         整片南区会被城市地坪吃掉（实测：坛南半截变胡同）。 */
      if (GG.tiantan && GG.tiantan.footprintPath) {
        shape.holes.push(GG.tiantan.footprintPath(850));
      }
      const cityGeo = new THREE.ShapeGeometry(shape);
      cityGeo.rotateX(-Math.PI / 2);
      GG.geo.uvScale(cityGeo, 0.1, 0.1);
      const cityGround = new THREE.Mesh(
        cityGeo, GG.build.groundMaterial('paving', 0x5e584d, 0.97)
      );
      cityGround.position.set(0, -0.05, 850);
      cityGround.receiveShadow = true;
      scene.add(cityGround);

      /* 前门大街与长安街：两条最显眼的街道 */
      const streetMat = GG.build.groundMaterial('paving', 0x8f8879, 0.95);
      streetMat.polygonOffset = true;
      streetMat.polygonOffsetFactor = -2;
      streetMat.polygonOffsetUnits = -4;
      const avenue = new THREE.Mesh(
        GG.geo.uvScale(new THREE.PlaneGeometry(46, 3580), 5, 360), streetMat
      );
      avenue.rotation.x = -Math.PI / 2;
      avenue.position.set(0, 0.08, 2620);
      avenue.receiveShadow = true;
      scene.add(avenue);
      const changan = new THREE.Mesh(
        GG.geo.uvScale(new THREE.PlaneGeometry(6800, 52), 680, 6), streetMat
      );
      changan.rotation.x = -Math.PI / 2;
      changan.position.set(0, 0.08, 880);
      changan.receiveShadow = true;
      scene.add(changan);

      /* ---------- 皇城 ---------- */
      const hcWall = {
        h: HC.h, t: HC.t, crenel: false, capRise: 0.95, capOver: 0.85,
        capMat: M.tileCapYellow, ridgeMat: M.ridge
      };
      /* 南墙在千步廊两侧断开；大清门在墙外收口 */
      wallLine(scene, 'x', HC.s, -HC.x, -118, [], hcWall);
      wallLine(scene, 'x', HC.s, 118, HC.x, [], hcWall);
      wallLine(scene, 'x', HC.n, -HC.x, HC.x, gapsFor(HC_GATES, HC.n, 'x'), hcWall);
      wallLine(scene, 'z', HC.x, HC.n, HC.s, gapsFor(HC_GATES, HC.x, 'z'), hcWall);
      wallLine(scene, 'z', -HC.x, HC.n, HC.s, gapsFor(HC_GATES, -HC.x, 'z'), hcWall);
      for (const g of HC_GATES) gate(scene, g);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          cornerTower(scene, sx * HC.x, sz < 0 ? HC.n : HC.s, HC.h);
        }
      }
      /* 皇城墙内的行道树：红墙下面一条绿带，宫城才不孤零零 */
      treeLine(-HC.x + 70, 720, -160, 720, 26, 0.7, 0.5);
      treeLine(160, 720, HC.x - 70, 720, 26, 0.7, 0.5);
      treeLine(-HC.x + 80, -1600, HC.x - 80, -1600, 34, 0.72, 0.55);
      treeLine(HC.x - 90, -1580, HC.x - 90, 700, 26, 0.66, 0.45);
      treeLine(-HC.x + 90, -1580, -HC.x + 90, 700, 26, 0.66, 0.45);

      /* ---------- 内城 ---------- */
      const ncWall = {
        h: NC.h, t: NC.t, crenel: true, pitch: 15, merlon: 5.5, merlonH: 2.1,
        innerParapet: false, mat: grayWall, capMat: M.stone, ridgeMat: M.stone
      };
      wallLine(scene, 'x', NC.s, -NC.x, NC.x, gapsFor(NC_GATES, NC.s, 'x'), ncWall);
      wallLine(scene, 'x', NC.n, -NC.x, NC.x, gapsFor(NC_GATES, NC.n, 'x'), ncWall);
      wallLine(scene, 'z', NC.x, NC.n, NC.s, gapsFor(NC_GATES, NC.x, 'z'), ncWall);
      wallLine(scene, 'z', -NC.x, NC.n, NC.s, gapsFor(NC_GATES, -NC.x, 'z'), ncWall);
      for (const g of NC_GATES) gate(scene, Object.assign({ city: true }, g));
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) cornerTower(scene, sx * NC.x, sz < 0 ? NC.n : NC.s, NC.h);
      }

      /* 正阳门：箭楼 + 瓮城 */
      gate(scene, {
        x: 0, z: 1745, ry: 0, w: 64, d: 26, h: 11.5,
        mw: 36, md: 12, mh: 8, rh: 6.6, doors: 3, city: true
      });
      for (const sx of [-1, 1]) {
        wallSeg(scene, sx * 52, NC.s, sx * 52, 1745, {
          h: 11, t: 7, crenel: true, pitch: 8, merlon: 3.5, merlonH: 1.4,
          innerParapet: false, mat: grayWall, capMat: M.stone, ridgeMat: M.stone
        });
        wallSeg(scene, sx * 52, 1745, sx * 32, 1745, {
          h: 11, t: 7, crenel: true, pitch: 8, merlon: 3.5, merlonH: 1.4,
          innerParapet: false, mat: grayWall, capMat: M.stone, ridgeMat: M.stone
        });
      }

      /* ---------- 外城 ---------- */
      const wcWall = {
        h: WC.h, t: WC.t, crenel: true, pitch: 15, merlon: 5.5, merlonH: 2.0,
        innerParapet: false, mat: grayWall, capMat: M.stone, ridgeMat: M.stone
      };
      wallLine(scene, 'x', WC.s, -WC.x, WC.x, gapsFor(WC_GATES, WC.s, 'x'), wcWall);
      wallLine(scene, 'z', WC.x, WC.n, WC.s, gapsFor(WC_GATES, WC.x, 'z'), wcWall);
      wallLine(scene, 'z', -WC.x, WC.n, WC.s, gapsFor(WC_GATES, -WC.x, 'z'), wcWall);
      wallLine(scene, 'x', WC.n, NC.x, WC.x, [], wcWall);
      wallLine(scene, 'x', WC.n, -WC.x, -NC.x, [], wcWall);
      for (const g of WC_GATES) gate(scene, Object.assign({ city: true }, g));
      for (const sx of [-1, 1]) {
        cornerTower(scene, sx * WC.x, WC.n, WC.h);
        cornerTower(scene, sx * WC.x, WC.s, WC.h);
      }

      /* ---------- 坛庙与三海 ---------- */
      if (GG.tiantan) GG.tiantan.build(scene, mark, treeSpots);
      xianNongTan(scene, -2350, 3300);
      beihai(scene);
      zhongnanhai(scene);
      const city = courtyards(scene);
      GG.city.stats = city;

      /* ---------- 树 ---------- */
      /* 内城城墙内侧 */
      for (const sx of [-1, 1]) {
        treeLine(sx * 3120, -2280, sx * 3120, 1560, 34, 0.72, 0.5);
        treeLine(sx * 3180, -2280, sx * 3180, 1560, 26, 0.62, 0.4);
      }
      /* 外城南墙与东西墙内侧 */
      treeLine(-3720, 4260, 3720, 4260, 42, 0.72, 0.45);
      treeLine(3720, 1720, 3720, 4260, 22, 0.66, 0.4);
      treeLine(-3720, 1720, -3720, 4260, 22, 0.66, 0.4);
      /* 前门大街两侧 */
      treeLine(-26, 900, -26, 4300, 26, 0.56, 0.55);
      treeLine(26, 900, 26, 4300, 26, 0.56, 0.55);
      /* 天坛与先农坛 */
      /* 天坛的柏林由 js/tiantan.js 自己铺，这里只留先农坛一环 */
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2;
        treeSpots.pine.push([-2350 + Math.cos(a) * 280, 3300 + Math.sin(a) * 280, 0.85 + (i % 3) * 0.1, 0]);
      }
      /* 长安街林荫 */
      treeLine(-3000, 906, 3000, 906, 56, 0.5, 0.5);

      return city;
    }
  };
})();
