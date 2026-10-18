/* ============================================================
   建筑工厂 —— 殿、门、楼、亭、廊、墙
   ============================================================ */
(function () {
  const GG = (window.GG = window.GG || {});
  const G = GG.geo;

  let MAT = null;

  function buildMaterials() {
    if (MAT) return MAT;
    const t = GG.getTextures();
    MAT = {
      tile: new THREE.MeshStandardMaterial({
        map: t.tile, bumpMap: t.tileBump, bumpScale: 0.62, vertexColors: true,
        color: 0xb29b72, roughness: 0.7, metalness: 0.06
      }),
      tileGreen: new THREE.MeshStandardMaterial({
        map: t.tileGreen, bumpMap: t.tileBumpGreen, bumpScale: 0.65, vertexColors: true,
        roughness: 0.7, metalness: 0.05
      }),
      /* 墙帽 / 院墙压顶：不参与屋面顶点着色的绿琉璃 */
      tileCap: new THREE.MeshStandardMaterial({
        map: t.tileGreen, bumpMap: t.tileBumpGreen, bumpScale: 0.5,
        color: 0x6d8a6a, roughness: 0.72, metalness: 0.05
      }),
      ridge: new THREE.MeshStandardMaterial({
        color: 0x9a7c2a, roughness: 0.62, metalness: 0.2
      }),
      stone: new THREE.MeshStandardMaterial({
        map: t.stone, bumpMap: t.stone, bumpScale: 0.3,
        color: 0xa39c8a, roughness: 0.9, metalness: 0.02
      }),
      marble: new THREE.MeshStandardMaterial({
        color: 0xa9a08d, roughness: 0.88, metalness: 0.02
      }),
      wall: new THREE.MeshStandardMaterial({
        map: t.wall, bumpMap: t.wall, bumpScale: 0.25, roughness: 0.94, metalness: 0.0
      }),
      wallPlain: new THREE.MeshStandardMaterial({
        color: 0x9c2b1e, roughness: 0.94, metalness: 0.0
      }),
      column: new THREE.MeshStandardMaterial({
        color: 0x5e221a, roughness: 0.78, metalness: 0.04
      }),
      lattice: new THREE.MeshStandardMaterial({
        map: t.lattice, roughness: 0.75, metalness: 0.12
      }),
      caihua: new THREE.MeshStandardMaterial({
        map: t.caihua, color: 0x9aa8ad, roughness: 0.78, metalness: 0.08
      }),
      dougong: new THREE.MeshStandardMaterial({
        map: t.dougong, color: 0xb8c0c0, roughness: 0.78, metalness: 0.08
      }),
      rafter: new THREE.MeshStandardMaterial({
        map: t.rafter, roughness: 0.85
      }),
      gold: new THREE.MeshStandardMaterial({
        color: 0xc9a227, roughness: 0.35, metalness: 0.75
      }),
      bronze: new THREE.MeshStandardMaterial({
        color: 0x6b5a3a, roughness: 0.42, metalness: 0.8
      }),
      paving: new THREE.MeshStandardMaterial({
        map: t.paving, roughness: 0.95, metalness: 0.0
      }),
      darkStone: new THREE.MeshStandardMaterial({
        color: 0x6b6558, roughness: 0.95
      }),
      wood: new THREE.MeshStandardMaterial({
        color: 0x6b3a22, roughness: 0.85
      }),
      green: new THREE.MeshStandardMaterial({
        color: 0x4a6b3a, roughness: 0.95
      }),
      trunk: new THREE.MeshStandardMaterial({
        color: 0x3d2c1c, roughness: 0.95
      }),
      leaf: new THREE.MeshStandardMaterial({
        color: 0x2a4423, roughness: 0.92
      }),
      leaf2: new THREE.MeshStandardMaterial({
        color: 0x35552b, roughness: 0.92
      }),
      water: new THREE.MeshStandardMaterial({
        map: t.water, color: 0xffffff, roughness: 0.34, metalness: 0.2,
        transparent: true, opacity: 0.97
      })
    };
    MAT.tile.flatShading = false;
    Object.keys(MAT).forEach((k) => {
      if (MAT[k] && MAT[k].isMeshStandardMaterial) {
        MAT[k].envMapIntensity = 0.24;
      }
    });
    /* 琉璃釉面 / 水面 / 铜活：给一点环境反射，避免全哑光 */
    MAT.tile.envMapIntensity = 0.5;
    MAT.tileGreen.envMapIntensity = 0.45;
    MAT.tileCap.envMapIntensity = 0.38;
    MAT.water.envMapIntensity = 0.6;
    MAT.gold.envMapIntensity = 0.9;
    MAT.bronze.envMapIntensity = 0.8;
    MAT.ridge.envMapIntensity = 0.7;
    return MAT;
  }

  /* 让贴图按物理尺寸平铺 */
  function planeUV(w, h, sx, sy) {
    const g = new THREE.PlaneGeometry(w, h, 1, 1);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * (sx == null ? w / 2.2 : sx), uv.getY(i) * (sy == null ? h / 2.2 : sy));
    }
    return g;
  }

  function addMesh(group, geo, mat, cast, recv) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast !== false;
    m.receiveShadow = recv !== false;
    group.add(m);
    return m;
  }

  /* ============================================================
     核心：单座殿宇
     ============================================================ */
  function createHall(cfg) {
    const M = buildMaterials();
    const group = new THREE.Group();
    const W = cfg.w, D = cfg.d, H = cfg.h;
    const eave = cfg.eave == null ? Math.max(1.7, Math.min(W, D) * 0.085) : cfg.eave;
    const roofH = cfg.roofH == null ? Math.max(3.0, Math.min(W, D) * 0.38) : cfg.roofH;
    const style = cfg.style || 'hip';
    const tileMat = cfg.green ? M.tileGreen : M.tile;
    const tierN = cfg.tiers == null ? 1 : cfg.tiers;
    const tierH = cfg.tierH == null ? Math.max(1.4, H * 0.16) : cfg.tierH;
    const dbl = !!cfg.double;

    let y0 = 0;

    /* ---------- 台基 ---------- */
    if (tierN > 0 && !cfg.noTerrace) {
      const tw = W + Math.max(6, W * 0.16);
      const td = D + Math.max(6, D * 0.16);
      const t = G.terraceGeometry(tw, td, tierH, tierN);
      addMesh(group, t.geo, M.stone, true, true);
      y0 = t.top;
      const rw = tw - (tierN > 1 ? 2.6 * (tierN - 1) : 0) + 0.4;
      const rd = td - (tierN > 1 ? 2.6 * (tierN - 1) : 0) + 0.4;
      if (cfg.railing !== false) {
        addMesh(group, G.railingGeometry(rw, rd, 1.12, 0.85), M.marble, true, false);
      }
      if (cfg.stairs !== false) {
        const sh = tierH * tierN;
        const sw = Math.min(W * 0.42, 16);
        const st = G.stairsGeometry(sw, sh, 8, sh * 1.25, 's');
        addMesh(group, G.xform(st, { z: td / 2 - 0.2 }), M.stone, true, true);
      }
    }

    const bodyY = y0;
    const H1 = dbl ? H * 0.60 : H;
    const H2 = H - H1;
    const W2 = dbl ? W * 0.72 : W;
    const D2 = dbl ? D * 0.72 : D;

    /* ---------- 屋身（可叠两层） ---------- */
    function buildBody(bw, bd, bh, baseY, isLower) {
      const iw = bw - 1.4, id = bd - 1.4;
      const wm = new THREE.Mesh(
        G.fitUV(new THREE.BoxGeometry(iw, bh, id), 0.3, bh),
        [M.wall, M.wall, M.wallPlain, M.wallPlain, M.wall, M.wall]
      );
      wm.position.y = baseY + bh / 2;
      wm.castShadow = true;
      wm.receiveShadow = true;
      group.add(wm);

      const latH = Math.max(2.0, bh * 0.68);
      const lat = new THREE.Mesh(
        planeUV(iw * 0.93, latH, (iw * 0.93) / 3.4, latH / 3.4),
        M.lattice
      );
      lat.position.set(0, baseY + latH / 2 + bh * 0.02, id / 2 + 0.07);
      lat.receiveShadow = true;
      group.add(lat);
      const latB = lat.clone();
      latB.rotation.y = Math.PI;
      latB.position.z = -id / 2 - 0.07;
      group.add(latB);

      // 中央三间门洞（凹进的暗部，拉开层次）
      const doorW = Math.min(iw * 0.34, 15);
      const doorH = latH * 0.94;
      const dk = new THREE.Mesh(
        new THREE.PlaneGeometry(doorW, doorH),
        new THREE.MeshStandardMaterial({ color: 0x2a0f0a, roughness: 0.96 })
      );
      dk.position.set(0, baseY + doorH / 2 + bh * 0.02, id / 2 + 0.09);
      group.add(dk);
      // 门槛与门框
      const sill = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.6, 0.3, 0.5), M.stone);
      sill.position.set(0, baseY + 0.15, id / 2 + 0.2);
      group.add(sill);

      addMesh(group, G.columnRing(bw, bd, bh, cfg.colStep || 5.2), M.column, true, true);

      const beamH = Math.max(0.7, bh * 0.085);
      const beam = new THREE.Mesh(planeUV(bw + 0.1, beamH, bw / 3.2, 1), M.caihua);
      beam.position.set(0, baseY + bh - beamH / 2, bd / 2 + 0.04);
      group.add(beam);
      const beam2 = beam.clone();
      beam2.position.z = -bd / 2 - 0.04;
      beam2.rotation.y = Math.PI;
      group.add(beam2);
      const beam3 = beam.clone();
      beam3.position.set(bw / 2 + 0.04, baseY + bh - beamH / 2, 0);
      beam3.rotation.y = Math.PI / 2;
      beam3.scale.x = bd / bw;
      group.add(beam3);
      const beam4 = beam3.clone();
      beam4.position.x = -bw / 2 - 0.04;
      beam4.rotation.y = -Math.PI / 2;
      group.add(beam4);

      addMesh(
        group,
        G.dougongRing(bw, bd, baseY + bh - beamH - 0.15, Math.max(0.55, bh * 0.07)),
        M.dougong, true, false
      );

      /* 殿额匾 */
      if (isLower && cfg.plaque) {
        const pw = Math.min(bw * 0.26, 7.6);
        const ph = pw * 0.305;
        const pm = new THREE.Mesh(
          new THREE.PlaneGeometry(pw, ph),
          new THREE.MeshStandardMaterial({
            map: GG.getPlaque(cfg.plaque),
            roughness: 0.5, metalness: 0.22,
            emissive: 0x120c04, emissiveIntensity: 1.0
          })
        );
        pm.position.set(0, baseY + bh * 0.8, bd / 2 + 0.52);
        pm.castShadow = true;
        group.add(pm);
        // 匾托
        const bracket = new THREE.Mesh(new THREE.BoxGeometry(pw * 1.06, 0.28, 0.34), M.gold);
        bracket.position.set(0, baseY + bh * 0.8 + ph / 2 + 0.12, bd / 2 + 0.44);
        group.add(bracket);
      }
    }

    buildBody(W, D, H1, bodyY, true);

    let roofBase = bodyY + H1;
    let roofW = W, roofD = D, eaveR = eave;

    /* ---------- 腰檐 + 上层屋身 ---------- */
    if (dbl) {
      const hwS = W / 2 + eave * 1.15;
      const hdS = D / 2 + eave * 1.15;
      const skirtH = Math.max(2.4, roofH * 0.44);
      const sg = G.roofGeometry({
        hw: hwS, hd: hdS,
        topX: W2 / 2 - 0.6, topZ: D2 / 2 - 0.6,
        h: skirtH, curv: 1.08,
        lift: Math.min(hwS, hdS) * 0.042, liftExp: 3.0,
        uSeg: Math.max(10, Math.round(hwS * 0.5)), vSeg: 4,
        withSides: true, sideVMax: 1
      });
      const sm = new THREE.Mesh(sg, tileMat);
      sm.position.y = roofBase;
      sm.castShadow = true;
      sm.receiveShadow = true;
      group.add(sm);

      const raf1 = new THREE.Mesh(new THREE.BoxGeometry(hwS * 2.02, 0.46, hdS * 2.02), M.rafter);
      raf1.position.y = roofBase - 0.22;
      group.add(raf1);

      // 腰檐正脊（围脊）
      const rim = new THREE.Mesh(
        new THREE.BoxGeometry(W2 + 1.2, 0.7, D2 + 1.2), M.ridge
      );
      rim.position.y = roofBase + skirtH * 0.92;
      group.add(rim);

      buildBody(W2, D2, H2, roofBase, false);
      roofBase = roofBase + H2;
      roofW = W2;
      roofD = D2;
      eaveR = eave * 0.9;
    }

    /* ---------- 屋顶 ---------- */
    const hw = roofW / 2 + eaveR;
    const hd = roofD / 2 + eaveR;
    let topX = 0, topZ = 0, sideVMax = 1, withSides = true;
    if (style === 'hip') {
      topX = Math.max(hw * 0.05, hw - hd * 0.76);
      topZ = 0;
    } else if (style === 'xieshan') {
      topX = hw * 0.52;
      topZ = 0;
      sideVMax = 0.6;
    } else if (style === 'gable') {
      topX = hw;
      topZ = 0;
      withSides = false;
    } else if (style === 'pyramid') {
      topX = 0;
      topZ = 0;
    }
    const lift = Math.min(hw, hd) * 0.024;
    const rg = G.roofGeometry({
      hw: hw, hd: hd, topX: topX, topZ: topZ, h: roofH,
      curv: 1.55, lift: lift,
      uSeg: Math.max(12, Math.round(hw * 0.6)),
      vSeg: 12, sideVMax: sideVMax, withSides: withSides
    });
    const rm = new THREE.Mesh(rg, tileMat);
    rm.position.y = roofBase;
    rm.castShadow = true;
    rm.receiveShadow = true;
    group.add(rm);

    if (style === 'xieshan' || style === 'gable') {
      const gg = G.gableGeometry({
        hw: hw, hd: hd, topX: topX, h: roofH, curv: 1.55,
        vCut: style === 'xieshan' ? 0.6 : 0
      });
      const gm = new THREE.Mesh(gg, M.wall);
      gm.position.y = roofBase;
      gm.castShadow = true;
      group.add(gm);
    }

    const ridges = G.ridgeGeometry({
      hw: hw, hd: hd, topX: topX, topZ: topZ, h: roofH, lift: lift, curv: 1.55
    });
    const rm2 = new THREE.Mesh(ridges, M.ridge);
    rm2.position.y = roofBase;
    rm2.castShadow = true;
    group.add(rm2);

    const raf = new THREE.Mesh(new THREE.BoxGeometry(hw * 2.02, 0.5, hd * 2.02), M.rafter);
    raf.position.y = roofBase - 0.24;
    group.add(raf);

    /* ---------- 元数据 ---------- */
    const totalH = roofBase + roofH;
    group.userData.info = cfg.info || {};
    group.userData.isBuilding = true;
    group.userData.labelY = totalH + 2.2;
    group.userData.pickRadius = Math.max(W, D) * 0.75;
    group.userData.center = new THREE.Vector3(0, (y0 + totalH) * 0.5, 0);
    return group;
  }

  /* ============================================================
     铜陈设：太平缸 / 铜鹤 / 日晷
     ============================================================ */
  function createBronzeSet(kind, x, z, ry) {
    const M = buildMaterials();
    const g = new THREE.Group();
    const parts = [];
    const H = kind === 'vat' ? 1.5 : kind === 'crane' ? 3.2 : 2.2;

    if (kind === 'vat') {
      // 太平缸：鼓腹 + 口沿 + 底座
      parts.push(G.xform(new THREE.CylinderGeometry(0.72, 0.86, 1.15, 16), { y: 0.78 }));
      parts.push(G.xform(new THREE.TorusGeometry(0.74, 0.09, 8, 18), { y: 1.35, rx: Math.PI / 2 }));
      parts.push(G.xform(new THREE.CylinderGeometry(0.5, 0.62, 0.24, 14), { y: 0.12 }));
      parts.push(G.xform(new THREE.TorusGeometry(0.86, 0.08, 6, 16), { y: 0.95, rx: Math.PI / 2 }));
    } else if (kind === 'crane') {
      // 铜鹤：细腿 + 椭身 + 长颈 + 首
      parts.push(G.xform(new THREE.CylinderGeometry(0.07, 0.09, 1.3, 6), { x: -0.2, y: 0.65 }));
      parts.push(G.xform(new THREE.CylinderGeometry(0.07, 0.09, 1.3, 6), { x: 0.2, y: 0.65 }));
      parts.push(G.xform(new THREE.SphereGeometry(0.46, 10, 8), { y: 1.65, sx: 1.5, sy: 0.95, sz: 0.9 }));
      parts.push(G.xform(new THREE.CylinderGeometry(0.1, 0.16, 1.5, 7), { x: -0.28, y: 2.5, rz: 0.28 }));
      parts.push(G.xform(new THREE.SphereGeometry(0.2, 8, 7), { x: -0.52, y: 3.18, sx: 1.5 }));
      parts.push(G.xform(new THREE.ConeGeometry(0.09, 0.5, 6), { x: -0.82, y: 3.14, rz: Math.PI / 2 }));
    } else {
      // 日晷：石座 + 斜盘
      parts.push(G.xform(new THREE.BoxGeometry(1.5, 1.2, 1.5), { y: 0.6 }));
      parts.push(G.xform(new THREE.CylinderGeometry(0.9, 0.9, 0.16, 20), { y: 1.45, rx: -0.62 }));
      parts.push(G.xform(new THREE.CylinderGeometry(0.045, 0.045, 1.1, 5), { y: 1.75, rx: 0.42 }));
    }

    const mesh = new THREE.Mesh(G.merge(parts), kind === 'vat' ? M.bronze : M.bronze);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    g.position.set(x, 0, z);
    if (ry) g.rotation.y = ry;
    g.userData.isBuilding = false;
    return g;
  }

  /* ============================================================
     城台门楼（午门 / 神武门）
     ============================================================ */
  function createGateTower(cfg) {
    const M = buildMaterials();
    const group = new THREE.Group();
    const baseW = cfg.w, baseD = cfg.d, baseH = cfg.h;

    // 城台
    const baseGeo = G.fitUV(new THREE.BoxGeometry(baseW, baseH, baseD), 0.2, baseH);
    const base = new THREE.Mesh(baseGeo, M.wall);
    base.position.y = baseH / 2;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // 城台压顶
    const cap = new THREE.Mesh(new THREE.BoxGeometry(baseW + 1.2, 0.9, baseD + 1.2), M.stone);
    cap.position.y = baseH + 0.4;
    cap.castShadow = true;
    group.add(cap);

    // 女墙
    const para = new THREE.Mesh(G.fitUV(new THREE.BoxGeometry(baseW, 1.5, baseD), 0.3, 1.5), M.wall);
    para.position.y = baseH + 1.5;
    group.add(para);
    const paraTop = new THREE.Mesh(new THREE.BoxGeometry(baseW + 0.6, 0.45, baseD + 0.6), M.ridge);
    paraTop.position.y = baseH + 2.2;
    group.add(paraTop);

    // 门洞（南面三个）
    const nDoor = cfg.doors || 3;
    for (let i = 0; i < nDoor; i++) {
      const dw = i === Math.floor(nDoor / 2) ? baseW * 0.13 : baseW * 0.1;
      const dh = baseH * 0.62;
      const x = (i - (nDoor - 1) / 2) * baseW * 0.22;
      const door = new THREE.Mesh(
        new THREE.PlaneGeometry(dw, dh),
        new THREE.MeshStandardMaterial({ color: 0x1a0f0a, roughness: 1 })
      );
      door.position.set(x, dh / 2, baseD / 2 + 0.06);
      group.add(door);
      // 门洞券脸
      const arch = new THREE.Mesh(
        new THREE.RingGeometry(dw * 0.5, dw * 0.62, 12, 1, 0, Math.PI),
        M.stone
      );
      arch.position.set(x, dh, baseD / 2 + 0.08);
      group.add(arch);
    }

    // 主楼
    const mainW = cfg.mainW || baseW * 0.6;
    const mainD = cfg.mainD || baseD * 0.55;
    const mainH = cfg.mainH || baseH * 0.85;
    const roofH = cfg.roofH || mainH * 0.62;
    const hall = createHall({
      w: mainW, d: mainD, h: mainH,
      roofH: roofH,
      style: 'hip',
      double: true,
      tiers: 0,
      stairs: false,
      eave: Math.max(1.6, mainD * 0.16),
      info: cfg.info,
      plaque: cfg.plaque
    });
    hall.position.y = baseH + 2.2;
    group.add(hall);

    // 两侧阙亭
    if (cfg.wings !== false) {
      for (const sx of [-1, 1]) {
        const wing = createHall({
          w: mainW * 0.42, d: mainD * 0.9, h: mainH * 0.72,
          roofH: roofH * 0.8,
          style: 'xieshan',
          tiers: 0, stairs: false,
          railing: false,
          eave: 1.8,
          info: null
        });
        wing.position.set(sx * (baseW * 0.36), baseH + 2.2, 0);
        group.add(wing);
      }
    }

    const totalH = baseH + 2.2 + mainH + roofH * 1.5;
    group.userData.info = cfg.info || {};
    group.userData.isBuilding = true;
    group.userData.labelY = totalH + 3.5;
    group.userData.pickRadius = Math.max(baseW, baseD) * 0.8;
    return group;
  }

  /* ============================================================
     亭（御花园 / 角楼）
     ============================================================ */
  function createPavilion(cfg) {
    const M = buildMaterials();
    const group = new THREE.Group();
    const W = cfg.w || 10, H = cfg.h || 5;
    const tierH = cfg.tierH || 1.2;

    // 台基
    const t = G.terraceGeometry(W + 3, W + 3, tierH, 1);
    addMesh(group, t.geo, M.stone, true, true);

    // 柱
    addMesh(group, G.columnRing(W, W, H, 3.4), M.column, true, true);

    // 坐凳栏
    const rail = G.railingGeometry(W - 1.4, W - 1.4, 0.55, 0.7);
    addMesh(group, G.xform(rail, { y: 0.55 }), M.column, false, false);

    // 斗拱
    addMesh(group, G.dougongRing(W, W, H - 0.5, 0.75), M.dougong, true, false);

    // 攒尖顶
    const layers = cfg.tiers || 1;
    let yy = H;
    let ww = W / 2 + 1.6;
    let hh = cfg.roofH || W * 0.62;
    for (let i = 0; i < layers; i++) {
      const rg = G.roofGeometry({
        hw: ww, hd: ww, topX: i === layers - 1 ? 0 : ww * 0.34, topZ: i === layers - 1 ? 0 : ww * 0.34,
        h: hh, curv: 1.55, lift: ww * 0.06,
        uSeg: 12, vSeg: layers === 1 ? 8 : 4,
        withSides: true,
        sideVMax: 1
      });
      const rm = new THREE.Mesh(rg, cfg.green ? M.tileGreen : M.tile);
      rm.position.y = yy;
      rm.castShadow = true;
      group.add(rm);
      // 宝顶
      if (i === layers - 1) {
        const finial = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), M.gold);
        finial.position.y = yy + hh + 0.4;
        group.add(finial);
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.6, 6), M.gold);
        rod.position.y = yy + hh + 0.9;
        group.add(rod);
      }
      yy += hh * (layers === 1 ? 0 : 0.62);
      ww *= 0.66;
      hh *= 0.72;
    }

    group.userData.info = cfg.info || {};
    group.userData.isBuilding = true;
    group.userData.labelY = yy + hh + 3;
    group.userData.pickRadius = W * 0.9;
    return group;
  }

  /* ============================================================
     廊庑（长排连房）
     ============================================================ */
  function createCorridor(cfg) {
    const M = buildMaterials();
    const group = new THREE.Group();
    const L = cfg.length, D = cfg.depth || 8, H = cfg.h || 4.6;
    const seg = Math.max(2, Math.round(L / 12));

    // 台基
    const t = G.terraceGeometry(L + 2, D + 2, cfg.tierH || 0.8, 1);
    addMesh(group, t.geo, M.stone, true, true);

    // 墙
    const bot = (cfg.tierH || 0.8);
    const wg = G.fitUV(new THREE.BoxGeometry(L, H, D - 2.2), 0.3, H);
    const wm = new THREE.Mesh(wg, M.wall);
    wm.position.y = bot + H / 2;
    wm.castShadow = true;
    wm.receiveShadow = true;
    group.add(wm);

    // 前檐柱
    const cols = [];
    for (let i = 0; i <= seg * 2; i++) {
      const x = -L / 2 + (L * i) / (seg * 2);
      cols.push(G.xform(new THREE.CylinderGeometry(0.34, 0.38, H, 8), { x, y: bot + H / 2, z: D / 2 - 0.6 }));
    }
    addMesh(group, G.merge(cols), M.column, true, true);

    // 门窗条带
    const lat = new THREE.Mesh(planeUV(L * 0.96, H * 0.68, L / 3.6, 1.2), M.lattice);
    lat.position.set(0, bot + H * 0.44, D / 2 - 1.05);
    group.add(lat);

    // 屋顶（两坡）
    const hw = L / 2 + 1.5, hd = D / 2 + 1.6;
    const rg = G.roofGeometry({
      hw: hw, hd: hd, topX: hw, topZ: 0,
      h: cfg.roofH || D * 0.62,
      curv: 1.35, lift: 0.5,
      uSeg: Math.max(12, Math.round(L / 3)),
      vSeg: 3,
      withSides: false,
      sideVMax: 0
    });
    const rm = new THREE.Mesh(rg, M.tile);
    rm.position.y = bot + H;
    rm.castShadow = true;
    rm.receiveShadow = true;
    group.add(rm);

    // 山墙
    for (const sx of [-1, 1]) {
      const g = G.gableGeometry({ hw, hd, topX: hw, h: cfg.roofH || D * 0.62, curv: 1.35, vCut: 0 });
      const gm = new THREE.Mesh(g, M.wall);
      gm.position.set(0, bot + H, 0);
      group.add(gm);
      break;
    }

    // 正脊
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(L + 3.2, 0.55, 0.7), M.ridge);
    ridge.position.y = bot + H + (cfg.roofH || D * 0.62);
    group.add(ridge);

    group.userData.isBuilding = !!cfg.info;
    group.userData.info = cfg.info || {};
    group.userData.labelY = bot + H + (cfg.roofH || D * 0.62) + 2;
    group.userData.pickRadius = Math.max(L, D) * 0.6;
    return group;
  }

  /* ============================================================
     宫墙
     ============================================================ */
  function createWall(cfg) {
    const M = buildMaterials();
    const group = new THREE.Group();
    const L = cfg.length, H = cfg.h || 7.5, T = cfg.t || 2.4;
    const w = new THREE.Mesh(G.fitUV(new THREE.BoxGeometry(L, H, T), 0.3, H), M.wall);
    w.position.y = H / 2;
    w.castShadow = true;
    w.receiveShadow = true;
    group.add(w);
    // 压顶琉璃
    const cap = new THREE.Mesh(new THREE.BoxGeometry(L + 0.5, 0.9, T + 1.1), M.tileCap);
    cap.position.y = H + 0.45;
    cap.castShadow = true;
    group.add(cap);
    const capTop = new THREE.Mesh(new THREE.BoxGeometry(L + 0.5, 0.35, T + 1.4), M.tileCap);
    capTop.position.y = H + 0.95;
    group.add(capTop);
    group.userData.isBuilding = false;
    return group;
  }

  /* ============================================================
     树（松 / 柏）—— 两种树形，供实例化混植
     ============================================================ */
  function treeGeometries() {
    // 松：挺拔，塔状分层树冠
    const pTrunk = [G.xform(new THREE.CylinderGeometry(0.3, 0.52, 5.0, 6), { y: 2.5 })];
    const pLeaf = [];
    for (let i = 0; i < 4; i++) {
      const r = 3.35 - i * 0.62;
      const h = 3.8 - i * 0.4;
      pLeaf.push(G.xform(new THREE.ConeGeometry(r, h, 9), { y: 4.9 + i * 1.95, ry: i * 0.55 }));
    }
    const pTop = [G.xform(new THREE.ConeGeometry(1.05, 2.3, 8), { y: 12.4 })];

    // 柏：细高紧凑，锥形冠
    const cTrunk = [G.xform(new THREE.CylinderGeometry(0.24, 0.4, 3.4, 6), { y: 1.7 })];
    const cLeaf = [G.xform(new THREE.ConeGeometry(1.75, 7.4, 8), { y: 5.4 })];
    const cTop = [G.xform(new THREE.ConeGeometry(0.95, 5.0, 7), { y: 9.6 })];

    return {
      pine: { trunk: G.merge(pTrunk), leaf: G.merge(pLeaf), top: G.merge(pTop) },
      cypress: { trunk: G.merge(cTrunk), leaf: G.merge(cLeaf), top: G.merge(cTop) }
    };
  }

  GG.build = {
    buildMaterials, createHall, createGateTower, createPavilion,
    createCorridor, createWall, treeGeometries, createBronzeSet,
    get MAT() { return MAT; }
  };
})();
