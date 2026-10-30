/* ============================================================
   天坛 —— 清乾隆十九年（1754）定型格局
   ------------------------------------------------------------
   依据：乾隆十二年（1747）坛墙包砖，十四年（1749）圜丘改三层
   艾叶青石坛、汉白玉栏板，十六年（1751）祈年殿三色瓦改为一色
   蓝琉璃，十七年（1752）皇穹宇改建为单檐圆殿，十九年（1754）
   神乐署定名。这一轮改动之后，天坛的形制再没有变过。

   范围：外坛 1703 × 1657 米（273 公顷）、内坛 1025 × 1283 米，
   北圆南方两重坛墙；祈谷坛、圜丘坛、斋宫、神乐署、牺牲所五组，
   以及丹陛桥、七十二长廊、七星石、燔柴炉、望灯台。

   尺度全部取自实测（见 docs/tiantan.md）。场景中的位置仍按
   京师棋盘做了压缩，不改变建筑本身的尺寸与比例。

   铁律：
   - 不消耗 Math.random：柏林用整数哈希铺，位置可复现。
   - 只有祈年殿 / 圜丘 / 皇穹宇 / 斋宫 / 丹陛桥进索引，
     其余墙体、栏杆、树全部并入世界静态合批。
   ============================================================ */
(function () {
  const GG = (window.GG = window.GG || {});
  const G = GG.geo;
  const TAU = Math.PI * 2;

  /* ---------------- 实测尺度（米） ---------------- */
  const AX = 2350;                       // 坛域中轴
  /* 外坛：南北 1657、东西 1703，北墙半圆 r=851.5，南墙 z=3960 */
  const OUT = { w: 1703, south: 3960, r: 851.5, spring: 3154.5, h: 6.0, t: 2.4 };
  /* 内坛：南北 1283、东西 1025，北墙半圆 r=512.5 */
  const INN = { w: 1025, south: 3640, r: 512.5, spring: 2869.5, h: 4.8, t: 2.0 };
  /* 祈谷坛：内壝 157.5 × 187.5；坛台三层 91 / 80 / 68，高 5.6 */
  const QG = { x0: AX - 78.75, x1: AX + 78.75, z0: 2450, z1: 2637.5, h: 4.4 };
  const QN = { z: 2540, r: [45.5, 40, 34], tierH: 5.6 / 3 };
  /* 丹陛桥：长 360、宽 30，北高南低 */
  const BR = { z0: 2637.5, z1: 2997.5, w: 30, h0: 4.2, h1: 1.5 };
  /* 皇穹宇：殿高 19.5、径 15.6；回音壁径 61.5、高 3.72 */
  const HQ = { z: 3060, wallR: 30.75, wallH: 3.72 };
  /* 圜丘：三层 23.65 / 39.3 / 54.92，通高 5.17 */
  const HQI = { z: 3380, r: [27.46, 19.65, 11.83], h: 5.17 / 3 };
  /* 斋宫：约 4 公顷，两重宫墙两道御沟 */
  const ZG = { x: 1980, z: 3060, half: 100, inner: 60 };
  const SY = { x: 1650, z: 3200 };
  const XS = { x: 1700, z: 3800 };

  let M = null;
  let TXT = null;
  let blueLattice = null;
  let soffitMat = null;
  let greenGlaze = null;

  function init() {
    if (M) return;
    TXT = GG.getTextures();
    M = GG.build.buildMaterials();
    /* 汉白玉比宫城的台基石更白：天坛的台基、栏板、棂星门全用它 */
    if (!M.marbleWhite) {
      M.marbleWhite = new THREE.MeshStandardMaterial({
        color: 0xc7c1af, roughness: 0.84, metalness: 0.02, envMapIntensity: 0.2
      });
    }
    /* 台基压暗的一道束腰：三层台如果不压这道暗线，
       在正午顶光下会连成一个白锥，读不出三层的层次 */
    if (!M.marbleShade) {
      M.marbleShade = new THREE.MeshStandardMaterial({
        color: 0x8f8877, roughness: 0.92, metalness: 0.01
      });
    }
    if (!M.rockDark) {
      M.rockDark = new THREE.MeshStandardMaterial({
        color: 0x4c473c, roughness: 0.96, metalness: 0.01
      });
    }
    /* 殿身隔扇：天坛夜里不点窗纸，克隆一份把自发光钉在 0，
       renderer.setSun 不会碰这个克隆 */
    blueLattice = M.lattice.clone();
    blueLattice.emissiveIntensity = 0;
    /* 檐底望板：从下往上看是一层深色木底，不是蓝瓦的背面 */
    soffitMat = new THREE.MeshStandardMaterial({
      map: TXT.rafter, color: 0x6b5a44, roughness: 0.94, side: THREE.DoubleSide
    });
    /* 燔柴炉 / 燎炉 / 斋宫屋面的绿琉璃：砖砌体量，不铺瓦垄贴图 */
    greenGlaze = new THREE.MeshStandardMaterial({
      color: 0x2e6b4a, roughness: 0.62, metalness: 0.08, envMapIntensity: 0.3
    });
  }

  const cos = Math.cos, sin = Math.sin;

  /* ---------------- 批量合并 ---------------- */
  function Batch() { this.list = []; }
  Batch.prototype.add = function (geo, mat, cast, recv) {
    if (!geo) return;
    this.list.push({ geo, mat, cast: cast !== false, recv: recv !== false });
  };
  Batch.prototype.flush = function (parent) {
    const buckets = new Map();
    for (const p of this.list) {
      const key = p.mat.uuid + (p.cast ? 'c' : '') + (p.recv ? 'r' : '');
      let b = buckets.get(key);
      if (!b) {
        b = { mat: p.mat, cast: p.cast, recv: p.recv, geos: [] };
        buckets.set(key, b);
      }
      b.geos.push(p.geo);
    }
    for (const b of buckets.values()) {
      const m = new THREE.Mesh(G.merge(b.geos), b.mat);
      m.castShadow = b.cast;
      m.receiveShadow = b.recv;
      parent.add(m);
    }
    this.list.length = 0;
  };

  /* ---------------- 墙 ---------------- */
  function wallSeg(scene, x1, z1, x2, z2, cfg) {
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 2) return;
    const g = GG.build.createWall(Object.assign({ length: len }, cfg));
    g.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
    g.rotation.y = Math.atan2(-dz, dx);
    scene.add(g);
  }

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

  /* 北墙半圆：a 从 π（西）经 π/2（北）到 0（东） */
  function wallArc(scene, cx, cz, r, a0, a1, segs, cfg) {
    let px = null, pz = null;
    for (let i = 0; i <= segs; i++) {
      const a = a0 + (a1 - a0) * (i / segs);
      const x = cx + cos(a) * r;
      const z = cz - sin(a) * r;
      if (px !== null) wallSeg(scene, px, pz, x, z, cfg);
      px = x; pz = z;
    }
  }

  /* ---------------- 圆形台基 / 栏杆 / 踏跺 ---------------- */
  function ringMesh(scene, x, z, y, r, h, mat, seg) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.35, h, seg || 96), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  /** 三层圆台，返回台顶高度 */
  function circularTerrace(scene, x, z, y0, radii, tierH) {
    let y = y0;
    for (let i = 0; i < radii.length; i++) {
      ringMesh(scene, x, z, y, radii[i], tierH, M.marbleWhite);
      /* 束腰：每层脚下 0.4 m 的暗带。三层台基的"层"全靠这条线。
         半径要大于台身下口的 r+0.35，否则暗带藏在石台里看不见。 */
      ringMesh(scene, x, z, y + 0.04, radii[i] + 0.62, 0.4, M.marbleShade);
      /* 上下枭混线脚：一道薄环，台基才有石作的层次 */
      ringMesh(scene, x, z, y + tierH - 0.16, radii[i] + 0.5, 0.16, M.marbleWhite);
      ringMesh(scene, x, z, y, radii[i] + 0.55, 0.14, M.marbleWhite);
      y += tierH;
    }
    return y;
  }

  /** 一环望柱 + 栏板。gaps: [[中心角, 半宽]] */
  function ringRailing(batch, o) {
    const n = o.n;
    const gaps = o.gaps || [];
    const inGap = (a) => gaps.some((g) =>
      Math.abs(Math.atan2(Math.sin(a - g[0]), Math.cos(a - g[0]))) < g[1]);
    const h = o.h || 1.1;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const ok = !inGap(a);
      if (ok) {
        batch.add(G.box(0.24, h, 0.24, {
          x: cos(a) * o.r, y: o.y + h / 2, z: sin(a) * o.r, ry: -a
        }), M.marbleWhite);
        batch.add(G.box(0.34, 0.1, 0.34, {
          x: cos(a) * o.r, y: o.y + h + 0.04, z: sin(a) * o.r, ry: -a
        }), M.marbleWhite);
      }
      const a2 = ((i + 1) / n) * TAU;
      if (!ok || inGap(a2)) continue;
      const am = a + Math.PI / n;
      const chord = 2 * sin(Math.PI / n) * o.r;
      batch.add(G.box(chord * 0.94, h * 0.5, 0.14, {
        x: cos(am) * o.r, y: o.y + h * 0.48, z: sin(am) * o.r,
        ry: -(am + Math.PI / 2)
      }), M.marbleWhite);
      batch.add(G.box(chord * 0.94, h * 0.12, 0.2, {
        x: cos(am) * o.r, y: o.y + h * 0.07, z: sin(am) * o.r,
        ry: -(am + Math.PI / 2)
      }), M.marbleWhite);
    }
  }

  /** 一段踏跺：a 为向外方向角，r 为台边半径，topY 为该层台面高度 */
  function stairsFlight(batch, o) {
    const geo = G.stairsGeometry(o.w, o.h, o.steps || 9, o.depth || 3.0, 's');
    batch.add(G.xform(geo, {
      x: cos(o.a) * o.r, y: o.topY - o.h, z: sin(o.a) * o.r,
      ry: Math.PI / 2 - o.a
    }), o.mat || M.marbleWhite);
  }

  /* ---------------- 圆攒尖屋面 ---------------- */
  function roundRoofGeo(o) {
    const seg = o.seg || 96, vSeg = o.vSeg || 10;
    const R = o.R, rTop = o.rTop == null ? 0.4 : o.rTop, h = o.h;
    const curv = o.curv || 1.5, lift = o.lift == null ? 0.45 : o.lift;
    const circ = TAU * R;
    /* 瓦垄 0.55 m 一道；取 8 的倍数，贴图接缝才落在垄沟上 */
    const nRidge = Math.max(8, Math.round(circ / 0.55 / 8) * 8);
    const uRep = nRidge / 8;
    const pos = [], uv = [], col = [], idx = [];
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * TAU;
      for (let i = 0; i <= vSeg; i++) {
        const t = i / vSeg;
        const r = R + (rTop - R) * t;
        const y = h * Math.pow(t, curv) + lift * Math.pow(1 - t, 4);
        pos.push(cos(a) * r, y, sin(a) * r);
        uv.push((j / seg) * uRep, (R - r) / 7.6);
        const s = 1 - 0.34 * Math.pow(1 - t, 1.6) + 0.05 * Math.pow(t, 3);
        col.push(s, s, s);
      }
    }
    for (let j = 0; j < seg; j++) {
      for (let i = 0; i < vSeg; i++) {
        const a = j * (vSeg + 1) + i;
        const b = a + 1;
        const c = (j + 1) * (vSeg + 1) + i;
        const d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /** 一层檐：屋面 + 檐底望板 + 檐口瓦当。返回檐口高度（相对 baseY） */
  function eave(scene, batch, o) {
    const lift = o.lift == null ? 0.45 : o.lift;
    const roof = new THREE.Mesh(roundRoofGeo(Object.assign({ lift }, o)), M.tileBlue);
    roof.position.y = o.y;
    roof.castShadow = true;
    roof.receiveShadow = true;
    scene.add(roof);

    /* 望板：水平环，挡住屋面背面。从殿下仰视看到的是木底不是瓦 */
    const soffit = new THREE.RingGeometry(o.rTop + 0.05, o.R + 0.02, 96);
    soffit.rotateX(-Math.PI / 2);
    const sm = new THREE.Mesh(soffit, soffitMat);
    sm.position.y = o.y + lift - 0.3;
    sm.receiveShadow = true;
    scene.add(sm);

    /* 檐口：一圈薄立板 + 瓦当。96 段围一圈，远看是一条深蓝的边。
       立板做到 0.85 m —— 三重檐之间的暗缝全靠它，0.5 m 在 300 m 外只有 1 px。 */
    const fascia = new THREE.Mesh(
      new THREE.CylinderGeometry(o.R + 0.06, o.R + 0.06, 0.85, 96, 1, true),
      M.ridgeBlue
    );
    fascia.position.y = o.y + lift - 0.42;
    fascia.castShadow = true;
    scene.add(fascia);

    const n = Math.max(24, Math.round((TAU * o.R) / 0.55 / 4) * 4);
    const step = TAU / n;
    for (let i = 0; i < n; i++) {
      const a = i * step;
      batch.add(G.box(0.22, 0.2, 0.34, {
        x: cos(a) * (o.R + 0.08), y: o.y + lift - 0.03, z: sin(a) * (o.R + 0.08), ry: -a
      }), M.tileEndBlue, false, false);
    }
    return o.y + o.h + lift;
  }

  /** 鎏金宝顶：露盘、宝珠、刹尖 */
  function finial(scene, y, s) {
    s = s || 1;
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(1.7 * s, 2.3 * s, 0.55 * s, 24), M.gold);
    pan.position.y = y + 0.27 * s;
    pan.castShadow = true;
    scene.add(pan);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1.25 * s, 20, 14), M.gold);
    ball.position.y = y + 1.35 * s;
    ball.castShadow = true;
    scene.add(ball);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * s, 0.42 * s, 0.9 * s, 12), M.gold);
    neck.position.y = y + 2.3 * s;
    scene.add(neck);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.3 * s, 0.85 * s, 12), M.gold);
    tip.position.y = y + 2.85 * s;
    scene.add(tip);
  }

  /**
   * 圆形殿身：隔扇、檐柱、额枋、斗拱。
   * o: r, h, bays, colR, lattice
   */
  function roundBody(scene, batch, o) {
    const r = o.r, h = o.h, bays = o.bays;
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.985, r * 0.985, h, 64, 1, true), M.wall
    );
    core.position.y = h / 2;
    core.castShadow = true;
    core.receiveShadow = true;
    scene.add(core);

    const colR = o.colR == null ? 0.36 : o.colR;
    const colH = o.lattice ? h * 0.94 : h;
    for (let i = 0; i < bays; i++) {
      const a = (i / bays) * TAU;
      batch.add(G.xform(new THREE.CylinderGeometry(colR * 0.86, colR, colH, 10), {
        x: cos(a) * (r + 0.22), y: colH / 2, z: sin(a) * (r + 0.22)
      }), M.column);
    }

    if (o.lattice) {
      const chord = 2 * (r + 0.06) * sin(Math.PI / bays) - 0.72;
      const lh = h * 0.68;
      for (let i = 0; i < bays; i++) {
        const a = ((i + 0.5) / bays) * TAU;
        const p = G.uvScale(new THREE.PlaneGeometry(chord, lh), chord / 3.2, lh / 3.2);
        const panel = new THREE.Mesh(p, blueLattice);
        panel.position.set(cos(a) * (r + 0.06), h * 0.44, sin(a) * (r + 0.06));
        panel.rotation.y = Math.PI / 2 - a;
        panel.castShadow = true;
        scene.add(panel);
        /* 上下槛：隔扇分间的横线 */
        for (const yy of [h * 0.44 - lh / 2, h * 0.44 + lh / 2]) {
          batch.add(G.box(chord, 0.16, 0.18, {
            x: cos(a) * (r + 0.14), y: yy, z: sin(a) * (r + 0.14), ry: -a
          }), M.column);
        }
      }
    }

    /* 额枋：和玺彩画一圈 */
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(r + 0.34, r + 0.34, 1.15, 64, 1, true), M.caihuaHexi
    );
    beam.position.y = h - 0.58;
    scene.add(beam);
    /* 斗拱：一层密排的暗带，远看是檐下一道阴影 */
    const dou = new THREE.Mesh(
      new THREE.CylinderGeometry(r + 0.62, r + 0.62, 0.72, 64, 1, true), M.dougong
    );
    dou.position.y = h - 0.18;
    scene.add(dou);
  }

  /* ---------------- 门 ---------------- */
  function templeGate(scene, o) {
    const g = GG.build.createHall({
      w: o.w || 22, d: o.d || 10, h: o.h || 7,
      roofH: o.roofH || 4.4, style: 'hip', blue: true, bays: 3,
      tiers: 1, tierH: 1.0, eave: 2.2, railing: false, stairs: o.stairs !== false,
      info: null
    });
    g.position.set(o.x, o.y || 0.5, o.z);
    g.rotation.y = o.ry || 0;
    /* 不参与拾取：门楼交给世界静态合批 */
    g.userData.isBuilding = false;
    scene.add(g);
    return g;
  }

  /* ---------------- 地坪 ---------------- */
  function precinctShape(o, hole) {
    const hw = o.w / 2;
    const x0 = AX - hw, x1 = AX + hw;
    const sh = new THREE.Shape();
    sh.moveTo(x0, -o.south);
    sh.lineTo(x0, -o.spring);
    const N = 64;
    for (let i = 1; i <= N; i++) {
      const a = Math.PI - (i / N) * Math.PI;
      sh.lineTo(AX + cos(a) * o.r, -o.spring + sin(a) * o.r);
    }
    sh.lineTo(x1, -o.south);
    sh.closePath();
    if (hole) {
      /* 内坛在外坛地坪上挖掉：两张地坪不重叠，2 km 外才不会闪。
         孔洞绕向与外轮廓相反（外顺、孔逆）。 */
      const hh = hole.w / 2;
      const hx0 = AX - hh, hx1 = AX + hh;
      const hp = new THREE.Path();
      hp.moveTo(hx1, -hole.south);
      hp.lineTo(hx1, -hole.spring);
      for (let i = 1; i <= N; i++) {
        const a = (i / N) * Math.PI;
        hp.lineTo(AX + cos(a) * hole.r, -hole.spring + sin(a) * hole.r);
      }
      hp.lineTo(hx0, -hole.south);
      hp.closePath();
      sh.holes.push(hp);
    }
    return sh;
  }

  /* 供 city.js 在城市地坪上挖洞：shiftZ 是该地坪 mesh 的 z 偏移 */
  function footprintPath(shiftZ) {
    const hw = OUT.w / 2;
    const x0 = AX - hw, x1 = AX + hw;
    const p = new THREE.Path();
    p.moveTo(x0, shiftZ - OUT.south);
    p.lineTo(x0, shiftZ - OUT.spring);
    for (let i = 1; i <= 64; i++) {
      const a = Math.PI - (i / 64) * Math.PI;
      p.lineTo(AX + cos(a) * OUT.r, shiftZ - (OUT.spring - sin(a) * OUT.r));
    }
    p.lineTo(x1, shiftZ - OUT.south);
    p.closePath();
    return p;
  }

  function ground(scene, o, y, color, hole) {
    const geo = new THREE.ShapeGeometry(precinctShape(o, hole));
    geo.rotateX(-Math.PI / 2);
    G.uvScale(geo, 0.05, 0.05);
    const mat = GG.build.groundMaterial('grass', color, 1);
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  /* ============================================================
     祈谷坛：坛台、祈年殿、祈年门、东西配殿、皇乾殿
     ============================================================ */
  function qinianHall(scene, topY) {
    const group = new THREE.Group();
    group.position.set(AX, topY, QN.z);

    /* 殿身 9.6 m；三重檐逐层收进，总高 38.2（含台基 5.6）。
       各层衔接：檐顶 = 下一层屋身底，不能留缝。 */
    const gb = new Batch();
    roundBody(group, gb, { r: 11.9, h: 9.6, bays: 12, colR: 0.4, lattice: true });
    gb.flush(group);

    const eb1 = new Batch();
    eave(group, eb1, {
      y: 9.6, R: 16.35, rTop: 10.55, h: 3.6, lift: 0.5, seg: 120, vSeg: 12
    });
    eb1.flush(group);

    /* 第二层屋身 */
    const s2 = new THREE.Mesh(new THREE.CylinderGeometry(10.4, 10.4, 2.0, 64), M.wall);
    s2.position.y = 13.2;
    s2.castShadow = true;
    group.add(s2);
    const d2 = new THREE.Mesh(new THREE.CylinderGeometry(10.75, 10.75, 0.62, 64, 1, true), M.dougong);
    d2.position.y = 14.9;
    group.add(d2);

    const eb2 = new Batch();
    eave(group, eb2, {
      y: 15.2, R: 14.3, rTop: 8.75, h: 3.8, lift: 0.44, seg: 112, vSeg: 12
    });
    eb2.flush(group);

    /* 第三层屋身 */
    const s3 = new THREE.Mesh(new THREE.CylinderGeometry(8.6, 8.6, 1.8, 64), M.wall);
    s3.position.y = 19.9;
    s3.castShadow = true;
    group.add(s3);
    const d3 = new THREE.Mesh(new THREE.CylinderGeometry(8.95, 8.95, 0.56, 64, 1, true), M.dougong);
    d3.position.y = 20.6;
    group.add(d3);

    const eb3 = new Batch();
    const top = eave(group, eb3, {
      y: 20.8, R: 12.2, rTop: 0.4, h: 7.2, lift: 0.36, seg: 120, vSeg: 14
    });
    eb3.flush(group);
    finial(group, top, 1.15);

    /* 匾额：蓝底金边，挂在南面檐下 */
    const plaque = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 1.25, 0.16),
      [M.ridgeBlue, M.ridgeBlue, M.gold, M.gold, M.ridgeBlue, M.ridgeBlue]
    );
    plaque.position.set(0, 8.7, 12.35);
    group.add(plaque);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.95), M.gold);
    face.position.set(0, 8.7, 12.45);
    group.add(face);

    scene.add(group);
    return group;
  }

  /* 七十二长廊：祈谷坛东砖门到神厨院，350 米、72 间，曲尺形。
     长廊是运祭品的雨道，不是殿宇，瓦用灰筒瓦。 */
  function corridor72(scene) {
    const c1 = GG.build.createCorridor({
      length: 190, depth: 5.2, h: 3.6, roofH: 2.7, tierH: 0.5,
      tileMat: M.tileGray, ridgeMat: M.darkStone, noGlow: true, info: null
    });
    c1.position.set(2525, 0.5, 2520);
    c1.userData.isBuilding = false;
    scene.add(c1);

    const c2 = GG.build.createCorridor({
      length: 200, depth: 5.2, h: 3.6, roofH: 2.7, tierH: 0.5,
      tileMat: M.tileGray, ridgeMat: M.darkStone, noGlow: true, info: null
    });
    c2.position.set(2620, 0.5, 2620);
    c2.rotation.y = Math.PI / 2;
    c2.userData.isBuilding = false;
    scene.add(c2);
  }

  /* 神厨院：长廊南端，蓝瓦小院 */
  function kitchenCourt(scene) {
    const wcfg = {
      h: 3.2, t: 1.4, crenel: false, capRise: 0.42, capOver: 0.35,
      mat: M.wall, capMat: M.tileCapBlue, ridgeMat: M.ridgeBlue
    };
    wallLine(scene, 'x', 2720, 2600, 2760, [[2666, 2694]], wcfg);
    wallLine(scene, 'x', 2840, 2600, 2760, [], wcfg);
    wallLine(scene, 'z', 2600, 2720, 2840, [], wcfg);
    wallLine(scene, 'z', 2760, 2720, 2840, [], wcfg);
    for (const [dx, dz, w] of [[2680, 2760, 24], [2680, 2810, 18]]) {
      const h = GG.build.createHall({
        w, d: 10, h: 5.2, roofH: 3.8, style: 'xieshan', blue: true, bays: 3,
        tiers: 1, tierH: 0.6, eave: 1.5, info: null
      });
      h.position.set(dx, 0.5, dz);
      h.rotation.y = Math.PI / 2;
      h.userData.isBuilding = false;
      scene.add(h);
    }
  }

  /* 七星石：七块大石按北斗排列，乾隆时加一小石，共八块 */
  function sevenStars(scene) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(46, 0.7, 18), M.stone);
    base.position.set(2770, 0.5 + 0.35, 2590);
    base.receiveShadow = true;
    scene.add(base);
    const b = new Batch();
    const rock = new THREE.DodecahedronGeometry(1.7, 0);
    for (let i = 0; i < 7; i++) {
      b.add(G.xform(rock, {
        x: 2752 + i * 5.6, y: 0.5 + 0.7 + 2.2, z: 2588 + (i % 2 ? 2.4 : -1.6),
        ry: i * 0.63, sx: 0.9, sy: 2.4, sz: 0.72
      }), M.rockDark);
    }
    b.add(G.xform(rock, {
      x: 2806, y: 0.5 + 0.7 + 1.4, z: 2592, ry: 1.2, sx: 0.55, sy: 1.5, sz: 0.5
    }), M.rockDark);
    b.flush(scene);
  }

  function qiguAltar(scene, marks) {
    const y0 = 0.5;
    const top = circularTerrace(scene, AX, QN.z, y0, QN.r, QN.tierH);

    /* 台面：清水澄浆方砖 */
    const paveMat = new THREE.MeshStandardMaterial({
      map: TXT.goldBrick, roughness: 0.9, metalness: 0.02
    });
    const pave = new THREE.Mesh(
      G.uvScale(new THREE.CircleGeometry(34, 96), 14, 14), paveMat
    );
    pave.rotation.x = -Math.PI / 2;
    pave.position.set(AX, top + 0.02, QN.z);
    pave.receiveShadow = true;
    scene.add(pave);

    /* 三层栏板：上层龙纹、中层凤纹、下层云纹。纹样不建模，
       但三层的高度与间距必须对得上 —— 栏板是祈谷坛的横向节奏。 */
    const rb = new Batch();
    const gapS = 0.42, gapE = 0.15;
    ringRailing(rb, {
      r: 45.2, y: top - 2 * QN.tierH + 0.02, h: 1.1, n: 156,
      gaps: [[Math.PI / 2, gapS], [0, gapE], [Math.PI, gapE], [Math.PI * 1.5, gapE]]
    });
    ringRailing(rb, {
      r: 39.7, y: top - QN.tierH + 0.02, h: 1.08, n: 136,
      gaps: [[Math.PI / 2, gapS * 0.92], [0, gapE], [Math.PI, gapE], [Math.PI * 1.5, gapE]]
    });
    ringRailing(rb, {
      r: 33.7, y: top + 0.02, h: 1.06, n: 116,
      gaps: [[Math.PI / 2, gapS * 0.84], [0, gapE], [Math.PI, gapE], [Math.PI * 1.5, gapE]]
    });

    /* 踏跺：南面三出陛，东西北各一出陛 */
    for (let i = 0; i < 3; i++) {
      const tierTop = y0 + QN.tierH * (i + 1);
      const r = QN.r[i];
      for (const a of [Math.PI / 2 - 0.12, Math.PI / 2, Math.PI / 2 + 0.12, 0, Math.PI, Math.PI * 1.5]) {
        const south = Math.abs(a - Math.PI / 2) < 0.05;
        const side = a === 0 || a === Math.PI;
        stairsFlight(rb, {
          a, r, topY: tierTop, h: QN.tierH, w: south ? 11 : side ? 9 : 8,
          steps: 9, depth: 3.0
        });
      }
    }
    rb.flush(scene);

    /* 祈年殿 */
    const hall = qinianHall(scene, top);
    hall.userData.labelY = 46;
    hall.userData.pickRadius = 74;
    marks.push(hall, 'qiniandian', 46, 74);

    /* 祈谷坛内壝：157.5 × 187.5，红墙蓝瓦 */
    const wcfg = {
      h: QG.h, t: 2.0, crenel: false, capRise: 0.55, capOver: 0.5,
      mat: M.wall, capMat: M.tileCapBlue, ridgeMat: M.ridgeBlue
    };
    wallLine(scene, 'x', QG.z0, QG.x0, QG.x1,
      [[AX - 23, AX - 13], [AX - 5, AX + 5], [AX + 13, AX + 23]], wcfg);
    wallLine(scene, 'x', QG.z1, QG.x0, QG.x1, [[AX - 15, AX + 15]], wcfg);
    wallLine(scene, 'z', QG.x0, QG.z0, QG.z1, [[QN.z - 10, QN.z + 10]], wcfg);
    wallLine(scene, 'z', QG.x1, QG.z0, QG.z1, [[QN.z - 10, QN.z + 10]], wcfg);

    /* 东西砖门：长廊与西路的入口 */
    for (const sx of [-1, 1]) {
      templeGate(scene, {
        x: QG.x0 + (sx < 0 ? 0 : QG.x1 - QG.x0), z: QN.z, y: 0.5,
        ry: sx < 0 ? -Math.PI / 2 : Math.PI / 2,
        w: 18, d: 9, h: 6.4, roofH: 4.2
      });
    }

    /* 祈年门：五间庑殿，崇基石栏 */
    const qm = GG.build.createHall({
      w: 30, d: 12, h: 8.2, roofH: 5.4, style: 'hip', blue: true, bays: 5,
      tiers: 2, tierH: 1.1, railing: true, eave: 2.4, info: null
    });
    qm.position.set(AX, 0.5, QG.z1 - 1.5);
    qm.userData.isBuilding = false;
    scene.add(qm);

    /* 东西配殿：九间，蓝瓦歇山 */
    for (const sx of [-1, 1]) {
      const side = GG.build.createHall({
        w: 42, d: 13, h: 7.2, roofH: 5.2, style: 'xieshan', blue: true, bays: 9,
        tiers: 1, tierH: 1.1, eave: 2.0, info: null
      });
      side.position.set(AX + sx * 61, 0.5, QN.z);
      side.rotation.y = Math.PI / 2;
      side.userData.isBuilding = false;
      scene.add(side);
    }

    /* 皇乾殿：五间庑殿，蓝瓦，月台 */
    const hq = GG.build.createHall({
      w: 30, d: 16, h: 8.0, roofH: 5.6, style: 'hip', blue: true, bays: 5,
      tiers: 1, tierH: 1.6, eave: 2.5, railing: true, info: null
    });
    hq.position.set(AX, 0.5, 2408);
    hq.userData.isBuilding = false;
    scene.add(hq);

    /* 北墙三座琉璃门：通皇乾殿 */
    const gb = new Batch();
    for (const dx of [-18, 0, 18]) glazedPortal(gb, AX + dx, QG.z0, 0.5, 4.4, 9.0);
    gb.flush(scene);

    /* 祈谷坛东侧：七十二长廊、神厨院、七星石 */
    corridor72(scene);
    kitchenCourt(scene);
    sevenStars(scene);
  }

  /* 琉璃门：三间小门，蓝瓦顶。只做门洞与檐口，不做门扇 */
  function glazedPortal(batch, x, z, y, h, w) {
    const half = w / 2;
    for (const sx of [-1, 1]) {
      batch.add(G.box(0.9, h, 1.6, { x: x + sx * half, y: y + h / 2, z }), M.wall);
    }
    batch.add(G.box(w, 0.7, 1.7, { x, y: y + h + 0.35, z }), M.wall);
    const roof = G.roofGeometry({
      hw: half + 1.0, hd: 1.4, topX: 0, topZ: 0, h: 2.0,
      curv: 1.3, lift: 0.25, uSeg: 10, vSeg: 3, withSides: true
    });
    batch.add(G.xform(roof, { x, y: y + h + 0.7, z }), M.tileBlue);
    batch.add(G.box(w - 1.8, h - 0.2, 0.2, { x, y: y + (h - 0.2) / 2, z: z + 0.9 }), M.column);
  }

  /* ============================================================
     丹陛桥：长 360、宽 30，北高南低，中部有走牲道券洞
     ============================================================ */
  function causewayGeo(o) {
    /* 局部坐标：桥心在原点，长度沿 ±z。整组再搬到 (AX, 0, 桥心) */
    const x0 = -o.w / 2, x1 = o.w / 2;
    const z0 = -o.len / 2, z1 = o.len / 2;
    const y0 = o.h0, y1 = o.h1;
    const pos = [], uv = [], idx = [];
    const push = (x, y, z, u, v) => { pos.push(x, y, z); uv.push(u, v); };
    /* 顶面：法线朝上 */
    push(x0, y0, z0, 0, 0); push(x1, y0, z0, 1, 0);
    push(x0, y1, z1, 0, 8); push(x1, y1, z1, 1, 8);
    idx.push(0, 2, 1, 1, 2, 3);
    /* 西侧（朝 -X） */
    push(x0, y0, z0, 0, 0); push(x0, 0, z0, 0, 1);
    push(x0, y1, z1, 8, 0); push(x0, 0, z1, 8, 1);
    idx.push(4, 5, 6, 5, 7, 6);
    /* 东侧（朝 +X）：绕序与西侧相反 */
    push(x1, y0, z0, 0, 0); push(x1, 0, z0, 0, 1);
    push(x1, y1, z1, 8, 0); push(x1, 0, z1, 8, 1);
    idx.push(8, 10, 9, 9, 10, 11);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  function danbiBridge(scene, marks) {
    const len = BR.z1 - BR.z0;
    const group = new THREE.Group();
    group.position.set(AX, 0, (BR.z0 + BR.z1) / 2);
    const geo = causewayGeo({ w: BR.w, h0: BR.h0, h1: BR.h1, len });
    const m = new THREE.Mesh(geo, M.stone);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);

    /* 三路：中间神路石板，东御路砖，西王路石。宽度按 10 / 8 / 8 */
    const lane = (dx, w, mat) => {
      const g = causewayGeo({ w, h0: BR.h0 + 0.035, h1: BR.h1 + 0.035, len });
      const mesh = new THREE.Mesh(g, mat);
      mesh.position.x = dx;
      mesh.receiveShadow = true;
      group.add(mesh);
    };
    lane(0, 10, GG.build.groundMaterial('paving', 0x9a9384, 0.95));
    lane(9, 7.6, GG.build.groundMaterial('paving', 0x837d70, 0.96));
    lane(-9, 7.6, GG.build.groundMaterial('paving', 0x8d8678, 0.96));

    /* 走牲道券洞：两侧各一个半圆，桥面不断 */
    for (const sx of [-1, 1]) {
      const arch = new THREE.Mesh(
        new THREE.CylinderGeometry(2.2, 2.2, 1.2, 24, 1, false, 0, Math.PI),
        M.darkStone
      );
      arch.rotation.z = Math.PI / 2;
      arch.rotation.y = Math.PI / 2;
      arch.position.set(sx * 15.1, 0.42, 0);
      group.add(arch);
    }

    scene.add(group);
    marks.push(group, 'tiantan', 78, 250);

    /* 成贞门：丹陛桥南端的隔墙门 */
    templeGate(scene, { x: AX, z: 2997.5, y: 0.5, w: 24, d: 11, h: 7.6, roofH: 4.8 });
  }

  /* ============================================================
     皇穹宇：单檐圆殿 + 回音壁
     ============================================================ */
  function huangqiongyu(scene, marks) {
    const cx = AX, cz = HQ.z;
    const g = new THREE.Group();
    g.position.set(cx, 0.5, cz);

    /* 两层圆台 */
    const top = circularTerrace(g, 0, 0, 0, [12.0, 10.2], 0.9);
    const rb = new Batch();
    ringRailing(rb, {
      r: 11.8, y: top - 0.9, h: 0.95, n: 44,
      gaps: [[Math.PI / 2, 0.12], [0, 0.06], [Math.PI, 0.06], [Math.PI * 1.5, 0.06]]
    });
    stairsFlight(rb, { a: Math.PI / 2, r: 12.0, topY: top - 0.9, h: 0.9, w: 5.2, steps: 6, depth: 2.2 });
    rb.flush(g);

    /* 殿身坐在台面上，不插进台基 */
    const hall = new THREE.Group();
    hall.position.y = top;
    g.add(hall);
    const hb = new Batch();
    roundBody(hall, hb, { r: 7.0, h: 8.6, bays: 8, colR: 0.3, lattice: true });
    hb.flush(hall);
    const eb = new Batch();
    const eaveTop = eave(hall, eb, {
      y: 8.6, R: 9.75, rTop: 0.4, h: 6.2, lift: 0.34, seg: 96, vSeg: 12
    });
    eb.flush(hall);
    finial(hall, eaveTop, 0.9);

    /* 回音壁：圆墙，南面三座琉璃门 */
    const wallShape = new THREE.Shape();
    wallShape.absarc(0, 0, HQ.wallR, 0, TAU, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, HQ.wallR - 0.9, 0, TAU, true);
    wallShape.holes.push(hole);
    const wallGeo = new THREE.ExtrudeGeometry(wallShape, {
      depth: HQ.wallH, bevelEnabled: false, curveSegments: 96
    });
    wallGeo.rotateX(-Math.PI / 2);
    const wall = new THREE.Mesh(wallGeo, M.wall);
    wall.position.y = 0;
    wall.castShadow = true;
    wall.receiveShadow = true;
    g.add(wall);

    /* 压顶：一圈蓝琉璃 */
    const cap = new THREE.Mesh(new THREE.RingGeometry(HQ.wallR - 1.1, HQ.wallR + 0.55, 96), M.tileCapBlue);
    cap.rotation.x = -Math.PI / 2;
    cap.position.y = HQ.wallH;
    g.add(cap);
    const capOut = new THREE.Mesh(
      new THREE.CylinderGeometry(HQ.wallR + 0.55, HQ.wallR + 0.2, 0.3, 96, 1, true), M.tileCapBlue
    );
    capOut.position.y = HQ.wallH - 0.14;
    g.add(capOut);

    /* 南面三门 */
    const gb = new Batch();
    for (const dx of [-8, 0, 8]) {
      glazedPortal(gb, dx, HQ.wallR + 0.4, 0, 4.0, 5.2);
      gb.add(G.box(3.2, 3.2, 0.18, { x: dx, y: 1.7, z: HQ.wallR - 0.1 }), M.column);
    }
    gb.flush(g);

    /* 东西配殿：五间歇山，蓝瓦，六级台阶 */
    for (const sx of [-1, 1]) {
      const side = GG.build.createHall({
        w: 26, d: 10, h: 6.2, roofH: 4.4, style: 'xieshan', blue: true, bays: 5,
        tiers: 1, tierH: 0.9, eave: 1.8, info: null
      });
      side.position.set(AX + sx * 21, 0.5, cz - 1);
      side.rotation.y = Math.PI / 2;
      side.userData.isBuilding = false;
      scene.add(side);
    }

    scene.add(g);
    g.userData.labelY = 24;
    g.userData.pickRadius = 46;
    marks.push(g, 'huangqiongyu', 24, 46);
  }

  /* ============================================================
     圜丘坛：三层艾叶青石坛、内外壝、棂星门、燔柴炉、望灯
     ============================================================ */
  function ringPlatform(scene) {
    const cx = AX, cz = HQI.z, y0 = 0.5;
    const top = circularTerrace(scene, cx, cz, y0, HQI.r, HQI.h);

    /* 坛面：艾叶青石。九环扇面石用明暗相间的薄环表示，
       天心石直径 0.8 m */
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x707880, roughness: 0.88, metalness: 0.02
    });
    for (let i = 0; i < 9; i++) {
      const r0 = 0.4 + i * 1.18;
      const ring = new THREE.Mesh(new THREE.RingGeometry(r0, r0 + 1.16, 96), i % 2 ? stoneMat : M.marbleWhite);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(cx, top + 0.05, cz);
      ring.receiveShadow = true;
      scene.add(ring);
    }
    const heart = new THREE.Mesh(new THREE.CircleGeometry(0.4, 32), M.marbleWhite);
    heart.rotation.x = -Math.PI / 2;
    heart.position.set(cx, top + 0.06, cz);
    scene.add(heart);

    /* 栏板 360 块：上层 72、中层 108、下层 180 */
    const rb = new Batch();
    ringRailing(rb, { r: 11.5, y: top, h: 0.95, n: 72,
      gaps: [[Math.PI / 2, 0.15], [0, 0.15], [Math.PI, 0.15], [Math.PI * 1.5, 0.15]] });
    ringRailing(rb, { r: 19.3, y: top - HQI.h, h: 0.95, n: 108,
      gaps: [[Math.PI / 2, 0.10], [0, 0.10], [Math.PI, 0.10], [Math.PI * 1.5, 0.10]] });
    ringRailing(rb, { r: 27.1, y: top - 2 * HQI.h, h: 0.95, n: 180,
      gaps: [[Math.PI / 2, 0.075], [0, 0.075], [Math.PI, 0.075], [Math.PI * 1.5, 0.075]] });

    /* 每层四面出陛，各九级 */
    for (let i = 0; i < 3; i++) {
      const tierTop = y0 + HQI.h * (i + 1);
      for (const a of [Math.PI / 2, 0, Math.PI, Math.PI * 1.5]) {
        stairsFlight(rb, {
          a, r: HQI.r[i], topY: tierTop, h: HQI.h, w: a === Math.PI / 2 ? 9 : 8,
          steps: 9, depth: 2.7
        });
      }
    }
    rb.flush(scene);
    return top;
  }

  /** 棂星门：汉白玉三间石坊 */
  function lingxingGate(batch, x, z, ry) {
    const parts = [];
    const w = 5.2, h = 4.6;
    for (let i = 0; i < 4; i++) {
      const px = -w / 2 + (i * w) / 3;
      parts.push(G.box(0.42, h, 0.42, { x: px, y: h / 2 }));
      parts.push(G.box(0.66, 0.2, 0.66, { x: px, y: h + 0.1 }));
      parts.push(G.xform(new THREE.CylinderGeometry(0.16, 0.28, 0.5, 4), {
        x: px, y: h + 0.45, ry: Math.PI / 4
      }));
    }
    for (const y of [h * 0.45, h * 0.9]) {
      parts.push(G.box(w + 0.7, 0.32, 0.34, { y }));
    }
    const g = G.merge(parts);
    batch.add(G.xform(g, { x, y: 0.5, z, ry }), M.marbleWhite);
  }

  function huanqiu(scene, marks) {
    const cx = AX, cz = HQI.z;
    const top = ringPlatform(scene);

    /* 内壝圆形 / 外壝方形：红墙蓝瓦。
       角度沿用 wallArc 的约定：0 东、π/2 北、π 西、3π/2 南。 */
    const wcfg = {
      h: 3.4, t: 1.6, crenel: false, capRise: 0.48, capOver: 0.42,
      mat: M.wall, capMat: M.tileCapBlue, ridgeMat: M.ridgeBlue
    };
    const rIn = 36;
    const half = 65;
    const ga = 10 / rIn;          // 每组棂星门占 20 米，墙上留口
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      wallArc(scene, cx, cz, rIn, a + ga, a + Math.PI / 2 - ga, 24, wcfg);
    }
    const gw = 10;
    wallLine(scene, 'x', cz - half, cx - half, cx + half,
      [[cx - gw, cx + gw]], wcfg);
    wallLine(scene, 'x', cz + half, cx - half, cx + half,
      [[cx - gw, cx + gw]], wcfg);
    wallLine(scene, 'z', cx - half, cz - half, cz + half,
      [[cz - gw, cz + gw]], wcfg);
    wallLine(scene, 'z', cx + half, cz - half, cz + half,
      [[cz - gw, cz + gw]], wcfg);

    /* 八组二十四座棂星门：内外壝各四组，每组三门 */
    const lb = new Batch();
    const gateAt = (px, pz, a) => {
      const ry = Math.PI / 2 + a;
      const tx = -Math.sin(a), tz = -Math.cos(a);
      for (const off of [-6.6, 0, 6.6]) {
        lingxingGate(lb, px + tx * off, pz + tz * off, ry);
      }
    };
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      gateAt(cx + cos(a) * rIn, cz - sin(a) * rIn, a);
      gateAt(cx + cos(a) * half, cz - sin(a) * half, a);
    }
    lb.flush(scene);

    /* 燔柴炉：外壝东南，绿琉璃砖圆炉，三面各九级 */
    const fx = cx + 40, fz = cz + 44;
    const furnace = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.0, 4.4, 24), greenGlaze);
    furnace.position.set(fx, 0.5 + 2.2, fz);
    furnace.castShadow = true;
    furnace.receiveShadow = true;
    scene.add(furnace);
    const fb = new Batch();
    const fg = new THREE.Group();
    fg.position.set(fx, 0.5, fz);
    for (const a of [0, Math.PI / 2, Math.PI]) {
      stairsFlight(fb, { a, r: 3.9, topY: 4.4, h: 4.4, w: 3.2, steps: 9, depth: 2.0 });
    }
    fb.flush(fg);
    scene.add(fg);

    /* 八座燎炉：内壝东南一线 */
    const lb2 = new Batch();
    for (let i = 0; i < 8; i++) {
      const a = -0.2 - i * 0.1;
      const px = cx + cos(a) * 39.5;
      const pz = cz - sin(a) * 39.5;
      lb2.add(G.xform(new THREE.CylinderGeometry(1.0, 1.15, 1.9, 12), {
        x: px, y: 0.5 + 0.95, z: pz
      }), greenGlaze);
    }
    lb2.flush(scene);

    /* 望灯台三座：外壝西南，石台 + 十八米灯杆 + 灯笼 */
    const wb = new Batch();
    for (const dz of [6, 26, 46]) {
      const px = cx - 52, pz = cz + dz;
      wb.add(G.box(6, 1.2, 6, { x: px, y: 0.5 + 0.6, z: pz }), M.stone);
      wb.add(G.xform(new THREE.CylinderGeometry(0.22, 0.3, 18, 8), {
        x: px, y: 0.5 + 1.2 + 9, z: pz
      }), M.column);
      wb.add(G.box(1.8, 2.4, 1.8, { x: px, y: 0.5 + 1.2 + 16.6, z: pz }), M.gold);
    }
    wb.flush(scene);

    /* 具服台：外壝东南，方形石台 */
    const jf = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 14), M.stone);
    jf.position.set(cx + 50, 0.5 + 0.6, cz + 34);
    jf.castShadow = true;
    jf.receiveShadow = true;
    scene.add(jf);

    /* 神库 / 神厨 / 宰牲亭：圜丘东侧，灰瓦小院 */
    for (let i = 0; i < 3; i++) {
      const h = GG.build.createHall({
        w: 18, d: 9, h: 5.2, roofH: 3.8, style: 'gable', blue: true,
        tiers: 1, tierH: 0.6, eave: 1.4, info: null
      });
      h.position.set(cx + 112, 0.5, cz - 40 + i * 26);
      h.userData.isBuilding = false;
      scene.add(h);
    }

    /* 索引：圜丘本体。用一个不可见的圆柱做拾取代理，
       标签与侧栏仍走 registry。 */
    const anchor = new THREE.Group();
    anchor.position.set(cx, 0.5, cz);
    const proxy = new THREE.Mesh(
      new THREE.CylinderGeometry(28, 28, 6.5, 24),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    proxy.position.y = 3.2;
    proxy.userData.noMerge = true;
    anchor.add(proxy);
    scene.add(anchor);
    anchor.userData.labelY = 15;
    anchor.userData.pickRadius = 58;
    marks.push(anchor, 'huanqiu', 15, 58);
    return anchor;
  }

  /* ============================================================
     斋宫：两重宫墙、两道御沟、无梁殿、寝殿、钟楼
     已取绿琉璃 —— 皇帝斋戒时自称"天子"，不敢用蓝瓦
     ============================================================ */
  function zhaigong(scene, marks) {
    const cx = ZG.x, cz = ZG.z, y = 0.5;
    const g = new THREE.Group();
    g.position.set(cx, y, cz);

    /* 御沟：回字形水面 */
    const sh = new THREE.Shape();
    sh.moveTo(-ZG.half - 8, -ZG.half - 8);
    sh.lineTo(ZG.half + 8, -ZG.half - 8);
    sh.lineTo(ZG.half + 8, ZG.half + 8);
    sh.lineTo(-ZG.half - 8, ZG.half + 8);
    sh.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-ZG.half, -ZG.half);
    hole.lineTo(-ZG.half, ZG.half);
    hole.lineTo(ZG.half, ZG.half);
    hole.lineTo(ZG.half, -ZG.half);
    hole.closePath();
    sh.holes.push(hole);
    const moatGeo = new THREE.ShapeGeometry(sh);
    moatGeo.rotateX(-Math.PI / 2);
    const moat = new THREE.Mesh(moatGeo, M.water);
    moat.position.y = 0.28;
    g.add(moat);

    /* 两重宫墙 */
    const wcfg = {
      h: 4.6, t: 1.7, crenel: false, capRise: 0.5, capOver: 0.45,
      mat: M.wall, capMat: M.tileCapGreen, ridgeMat: M.ridge
    };
    for (const s of [ZG.half, ZG.inner]) {
      const gap = s === ZG.half ? 10 : 6;
      /* 斋宫坐西朝东：正门在东墙，不是北墙 */
      wallLine(g, 'x', -s, -s, s, [], wcfg);
      wallLine(g, 'x', s, -s, s, [], wcfg);
      wallLine(g, 'z', -s, -s, s, [], wcfg);
      wallLine(g, 'z', s, -s, s, [[-gap, gap]], wcfg);

      const gate = GG.build.createHall({
        w: 16, d: 8, h: 5.6, roofH: 3.8, style: 'hip', green: true, bays: 3,
        tiers: 1, tierH: 0.7, eave: 1.6, railing: false, info: null
      });
      gate.position.set(s, 0, 0);
      gate.rotation.y = Math.PI / 2;
      gate.userData.isBuilding = false;
      g.add(gate);
    }

    /* 无梁殿：砖拱承重，绿瓦庑殿，面东 */
    const wl = GG.build.createHall({
      w: 34, d: 16, h: 8.6, roofH: 5.6, style: 'hip', green: true, bays: 5,
      tiers: 1, tierH: 1.8, railing: true, eave: 2.4, info: null
    });
    wl.position.set(-16, 0, 0);
    wl.rotation.y = Math.PI / 2;
    wl.userData.isBuilding = false;
    g.add(wl);

    /* 寝殿：五间歇山 */
    const qd = GG.build.createHall({
      w: 26, d: 13, h: 6.4, roofH: 4.6, style: 'xieshan', green: true, bays: 5,
      tiers: 1, tierH: 1.2, eave: 1.9, info: null
    });
    qd.position.set(-48, 0, 0);
    qd.rotation.y = Math.PI / 2;
    qd.userData.isBuilding = false;
    g.add(qd);

    /* 钟楼：东北角，两层绿瓦攒尖 */
    const tower = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(12, 10, 12), M.wall);
    base.position.y = 5;
    base.castShadow = true;
    tower.add(base);
    const pv = GG.build.createPavilion({ w: 10.5, h: 4.2, roofH: 4.6, tiers: 2, green: true, info: null });
    pv.position.y = 10;
    tower.add(pv);
    tower.position.set(40, 0, -40);
    g.add(tower);

    /* 铜人石亭：正殿前，小方亭 */
    const ting = GG.build.createPavilion({ w: 4.2, h: 3.2, roofH: 2.4, tiers: 1, green: true, info: null });
    ting.position.set(14, 0, 10);
    g.add(ting);

    /* 院内铺装 */
    /* 院内铺装：做成一块 14 cm 厚的板，不用平面。
       平面与内坛草地只差十几厘米，远处会被草地的 polygonOffset 抢掉。 */
    const yard = new THREE.Mesh(
      G.uvScale(new THREE.BoxGeometry(118, 0.14, 118), 30, 30),
      GG.build.groundMaterial('paving', 0x8b8477, 0.96)
    );
    yard.position.y = 0.07;
    yard.receiveShadow = true;
    g.add(yard);

    scene.add(g);
    g.userData.labelY = 24;
    g.userData.pickRadius = 95;
    marks.push(g, 'zhaigong', 24, 95);
  }

  /* ============================================================
     神乐署 / 牺牲所：外坛西侧，只做院落与体量
     ============================================================ */
  function shenyueshu(scene) {
    const y = 0.5;
    const wcfg = {
      h: 3.6, t: 1.4, crenel: false, capRise: 0.42, capOver: 0.35,
      mat: M.brick, capMat: M.tileCapGreen, ridgeMat: M.ridge
    };
    wallLine(scene, 'x', SY.z - 75, SY.x - 110, SY.x + 110, [[SY.x - 6, SY.x + 6]], wcfg);
    wallLine(scene, 'x', SY.z + 75, SY.x - 110, SY.x + 110, [], wcfg);
    wallLine(scene, 'z', SY.x - 110, SY.z - 75, SY.z + 75, [], wcfg);
    wallLine(scene, 'z', SY.x + 110, SY.z - 75, SY.z + 75, [], wcfg);

    const main = GG.build.createHall({
      w: 32, d: 15, h: 7.2, roofH: 5.0, style: 'xieshan', green: true, bays: 5,
      tiers: 1, tierH: 1.0, eave: 2.0, info: null
    });
    main.position.set(SY.x, y, SY.z - 45);
    main.userData.isBuilding = false;
    scene.add(main);

    const back = GG.build.createHall({
      w: 24, d: 12, h: 6.2, roofH: 4.2, style: 'xieshan', green: true, bays: 3,
      tiers: 1, tierH: 0.9, eave: 1.8, info: null
    });
    back.position.set(SY.x, y, SY.z + 30);
    back.userData.isBuilding = false;
    scene.add(back);
  }

  function xishengsuo(scene) {
    const y = 0.5;
    const wcfg = {
      h: 3.2, t: 1.2, crenel: false, capRise: 0.4, capOver: 0.3,
      mat: M.brick, capMat: M.tileCapGreen, ridgeMat: M.ridge
    };
    wallLine(scene, 'x', XS.z - 70, XS.x - 90, XS.x + 90, [], wcfg);
    wallLine(scene, 'x', XS.z + 70, XS.x - 90, XS.x + 90, [], wcfg);
    wallLine(scene, 'z', XS.x - 90, XS.z - 70, XS.z + 70, [], wcfg);
    wallLine(scene, 'z', XS.x + 90, XS.z - 70, XS.z + 70, [], wcfg);
    for (let i = 0; i < 3; i++) {
      const h = GG.build.createHall({
        w: 20, d: 9, h: 4.8, roofH: 3.4, style: 'gable', green: false,
        tiers: 1, tierH: 0.5, eave: 1.3, info: null
      });
      h.position.set(XS.x - 40 + i * 40, y, XS.z - 20);
      h.userData.isBuilding = false;
      scene.add(h);
    }
  }

  /* ============================================================
     坛墙与六门
     ============================================================ */
  function precinctWalls(scene) {
    const outerCfg = {
      h: OUT.h, t: OUT.t, crenel: false, capRise: 0.58, capOver: 0.5,
      mat: M.wall, capMat: M.tileCapBlue, ridgeMat: M.ridgeBlue
    };
    const innerCfg = {
      h: INN.h, t: INN.t, crenel: false, capRise: 0.52, capOver: 0.45,
      mat: M.wall, capMat: M.tileCapBlue, ridgeMat: M.ridgeBlue
    };

    const ox0 = AX - OUT.w / 2, ox1 = AX + OUT.w / 2;
    const ix0 = AX - INN.w / 2, ix1 = AX + INN.w / 2;

    /* 外坛：南墙与东西墙是直角，北墙半圆 */
    wallLine(scene, 'x', OUT.south, ox0, ox1, [], outerCfg);
    wallLine(scene, 'z', ox0, OUT.spring, OUT.south, [[2560, 2640], [3460, 3540]], outerCfg);
    wallLine(scene, 'z', ox1, OUT.spring, OUT.south, [], outerCfg);
    wallArc(scene, AX, OUT.spring, OUT.r, Math.PI, 0, 64, outerCfg);

    /* 内坛：六门 —— 北天门、东天门、西天门、昭亨门、泰元门、广利门 */
    wallLine(scene, 'x', INN.south, ix0, ix1, [
      [2040, 2072], [2334, 2366], [2634, 2666]
    ], innerCfg);
    wallLine(scene, 'z', ix0, INN.spring, INN.south, [[3184, 3216]], innerCfg);
    wallLine(scene, 'z', ix1, INN.spring, INN.south, [[3184, 3216]], innerCfg);
    const nd = 14 / INN.r;
    wallArc(scene, AX, INN.spring, INN.r, Math.PI, Math.PI / 2 + nd, 32, innerCfg);
    wallArc(scene, AX, INN.spring, INN.r, Math.PI / 2 - nd, 0, 32, innerCfg);

    /* 内坛东西隔墙：成贞门在丹陛桥南端，墙上留口 */
    wallLine(scene, 'x', 2997.5, ix0, ix1, [[AX - 18, AX + 18]], innerCfg);

    /* 门：三间蓝瓦门楼 */
    const gates = [
      { x: AX, z: OUT.spring - OUT.r, ry: Math.PI, w: 22 },       // 北天门
      { x: ix0, z: 3200, ry: -Math.PI / 2, w: 20 },               // 西天门
      { x: ix1, z: 3200, ry: Math.PI / 2, w: 20 },                // 东天门
      { x: AX, z: INN.south, ry: 0, w: 22 },                      // 昭亨门
      { x: AX - 300, z: INN.south, ry: 0, w: 18 },                // 广利门
      { x: AX + 300, z: INN.south, ry: 0, w: 18 },                // 泰元门
      { x: ox0, z: 2600, ry: -Math.PI / 2, w: 24 },               // 祈谷坛门
      { x: ox0, z: 3500, ry: -Math.PI / 2, w: 24 }                // 圜丘坛门
    ];
    for (const gt of gates) {
      templeGate(scene, { x: gt.x, z: gt.z, y: 0.5, ry: gt.ry, w: gt.w, d: 10, h: 7.2, roofH: 4.6 });
    }

    /* 神乐署 / 牺牲所 */
    shenyueshu(scene);
    xishengsuo(scene);
  }

  /* ============================================================
     柏林
     ------------------------------------------------------------
     不计 Math.random：用整数哈希铺点，?seed=1 时位置固定。
     树位避开中轴、三组建筑、斋宫、神乐署、长廊与炉台。
     ============================================================ */
  const EXCLUDE = [
    [AX - 42, AX + 42, 2300, 3670],
    [AX - 145, AX + 145, 2410, 2680],
    [AX - 100, AX + 100, 3280, 3485],
    [AX - 48, AX + 48, 3012, 3108],
    [ZG.x - 112, ZG.x + 112, ZG.z - 112, ZG.z + 112],
    [SY.x - 118, SY.x + 118, SY.z - 83, SY.z + 83],
    [XS.x - 98, XS.x + 98, XS.z - 78, XS.z + 78],
    [2420, 2770, 2460, 2825],
    [2720, 2840, 2540, 2650],
    [AX + 60, AX + 130, 3440, 3520]
  ];

  function insidePrecinct(x, z) {
    if (x < AX - OUT.w / 2 + 4 || x > AX + OUT.w / 2 - 4) return false;
    if (z > OUT.south - 4) return false;
    if (z < OUT.spring) {
      const dx = x - AX, dz = z - OUT.spring;
      if (dx * dx + dz * dz > (OUT.r - 5) * (OUT.r - 5)) return false;
    }
    return true;
  }

  function grove(spots) {
    /* 抖动网格：先按 21 m 一格铺满，再在格内抖 ±10 m。
       纯随机撒点会结丛、留空地；纯网格又成行列。抖动网格两者都避开。
       哈希是整数位混合，同一 i 不产生斜向相关。 */
    const hash = (n) => {
      n = (n ^ 61) ^ (n >>> 16);
      n = (n + (n << 3)) | 0;
      n = n ^ (n >>> 4);
      n = Math.imul(n, 0x27d4eb2d);
      n = n ^ (n >>> 15);
      return (n >>> 0) / 4294967296;
    };
    const cell = 21;
    const x0 = AX - OUT.w / 2 + 10, x1 = AX + OUT.w / 2 - 10;
    const z0 = 2290, z1 = OUT.south - 10;
    const cols = Math.floor((x1 - x0) / cell);
    const rows = Math.floor((z1 - z0) / cell);
    let n = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = r * cols + c;
        const x = x0 + (c + 0.5) * cell + (hash(id * 2 + 1) - 0.5) * cell * 0.96;
        const z = z0 + (r + 0.5) * cell + (hash(id * 2 + 2) - 0.5) * cell * 0.96;
        if (!insidePrecinct(x, z)) continue;
        let bad = false;
        for (const e of EXCLUDE) {
          if (x > e[0] && x < e[1] && z > e[2] && z < e[3]) { bad = true; break; }
        }
        if (bad) continue;
        /* 内侧留出 8 米巡道；靠墙太密会把墙线吃掉 */
        if (Math.abs(x - (AX - OUT.w / 2)) < 8 || Math.abs(x - (AX + OUT.w / 2)) < 8) continue;
        if (Math.abs(z - OUT.south) < 8) continue;
        const pine = hash(id * 2 + 5) > 0.84;
        const s = 0.95 + hash(id * 2 + 7) * 0.5;
        (pine ? spots.pine : spots.cyp).push([x, z, s, 0]);
        n++;
      }
    }
    return n;
  }

  /* ============================================================
     总装
     ============================================================ */
  GG.tiantan = {
    build(scene, mark, spots) {
      init();
      const marks = [];
      const put = (group, key, labelY, radius) => {
        if (mark) mark(group, key, labelY, radius);
      };

      /* 地坪：外坛深、内坛浅。内坛从外坛地坪里挖出来，两张面不重叠 */
      ground(scene, OUT, 0.12, 0x3f4a33, INN);
      ground(scene, INN, 0.5, 0x4a5839);

      /* 中轴神道：祈谷坛南门到圜丘北壝，以及圜丘南壝到昭亨门。
         不能一根铺到底 —— 14 m 宽的甬路会从圜丘坛面上穿过去。 */
      const axisMat = GG.build.groundMaterial('paving', 0x8f8878, 0.95);
      axisMat.polygonOffset = true;
      axisMat.polygonOffsetFactor = -2;
      axisMat.polygonOffsetUnits = -4;
      for (const seg of [[2637, 3315], [3445, 3640]]) {
        const len = seg[1] - seg[0];
        const axis = new THREE.Mesh(
          G.uvScale(new THREE.PlaneGeometry(14, len), 3, len / 4.4), axisMat
        );
        axis.rotation.x = -Math.PI / 2;
        axis.position.set(AX, 0.62, (seg[0] + seg[1]) / 2);
        axis.receiveShadow = true;
        scene.add(axis);
      }

      precinctWalls(scene);

      /* 祈谷坛 / 丹陛桥 / 皇穹宇 / 圜丘 / 斋宫 */
      qiguAltar(scene, marks);
      danbiBridge(scene, marks);
      huangqiongyu(scene, marks);
      huanqiu(scene, marks);
      zhaigong(scene, marks);

      /* 索引挂载 */
      for (let i = 0; i < marks.length; i += 4) {
        put(marks[i], marks[i + 1], marks[i + 2], marks[i + 3]);
      }

      const trees = spots ? grove(spots) : 0;
      GG.tiantan.stats = { trees };
      return GG.tiantan.stats;
    },
    stats: { trees: 0 },
    footprintPath
  };
})();
