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
      /* 蓝琉璃：天坛祈谷坛 / 圜丘坛的正色，只有坛庙能用 */
      tileBlue: new THREE.MeshStandardMaterial({
        map: t.tileBlue, bumpMap: t.tileBump, bumpScale: 0.6, vertexColors: true,
        roughness: 0.54, metalness: 0.1
      }),
      tileEndBlue: new THREE.MeshStandardMaterial({
        color: 0x2c5f9c, roughness: 0.48, metalness: 0.14
      }),
      /* 墙帽 / 院墙压顶：不参与屋面顶点着色的绿琉璃 */
      tileCap: new THREE.MeshStandardMaterial({
        map: t.tileGreen, bumpMap: t.tileBumpGreen, bumpScale: 0.5,
        color: 0x6d8a6a, roughness: 0.72, metalness: 0.05
      }),
      /* 黄琉璃压顶：宫墙、皇城、院墙的正色。紫禁城的红墙一律压黄琉璃瓦，
         绿琉璃只给皇子居所与坛庙 */
      tileCapYellow: new THREE.MeshStandardMaterial({
        map: t.tile, bumpMap: t.tileBump, bumpScale: 0.45,
        color: 0xbda872, roughness: 0.7, metalness: 0.06
      }),
      /* 瓦当 / 滴水：檐口的一圈圆瓦头。贴图在这么小的圆面上会糊成
         一团，改用纯釉色，靠几何轮廓读出"一排瓦头" */
      tileEnd: new THREE.MeshStandardMaterial({
        color: 0xc8a545, roughness: 0.52, metalness: 0.14
      }),
      /* 绿琉璃压顶：坛庙墙帽用，不带顶点色（墙面几何没有 color 属性） */
      tileCapGreen: new THREE.MeshStandardMaterial({
        map: t.tileGreen, bumpMap: t.tileBumpGreen, bumpScale: 0.5,
        color: 0x7d9a72, roughness: 0.72, metalness: 0.05
      }),
      /* 蓝琉璃压顶：天坛内外坛墙、祈谷坛内壝、圜丘壝墙 */
      tileCapBlue: new THREE.MeshStandardMaterial({
        map: t.tileBlue, bumpMap: t.tileBump, bumpScale: 0.5,
        color: 0xa9bed6, roughness: 0.6, metalness: 0.08
      }),
      /* 灰筒瓦：胡同四合院与城墙顶。不吃顶点色，颜色差异走 instanceColor */
      tileGray: new THREE.MeshStandardMaterial({
        map: t.tileGray, bumpMap: t.tileBumpGray, bumpScale: 0.5,
        color: 0xa9a9a1, roughness: 0.9, metalness: 0.02
      }),
      /* 灰砖：四合院院墙、影壁、城门城台 */
      brick: new THREE.MeshStandardMaterial({
        map: t.brickGray, bumpMap: t.brickGray, bumpScale: 0.22,
        color: 0x938f86, roughness: 0.95, metalness: 0.0
      }),
      ridge: new THREE.MeshStandardMaterial({
        color: 0x9a7c2a, roughness: 0.62, metalness: 0.2
      }),
      /* 蓝琉璃屋脊：坛庙屋面用，不用宫城的金脊 */
      ridgeBlue: new THREE.MeshStandardMaterial({
        color: 0x244c78, roughness: 0.58, metalness: 0.16
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
        map: t.lattice, roughness: 0.75, metalness: 0.12,
        /* 窗纸透光：白天 intensity 为 0，入夜后由 Stage.setSun 拉到 0.85 */
        emissive: 0xffb35c, emissiveMap: t.lattice, emissiveIntensity: 0
      }),
      /* 次要殿宇的窗纸：同一张贴图，夜间自发光上限更低（B14 夜窗分级） */
      latticeDim: null,
      caihua: new THREE.MeshStandardMaterial({
        map: t.caihua, color: 0x9aa8ad, roughness: 0.78, metalness: 0.08
      }),
      /* 和玺彩画：三大殿与中轴门楼专用，金龙枋心 + 通体贴金 */
      caihuaHexi: new THREE.MeshStandardMaterial({
        map: t.caihuaHexi, color: 0xa9b6bb, roughness: 0.72, metalness: 0.14
      }),
      /* 殿内底景：贴在敞开的门洞上，代替一块纯黑的板 */
      interior: new THREE.MeshStandardMaterial({
        map: t.interior, roughness: 0.96, metalness: 0.02,
        emissive: 0xffffff, emissiveMap: t.interior, emissiveIntensity: 0.26
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
      water: GG.water.create()
    };
    MAT.tile.flatShading = false;
    /* latticeDim 在 lattice 之后创建：clone 共享贴图，零额外上传 */
    MAT.latticeDim = MAT.lattice.clone();
    /* 坛庙的隔扇不点灯：天坛夜里无人，窗纸不该发亮 */
    MAT.latticeOff = MAT.lattice.clone();
    MAT.latticeOff.emissiveIntensity = 0;
    Object.keys(MAT).forEach((k) => {
      if (MAT[k] && MAT[k].isMeshStandardMaterial) {
        MAT[k].envMapIntensity = 0.24;
      }
    });
    /* 琉璃釉面 / 铜活：给一点环境反射，避免全哑光（水面是自定义着色器，不走此表） */
    MAT.tile.envMapIntensity = 0.36;
    MAT.tileGreen.envMapIntensity = 0.45;
    MAT.tileBlue.envMapIntensity = 0.46;
    MAT.tileCapBlue.envMapIntensity = 0.4;
    MAT.tileEndBlue.envMapIntensity = 0.5;
    MAT.ridgeBlue.envMapIntensity = 0.45;
    MAT.tileCap.envMapIntensity = 0.38;
    MAT.tileEnd.envMapIntensity = 0.5;
    MAT.gold.envMapIntensity = 0.75;
    MAT.bronze.envMapIntensity = 0.8;
    MAT.ridge.envMapIntensity = 0.45;
    return MAT;
  }

  /* ---------- 地面 / 甬路 / 草坪的共享材质 ----------
     这些材质原先每实例 clone 一份贴图（各上传一次 GPU），七十余处院落
     就是几十张重复贴图。改为同 (kind + color) 全局共享一份，平铺密度
     写在几何 UV 上（palace.js 侧用 GG.geo.uvScale）。 */
  const groundMats = {};
  function groundMaterial(kind, color, rough) {
    const r = rough == null ? (kind === 'grass' ? 1 : 0.95) : rough;
    const key = kind + '|' + color + '|' + r;
    let m = groundMats[key];
    if (!m) {
      const t = GG.getTextures();
      m = new THREE.MeshStandardMaterial({
        map: t[kind], color: color,
        roughness: r,
        metalness: 0.0,
        envMapIntensity: 0.15
      });
      groundMats[key] = m;
    }
    return m;
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

  /* 沿任意方向摆一根方料（博风板 / 斜撑用）。
     用四元数把 +X 转到 a→b 方向，省得为每条斜边手算欧拉角。 */
  const _dir = new THREE.Vector3();
  const _mid = new THREE.Vector3();
  const _ax = new THREE.Vector3(1, 0, 0);
  function edgeBoard(group, ax, ay, az, bx, by, bz, mat, thick, width) {
    _dir.set(bx - ax, by - ay, bz - az);
    const len = _dir.length();
    if (len < 0.4) return null;
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, thick, width), mat);
    _mid.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    m.position.copy(_mid);
    m.quaternion.setFromUnitVectors(_ax, _dir.normalize());
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  }

  /* ============================================================
     核心：单座殿宇
     ============================================================ */
  function createHall(cfg) {
    const RC = GG.CONFIG.roof;
    const M = buildMaterials();
    const group = new THREE.Group();
    const W = cfg.w, D = cfg.d, H = cfg.h;
    const eave = cfg.eave == null ? Math.max(1.7, Math.min(W, D) * 0.085) : cfg.eave;
    const roofH = cfg.roofH == null ? Math.max(3.0, Math.min(W, D) * 0.38) : cfg.roofH;
    const style = cfg.style || 'hip';
    /* 屋面三色：黄（宫城）、绿（皇子居所 / 斋宫）、蓝（天坛坛庙）。
       蓝瓦的瓦当、屋脊也必须是蓝的，混用金活会把坛庙读成宫殿。 */
    const tileMat = cfg.blue ? M.tileBlue : cfg.green ? M.tileGreen : M.tile;
    const ridgeMat = cfg.blue ? M.ridgeBlue : M.ridge;
    const endMat = cfg.blue ? M.tileEndBlue : M.tileEnd;
    const tierN = cfg.tiers == null ? 1 : cfg.tiers;
    const tierH = cfg.tierH == null ? Math.max(1.4, H * 0.16) : cfg.tierH;
    const dbl = !!cfg.double;

    let y0 = 0;

    /* 檐口细节只在需要近看的殿宇上开启（目前是太和殿）。
       两组屋面各加一圈瓦当、滴水和檐椽，屋檐才有厚度。 */
    const addEaveDetail = (baseY, hw, hd, lift, liftExp) => {
      if (!cfg.roofDetail) return;
      const e = G.eaveEdgeGeometry({ hw, hd, lift, liftExp });
      if (!e) return;
      if (e.tiles) {
        const m = new THREE.Mesh(e.tiles, endMat);
        m.position.y = baseY;
        m.castShadow = true;
        m.receiveShadow = true;
        group.add(m);
      }
      if (e.rafters) {
        const m = new THREE.Mesh(e.rafters, M.column);
        m.position.y = baseY;
        m.castShadow = true;
        group.add(m);
      }
      if (e.fascia) {
        const m = new THREE.Mesh(e.fascia, M.rafter);
        m.position.y = baseY;
        m.receiveShadow = true;
        group.add(m);
      }
    };

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
    const H1 = cfg.lowerH != null ? cfg.lowerH : (dbl ? H * 0.60 : H);
    const H2 = cfg.upperH != null ? cfg.upperH : H - H1;
    const upperScale = cfg.upperScale == null ? 0.72 : cfg.upperScale;
    const W2 = dbl ? W * upperScale : W;
    const D2 = dbl ? D * upperScale : D;

    /* 面阔间数与明间洞口：太和殿十一间、保和殿九间、中和殿五间。
       「明间」取正中三间，是殿内可见时挖空的洞口。 */
    const BAYS = cfg.bays || 11;
    function openingDims(bw, bh, bd) {
      const iw = bw - 1.4;
      const id = bd - 1.4 - (cfg.porch || 0) * 2;
      const fw = iw - 0.25;
      const bayW = fw / BAYS;
      const doorH = Math.min(7.6, bh * 0.69);
      return { iw, id, fw, bayW, openW: bayW * 3, doorH };
    }

    /* 太和殿正立面：十一间通面阔的隔扇。旧版是一整张菱花贴图加
       一块黑门洞，远看像贴了壁纸；这里有真正的门扇分格——
       每间四扇，上段三交六椀菱花，下段红裙板，明间三门敞开。 */
    function taiheFacade(bw, bd, bh, baseY) {
      const od = openingDims(bw, bh, bd);
      const iw = od.iw;
      const id = od.id;
      const zf = id / 2 + 0.14;
      const fw = od.fw;
      const N = BAYS;
      const bayW = od.bayW;
      const doorH = od.doorH;
      const mid = Math.floor(N / 2);
      const transomH = Math.min(1.2, bh * 0.11);
      const beamH = Math.max(0.7, bh * 0.085);
      const foot = 0.22;
      const leafH = doorH - foot;
      const split = foot + leafH * 0.64;
      const frames = [], panels = [], lattices = [], golds = [], stones = [], studs = [];

      // 间柱：从地面一直到横披窗顶
      for (let i = 0; i <= N; i++) {
        frames.push(G.box(0.16, doorH + transomH + 0.16, 0.2, {
          x: -fw / 2 + i * bayW, y: baseY + (doorH + transomH) / 2, z: zf
        }));
      }

      for (let i = 0; i < N; i++) {
        const cx = -fw / 2 + (i + 0.5) * bayW;
        // 只有开了殿内（interior）的殿宇才把明间空出来，其余通铺隔扇
        const open = cfg.interior && i >= mid - 1 && i <= mid + 1;

        // 下槛 / 上槛
        frames.push(G.box(bayW, 0.1, 0.16, { x: cx, y: baseY + doorH + 0.05, z: zf }));
        frames.push(G.box(bayW, 0.12, 0.2, { x: cx, y: baseY + foot / 2, z: zf }));

        if (open) {
          // 明间三门：只留两侧门框与贴墙的门扇边，中间让给殿内底景
          for (const sx of [-1, 1]) {
            frames.push(G.box(0.34, leafH, 0.12, {
              x: cx + sx * (bayW / 2 - 0.24), y: baseY + foot + leafH / 2, z: zf + 0.02
            }));
            golds.push(G.box(0.06, leafH * 0.8, 0.02, {
              x: cx + sx * (bayW / 2 - 0.08), y: baseY + foot + leafH / 2, z: zf + 0.09
            }));
          }
          stones.push(G.box(bayW - 0.4, 0.2, 0.5, { x: cx, y: baseY + 0.1, z: zf + 0.16 }));
        } else {
          const leafW = (bayW - 0.26) / 4;
          for (let j = 0; j < 4; j++) {
            const lx = cx - bayW / 2 + 0.13 + leafW * (j + 0.5);
            // 门扇边梃
            for (const sx of [-1, 1]) {
              frames.push(G.box(0.06, leafH, 0.1, {
                x: lx + sx * (leafW / 2 - 0.03), y: baseY + foot + leafH / 2, z: zf + 0.015
              }));
            }
            // 下裙板、中槛、上抹头
            panels.push(G.box(leafW - 0.1, split - foot - 0.05, 0.055, {
              x: lx, y: baseY + foot + (split - foot) / 2, z: zf + 0.02
            }));
            frames.push(G.box(leafW, 0.07, 0.1, { x: lx, y: baseY + split, z: zf + 0.02 }));
            frames.push(G.box(leafW, 0.07, 0.1, {
              x: lx, y: baseY + foot + 0.035, z: zf + 0.02
            }));
            frames.push(G.box(leafW, 0.07, 0.1, {
              x: lx, y: baseY + doorH - 0.035, z: zf + 0.02
            }));
            // 上段菱花
            const lw = leafW - 0.14, lh = doorH - split - 0.08;
            lattices.push(G.xform(
              planeUV(lw, lh, lw / 3.3, lh / 3.3),
              { x: lx, y: baseY + split + 0.04 + lh / 2, z: zf + 0.06 }
            ));
            // 裙板面叶
            golds.push(G.box(0.14, 0.2, 0.025, {
              x: lx, y: baseY + foot + (split - foot) * 0.45, z: zf + 0.06
            }));
            // 门钉：裙板上两排小圆钉。贴图平面读不出这点立体，
            // 近看门扇才不是一张印了花纹的纸。
            const py0 = baseY + foot + (split - foot) * 0.24;
            for (let ry = 0; ry < 2; ry++) {
              for (let rx = 0; rx < 3; rx++) {
                studs.push(G.xform(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 5), {
                  x: lx + (rx - 1) * leafW * 0.26,
                  y: py0 + ry * 0.32, z: zf + 0.07, rx: Math.PI / 2
                }));
              }
            }
          }
        }

        // 横披窗：门顶到额枋之间的一排固定窗
        const tY = baseY + doorH + 0.1;
        lattices.push(G.xform(
          planeUV(bayW - 0.24, transomH - 0.08, (bayW - 0.24) / 3.3, (transomH - 0.08) / 3.3),
          { x: cx, y: tY + (transomH - 0.08) / 2, z: zf + 0.05 }
        ));
        frames.push(G.box(bayW, 0.06, 0.1, { x: cx, y: tY + transomH - 0.08, z: zf + 0.02 }));
      }

      // 明间三门的殿内底景：开了殿内（interior）就不铺这幅贴图，
      // 让位给墙后真实的金柱与宝座；其余情况仍用一幅画填满洞口。
      const openW = bayW * 3;
      if (!cfg.interior) {
        const dk = new THREE.Mesh(
          planeUV(openW - 0.3, doorH - 0.2, 1, 1),
          M.interior
        );
        dk.position.set(0, baseY + (doorH - 0.2) / 2 + 0.08, zf - 0.015);
        group.add(dk);
      }

      // 走马板：横披窗以上、额枋以下的整片红板
      const wy = baseY + doorH + transomH + 0.12;
      const wh = Math.max(0.2, baseY + bh - beamH - 0.06 - wy);
      panels.push(G.box(fw, wh, 0.07, { x: 0, y: wy + wh / 2, z: zf - 0.02 }));

      // 阶条石门槛
      stones.push(G.box(fw + 0.2, 0.18, 0.46, { x: 0, y: baseY + 0.09, z: zf + 0.14 }));

      const add = (arr, mat, cast, recv) => {
        if (!arr.length) return;
        const m = new THREE.Mesh(G.merge(arr), mat);
        m.castShadow = cast !== false;
        m.receiveShadow = recv !== false;
        group.add(m);
      };
      add(frames, M.column, true, true);
      add(panels, M.wallPlain, true, true);
      add(lattices, M.lattice, true, true);
      add(golds, M.gold, false, false);
      add(studs, M.gold, false, false);
      add(stones, M.stone, true, true);
    }

    /* ---------- 屋身（可叠两层） ---------- */
    function buildBody(bw, bd, bh, baseY, isLower) {
      /* 檐廊：隔扇退到檐柱之后。太和殿的檐柱到隔扇有 2~3 m 的廊，
         站在广场上看，先是一排柱子，柱子后面才是隔扇 —— 这段进深
         是立面节奏的来源。cfg.porch 只作用于前后两面（左右是山墙）。 */
      const porch = cfg.porch == null ? 0 : cfg.porch;   // 0 = 原样，不额外退
      const iw = bw - 1.4, id = bd - 1.4 - porch * 2;
      const od = openingDims(bw, bh, bd);
      /* 殿内可见：只有下层、开了 interior 且用隔扇立面的殿宇，
         前檐正中三间挖空，墙退到 6 m 之后，金柱与宝座立在洞里。 */
      const openRoom = !!(isLower && cfg.interior && cfg.facade === 'taihe');

      if (openRoom) {
        buildOpenWall(iw, bh, id, baseY, od);
      } else {
        const wm = new THREE.Mesh(
          G.fitUV(new THREE.BoxGeometry(iw, bh, id), 0.3, bh),
          [M.wall, M.wall, M.wallPlain, M.wallPlain, M.wall, M.wall]
        );
        wm.position.y = baseY + bh / 2;
        wm.castShadow = true;
        wm.receiveShadow = true;
        group.add(wm);
      }

      const latH = Math.max(2.0, bh * 0.68);
      const LM = cfg.blue ? M.latticeOff : (cfg.dimWin ? M.latticeDim : M.lattice);
      // 正面交给 taiheFacade 的隔扇时，这一整片菱花贴图就不再铺
      if (!openRoom) {
        const lat = new THREE.Mesh(
          planeUV(iw * 0.93, latH, (iw * 0.93) / 3.4, latH / 3.4),
          LM
        );
        lat.position.set(0, baseY + latH / 2 + bh * 0.02, id / 2 + 0.07);
        lat.receiveShadow = true;
        group.add(lat);
      }
      const latB = new THREE.Mesh(
        planeUV(iw * 0.93, latH, (iw * 0.93) / 3.4, latH / 3.4), LM
      );
      latB.rotation.y = Math.PI;
      latB.position.z = -id / 2 - 0.07;
      group.add(latB);

      if (!openRoom) {
        // 中央三间门洞（凹进的暗部，拉开层次）
        const doorW = Math.min(iw * 0.34, 15);
        const doorH = latH * 0.94;
        const dkMat = cfg.interior
          ? M.interior
          : new THREE.MeshStandardMaterial({ color: 0x2a0f0a, roughness: 0.96 });
        const dk = new THREE.Mesh(new THREE.PlaneGeometry(doorW, doorH), dkMat);
        dk.position.set(0, baseY + doorH / 2 + bh * 0.02, id / 2 + 0.09);
        group.add(dk);
      }
      // 门槛与门框
      const sillW = openRoom ? od.openW : Math.min(iw * 0.34, 15);
      const sill = new THREE.Mesh(new THREE.BoxGeometry(sillW + 0.6, 0.3, 0.5), M.stone);
      sill.position.set(0, baseY + 0.15, id / 2 + 0.2);
      group.add(sill);

      // 太和殿：用真实分格的隔扇盖住整片前檐
      if (cfg.facade === 'taihe' && isLower) taiheFacade(bw, bd, bh, baseY);

      addMesh(group, G.columnRing(bw, bd, bh, cfg.colStep || 5.2), M.column, true, true);
      addMesh(group, G.columnBases(bw, bd, cfg.colStep || 5.2), M.stone, true, true);

      const beamH = Math.max(0.7, bh * 0.085);
      const beamMat = cfg.hexi ? M.caihuaHexi : M.caihua;
      const beam = new THREE.Mesh(planeUV(bw + 0.1, beamH, bw / 3.2, 1), beamMat);
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
        cfg.dougongDetail
          ? G.dougongRingDetailed(bw, bd, baseY + bh - beamH - 0.15, Math.max(0.62, bh * 0.075), 1.12)
          : G.dougongRing(bw, bd, baseY + bh - beamH - 0.15, Math.max(0.55, bh * 0.07)),
        M.dougong, true, false
      );

      /* 雀替：柱头与额枋之间的过渡小木件。没有它，柱子直接顶到
         一条平直的额枋上，近看是"积木";有了这两块小托，柱头才收得住。 */
      if (cfg.dougongDetail) {
        const qp = [];
        const nxq = Math.max(2, Math.round(bw / (cfg.colStep || 5.2)));
        for (let i = 0; i <= nxq; i++) {
          const x = -bw / 2 + (bw * i) / nxq;
          for (const sz of [-1, 1]) {
            qp.push(G.box(1.05, 0.18, 0.34, { x, y: baseY + bh - beamH - 0.12, z: sz * (bd / 2 + 0.02) }));
            qp.push(G.box(0.42, 0.36, 0.28, { x: x + 0.28, y: baseY + bh - beamH - 0.32, z: sz * (bd / 2 + 0.02) }));
            qp.push(G.box(0.42, 0.36, 0.28, { x: x - 0.28, y: baseY + bh - beamH - 0.32, z: sz * (bd / 2 + 0.02) }));
          }
        }
        addMesh(group, G.merge(qp), M.column, true, false);
      }

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

    /* 殿内进深：前檐正中三间挖空之后，墙退到 6 m 之后 */
    const ROOM_D = 6;

    /* 前檐正中三间挖空：后段墙身后退，前脸只剩左右两垛与明间上方的
       走马板，洞口后面是真正的殿内进深，而不是一块贴了画的平面。 */
    function buildOpenWall(iw, bh, id, baseY, od) {
      const ow = od.openW, dh = od.doorH;
      const frontCz = id / 2 - ROOM_D / 2;
      const sideW = iw / 2 - ow / 2;
      const lintelH = bh - dh;
      const pieces = [];
      // 后段墙身：前脸退到 id/2 - ROOM_D
      pieces.push(G.fitUV(new THREE.BoxGeometry(iw, bh, id - ROOM_D), 0.3, bh)
        .translate(0, baseY + bh / 2, -ROOM_D / 2));
      // 前脸左右两垛
      for (const sx of [-1, 1]) {
        pieces.push(G.fitUV(new THREE.BoxGeometry(sideW, bh, ROOM_D), 0.3, bh)
          .translate(sx * (ow / 2 + sideW / 2), baseY + bh / 2, frontCz));
      }
      // 明间上方的走马板
      pieces.push(G.fitUV(new THREE.BoxGeometry(ow, lintelH, ROOM_D), 0.3, bh)
        .translate(0, baseY + dh + lintelH / 2, frontCz));
      const wm = new THREE.Mesh(G.merge(pieces), M.wall);
      wm.castShadow = true;
      wm.receiveShadow = true;
      group.add(wm);

      buildInterior(bh, id, baseY, od, id / 2 - ROOM_D);
    }

    /* 殿内：金砖地面 + 后壁 + 两根蟠龙金柱 + 屏风宝座。
       都在 6 m 进深里；从广场穿过明间望进去能看到层次与纵深。
       井内不见天光，靠一点自发光托住暗部，不然是一团纯黑。 */
    function buildInterior(bh, id, baseY, od, backZ) {
      const ow = od.openW, dh = od.doorH;
      const zMid = id / 2 - ROOM_D / 2;
      const roomMat = new THREE.MeshStandardMaterial({
        color: 0x1c0d06, roughness: 0.96, metalness: 0.0,
        emissive: 0x120a04, emissiveIntensity: 0.7, envMapIntensity: 0.2
      });
      /* 殿内是暗的：金柱与宝座靠一点自发光 + 低反射的金色：
         高金属度 + 默认环境强度会把它们照成一块发亮的米色板。 */
      const gilt = new THREE.MeshStandardMaterial({
        color: 0x8a6a1e, roughness: 0.5, metalness: 0.35,
        emissive: 0x1c1205, emissiveIntensity: 0.5, envMapIntensity: 0.3
      });

      // 后壁（暗）、天花、金砖地面
      const shell = [
        G.box(ow + 0.6, dh, 0.3, { y: baseY + dh / 2, z: backZ + 0.15 }),
        G.box(ow + 0.6, 0.3, ROOM_D, { y: baseY + dh - 0.15, z: zMid }),
        G.box(ow + 0.6, 0.3, ROOM_D, { y: baseY - 0.15, z: zMid })
      ];
      const sm = new THREE.Mesh(G.merge(shell), roomMat);
      sm.receiveShadow = true;
      group.add(sm);

      // 屏风 + 宝座的尺寸先定下来，金柱的位置围着它们排
      const sw = Math.min(ow * 0.36, 5.6);
      const sh = dh * 0.46;
      const tw = sw * 0.44;
      const throneZ = backZ + 2.3;

      // 两根蟠龙金柱：立在宝座两侧，从广场望进去正好框住洞口
      const colX = sw * 0.5 + 1.0;
      const colMat = gilt.clone();
      colMat.emissiveIntensity = 0.95;   // 殿内最暗处，让柱子还认得出是金色
      const cols = [];
      for (const sx of [-1, 1]) {
        cols.push(G.xform(new THREE.CylinderGeometry(0.44, 0.5, dh, 12), {
          x: sx * colX, y: baseY + dh / 2, z: backZ + 1.8
        }));
        cols.push(G.xform(new THREE.CylinderGeometry(0.64, 0.64, 0.44, 12), {
          x: sx * colX, y: baseY + 0.22, z: backZ + 1.8
        }));
      }
      const cm = new THREE.Mesh(G.merge(cols), colMat);
      cm.castShadow = true;
      group.add(cm);

      const sy = baseY + dh * 0.34;
      // 屏风：暗红屏心 + 金框；宝座立在屏风之前
      const panel = new THREE.Mesh(
        G.box(sw, sh, 0.24, { y: sy + sh / 2, z: backZ + 0.7 }), M.wallPlain
      );
      panel.receiveShadow = true;
      group.add(panel);
      const t = [
        G.box(sw + 0.5, 0.2, 0.42, { y: sy + sh + 0.1, z: backZ + 0.72 }),
        G.box(sw + 0.5, 0.2, 0.42, { y: sy - 0.1, z: backZ + 0.72 }),
        G.box(0.26, sh + 0.2, 0.42, { x: -sw / 2 - 0.13, y: sy + sh / 2, z: backZ + 0.72 }),
        G.box(0.26, sh + 0.2, 0.42, { x: sw / 2 + 0.13, y: sy + sh / 2, z: backZ + 0.72 }),
        G.box(tw * 1.5, 0.9, tw * 1.05, { y: baseY + 0.45, z: throneZ }),
        G.box(tw, 0.32, tw * 0.85, { y: baseY + 1.06, z: throneZ }),
        G.box(tw * 0.92, 1.1, 0.24, { y: baseY + 1.62, z: throneZ - tw * 0.38 })
      ];
      for (const sx of [-1, 1]) {
        t.push(G.box(0.24, 0.48, tw * 0.62, {
          x: sx * tw * 0.42, y: baseY + 1.28, z: throneZ
        }));
      }
      const tm = new THREE.Mesh(G.merge(t), gilt);
      tm.castShadow = true;
      tm.receiveShadow = true;
      group.add(tm);
    }

    buildBody(W, D, H1, bodyY, true);

    /* 筒瓦立体起伏：起伏周期必须与瓦垄贴图一致（tileCanvas 是 8 垄 / 4.2 m，
       即 0.525 m 一垄），否则几何波纹和贴图纹路互相打架，近看是摩尔纹。
       只对开了 roofDetail 的殿宇生效，其余屋面仍是平面贴图，基线不动。 */
    const TILE_PITCH = 4.2 / 8;
    const reliefOpts = (rhw, rhd) => (cfg.roofDetail ? {
      tileRelief: { pitch: TILE_PITCH, amp: 0.085, taper: 0.42 },
      uSeg: Math.min(360, Math.round((2 * rhw) / TILE_PITCH * 2.0)),
      sideUSeg: Math.min(220, Math.round((2 * rhd) / TILE_PITCH * 2.0))
    } : {});

    let roofBase = bodyY + H1;
    let roofW = W, roofD = D, eaveR = eave;

    /* ---------- 腰檐 + 上层屋身 ---------- */
    if (dbl) {
      const hwS = W / 2 + eave * 1.15;
      const hdS = D / 2 + eave * 1.15;
      /* 腰檐高度不能超过上层屋身：超过之后腰檐的围脊顶到上层屋面里，
         两重檐并成一层，乾清宫这类中等体量的殿就看不出重檐了。
         压到上层屋身的 78%，檐间才留得出一线墙与斗拱。 */
      const skirtH = cfg.skirtH != null
        ? cfg.skirtH
        : Math.min(Math.max(2.2, roofH * 0.42), H2 * 0.78);
      const skirtLift = Math.min(hwS, hdS) * 0.042;
      const sg = G.roofGeometry(Object.assign({
        hw: hwS, hd: hdS,
        topX: W2 / 2 - 0.6, topZ: D2 / 2 - 0.6,
        h: skirtH, curv: 1.08,
        lift: skirtLift, liftExp: 3.0,
        uSeg: Math.max(10, Math.round(hwS * 0.5)), vSeg: 4,
        withSides: true, sideVMax: 1
      }, reliefOpts(hwS, hdS)));
      const sm = new THREE.Mesh(sg, tileMat);
      sm.position.y = roofBase;
      sm.castShadow = true;
      sm.receiveShadow = true;
      group.add(sm);
      addEaveDetail(roofBase, hwS, hdS, skirtLift, 3.0);

      const raf1 = new THREE.Mesh(new THREE.BoxGeometry(hwS * 2.02, 0.46, hdS * 2.02), M.rafter);
      raf1.position.y = roofBase - 0.22;
      group.add(raf1);

      // 腰檐正脊（围脊）
      const rim = new THREE.Mesh(
        new THREE.BoxGeometry(W2 + 1.2, 0.7, D2 + 1.2), ridgeMat
      );
      rim.position.y = roofBase + skirtH - (cfg.upperOnSkirt ? 0.34 : skirtH * 0.08);
      group.add(rim);

      /* upperOnSkirt：上层屋身坐在腰檐围脊之上，而不是从下檐高度
         直接长出来。旧写法把 4.8 m 高的腰檐盖在 6.2 m 的屋身上，
         只露 1.4 m 墙，太和殿看起来像两顶屋顶叠在一起。 */
      const upperBase = cfg.upperOnSkirt ? roofBase + skirtH : roofBase;
      buildBody(W2, D2, H2, upperBase, false);
      roofBase = upperBase + H2;
      roofW = W2;
      roofD = D2;
      eaveR = eave * 0.9;
    }

    /* ---------- 屋顶 ---------- */
    const hw = roofW / 2 + eaveR;
    const hd = roofD / 2 + eaveR;
    let topX = 0, topZ = 0, sideVMax = 1, withSides = true;
    if (style === 'hip') {
      topX = Math.max(hw * 0.05, hw - hd * RC.hipTopFactor);
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
    const lift = Math.min(hw, hd) * RC.liftRatio;
    const rg = G.roofGeometry(Object.assign({
      hw: hw, hd: hd, topX: topX, topZ: topZ, h: roofH,
      curv: RC.curv, lift: lift,
      uSeg: Math.max(12, Math.round(hw * 0.6)),
      vSeg: 12, sideVMax: sideVMax, withSides: withSides
    }, reliefOpts(hw, hd)));
    const rm = new THREE.Mesh(rg, tileMat);
    rm.position.y = roofBase;
    rm.castShadow = true;
    rm.receiveShadow = true;
    group.add(rm);
    addEaveDetail(roofBase, hw, hd, lift, 4.6);

    if (style === 'xieshan' || style === 'gable') {
      const vCut = style === 'xieshan' ? 0.6 : 0;
      const gg = G.gableGeometry({
        hw: hw, hd: hd, topX: topX, h: roofH, curv: RC.curv, vCut: vCut
      });
      const gm = new THREE.Mesh(gg, M.wall);
      gm.position.y = roofBase;
      gm.castShadow = true;
      group.add(gm);

      /* 博风板：沿山花两条斜边的一道木板。没有它，山花与屋面
         直接相接，近看是一道生硬的折线；有了它，屋顶才有"收边"。 */
      const yCut = roofH * Math.pow(vCut, RC.curv);
      const xCut = hw + (topX - hw) * vCut;
      const zCut = hd * (1 - vCut);
      const bw = Math.max(0.3, roofH * 0.055);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          edgeBoard(
            group,
            sx * (xCut + 0.1), roofBase + yCut, sz * zCut,
            sx * (topX + 0.1), roofBase + roofH, 0,
            M.column, bw, bw * 1.6
          );
        }
      }
      /* 悬鱼：山花顶尖一枚小垂饰 */
      const xy = new THREE.Mesh(new THREE.ConeGeometry(bw * 0.9, bw * 2.2, 6), M.gold);
      xy.position.set(0, roofBase + roofH - bw * 0.4, 0);
      xy.rotation.x = Math.PI;
      group.add(xy);
    }

    const ridges = G.ridgeGeometry({
      hw: hw, hd: hd, topX: topX, topZ: topZ, h: roofH, lift: lift, curv: RC.curv,
      beasts: cfg.beasts != null ? cfg.beasts : (cfg.hexi ? 7 : (dbl ? 5 : 3))
    });
    const rm2 = new THREE.Mesh(ridges, ridgeMat);
    rm2.position.y = roofBase;
    rm2.castShadow = true;
    group.add(rm2);

    /* 攒尖顶宝顶：中和殿 / 交泰殿这类方亭式殿宇，四脊交汇处
       原先只有一个尖角，加露盘 + 宝珠才收得住 */
    if (style === 'pyramid') {
      const pan = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.72, 0.46, 12), ridgeMat
      );
      pan.position.y = roofBase + roofH + 0.16;
      pan.castShadow = true;
      group.add(pan);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), M.gold);
      orb.position.y = roofBase + roofH + 0.92;
      orb.castShadow = true;
      group.add(orb);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 10), M.gold);
      tip.position.y = roofBase + roofH + 1.62;
      group.add(tip);
    }

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
    let pedestal = null;

    if (kind === 'vat') {
      // 太平缸：鼓腹 + 口沿 + 底座
      parts.push(G.xform(new THREE.CylinderGeometry(0.72, 0.86, 1.15, 16), { y: 0.78 }));
      parts.push(G.xform(new THREE.TorusGeometry(0.74, 0.09, 8, 18), { y: 1.35, rx: Math.PI / 2 }));
      parts.push(G.xform(new THREE.CylinderGeometry(0.5, 0.62, 0.24, 14), { y: 0.12 }));
      parts.push(G.xform(new THREE.TorusGeometry(0.86, 0.08, 6, 16), { y: 0.95, rx: Math.PI / 2 }));
    } else if (kind === 'crane') {
      /* 铜鹤：石座 + 细腿 + 椭身 + 折翼 + 长颈 + 首。
         旧版只有一根直颈和一个球头，近看像一只铜鹅。 */
      pedestal = new THREE.Mesh(G.box(1.85, 0.5, 1.5, { y: 0.25 }), M.stone);
      const o = 0.5;
      parts.push(G.xform(new THREE.CylinderGeometry(0.06, 0.085, 1.15, 6), { x: -0.17, y: o + 0.575 }));
      parts.push(G.xform(new THREE.CylinderGeometry(0.06, 0.085, 1.15, 6), { x: 0.17, y: o + 0.575 }));
      parts.push(G.xform(new THREE.SphereGeometry(0.46, 12, 9), {
        y: o + 1.55, sx: 1.55, sy: 0.9, sz: 0.92
      }));
      // 折翼：贴在身体两侧的两片薄椭球
      for (const sz of [-1, 1]) {
        parts.push(G.xform(new THREE.SphereGeometry(0.44, 10, 8), {
          y: o + 1.6, z: sz * 0.31, sx: 1.15, sy: 0.55, sz: 0.34
        }));
      }
      // 尾羽
      parts.push(G.xform(new THREE.ConeGeometry(0.24, 0.9, 6), {
        x: 0.72, y: o + 1.62, rz: -Math.PI / 2, sx: 0.7, sy: 1, sz: 0.7
      }));
      // 颈：一条向前上方弯的管
      const neck = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.12, o + 1.72, 0),
        new THREE.Vector3(-0.28, o + 2.18, 0),
        new THREE.Vector3(-0.36, o + 2.55, 0),
        new THREE.Vector3(-0.48, o + 2.8, 0)
      ]);
      parts.push(new THREE.TubeGeometry(neck, 8, 0.105, 6, false));
      parts.push(G.xform(new THREE.SphereGeometry(0.2, 9, 7), {
        x: -0.5, y: o + 2.86, sx: 1.25, sy: 0.95
      }));
      // 喙与冠
      parts.push(G.xform(new THREE.ConeGeometry(0.075, 0.52, 6), {
        x: -0.82, y: o + 2.82, rz: Math.PI / 2
      }));
      parts.push(G.xform(new THREE.ConeGeometry(0.06, 0.22, 5), {
        x: -0.44, y: o + 3.05, rx: -0.5
      }));
    } else if (kind === 'ding') {
      /* 铜鼎：石座 + 三足 + 鼓腹 + 双耳 + 盖钮。 */
      pedestal = new THREE.Mesh(G.box(0.95, 0.24, 0.95, { y: 0.12 }), M.stone);
      const o = 0.24;
      parts.push(G.xform(new THREE.CylinderGeometry(0.56, 0.44, 0.86, 14), { y: o + 0.92 }));
      parts.push(G.xform(new THREE.SphereGeometry(0.6, 14, 10), { y: o + 0.7, sy: 0.68 }));
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.5;
        parts.push(G.xform(new THREE.CylinderGeometry(0.1, 0.07, 0.5, 6), {
          x: Math.cos(a) * 0.3, y: o + 0.26, z: Math.sin(a) * 0.3
        }));
      }
      for (const sx of [-1, 1]) {
        parts.push(G.xform(new THREE.TorusGeometry(0.18, 0.05, 6, 12), {
          x: sx * 0.56, y: o + 1.24, rx: Math.PI / 2
        }));
      }
      parts.push(G.xform(new THREE.TorusGeometry(0.5, 0.05, 6, 14), {
        y: o + 1.3, rx: Math.PI / 2
      }));
      parts.push(G.xform(new THREE.ConeGeometry(0.38, 0.32, 12), { y: o + 1.44 }));
      parts.push(G.xform(new THREE.SphereGeometry(0.09, 8, 6), { y: o + 1.64 }));
    } else if (kind === 'turtle') {
      /* 铜龟：石座 + 龟背 + 龟甲纹 + 头 + 四足 + 尾。 */
      pedestal = new THREE.Mesh(G.box(1.95, 0.45, 1.7, { y: 0.225 }), M.stone);
      const o = 0.45;
      parts.push(G.xform(new THREE.SphereGeometry(0.68, 16, 11), {
        y: o + 0.65, sy: 0.58, sz: 1.2
      }));
      parts.push(G.xform(new THREE.TorusGeometry(0.68, 0.065, 6, 20), {
        y: o + 0.62, rx: Math.PI / 2, sz: 1.2
      }));
      // 龟甲：六边形甲片
      const shields = [[0, 0], [0.3, 0.32], [-0.3, 0.32], [0.3, -0.32], [-0.3, -0.32], [0, 0.56], [0, -0.56]];
      for (const [sx, sz] of shields) {
        const y = o + 0.88 - Math.abs(sx) * 0.08 - Math.abs(sz) * 0.04;
        parts.push(G.xform(new THREE.CylinderGeometry(0.13, 0.15, 0.05, 6), {
          x: sx, y: y, z: sz * 1.1, ry: 0.4
        }));
      }
      // 头颈
      parts.push(G.xform(new THREE.CylinderGeometry(0.15, 0.19, 0.5, 7), {
        y: o + 0.68, z: 0.82, rx: Math.PI / 2.6
      }));
      parts.push(G.xform(new THREE.SphereGeometry(0.24, 10, 7), {
        y: o + 0.78, z: 1.05, sx: 0.9, sy: 0.75, sz: 1.25
      }));
      for (const sx of [-1, 1]) {
        parts.push(G.xform(new THREE.SphereGeometry(0.035, 6, 5), {
          x: sx * 0.12, y: o + 0.86, z: 1.15
        }));
      }
      for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
        parts.push(G.xform(new THREE.CylinderGeometry(0.12, 0.1, 0.36, 6), {
          x: sx * 0.44, y: o + 0.2, z: sz * 0.46
        }));
      }
      parts.push(G.xform(new THREE.ConeGeometry(0.09, 0.34, 5), {
        y: o + 0.42, z: -0.94, rx: -Math.PI / 2
      }));
    } else if (kind === 'jialiang') {
      /* 嘉量：石座 + 方形斛身 + 屋顶状盖。与日晷东西对峙 */
      parts.push(G.xform(new THREE.BoxGeometry(1.15, 0.72, 1.15), { y: 0.36 }));
      parts.push(G.xform(new THREE.BoxGeometry(0.82, 0.82, 0.82), { y: 1.13 }));
      parts.push(G.xform(new THREE.ConeGeometry(0.74, 0.52, 4), { y: 1.8, ry: Math.PI / 4 }));
      parts.push(G.xform(new THREE.SphereGeometry(0.1, 8, 6), { y: 2.1 }));
    } else {
      /* 日晷：石座 + 斜盘 + 晷针 */
      parts.push(G.xform(new THREE.BoxGeometry(1.5, 1.2, 1.5), { y: 0.6 }));
      parts.push(G.xform(new THREE.CylinderGeometry(0.9, 0.9, 0.16, 20), { y: 1.45, rx: -0.62 }));
      parts.push(G.xform(new THREE.CylinderGeometry(0.045, 0.045, 1.1, 5), { y: 1.75, rx: 0.42 }));
    }

    const mesh = new THREE.Mesh(G.merge(parts), kind === 'vat' ? M.bronze : M.bronze);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    if (pedestal) {
      pedestal.castShadow = true;
      pedestal.receiveShadow = true;
      g.add(pedestal);
    }
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
    /* 宫城城门是红城台，京师城门是灰砖城台：由调用方指定 */
    const baseMat = cfg.baseMat || M.wall;

    // 城台
    const baseGeo = G.fitUV(new THREE.BoxGeometry(baseW, baseH, baseD), 0.2, baseH);
    const base = new THREE.Mesh(baseGeo, baseMat);
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
    const para = new THREE.Mesh(G.fitUV(new THREE.BoxGeometry(baseW, 1.5, baseD), 0.3, 1.5), baseMat);
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
      style: cfg.style || 'hip',
      double: true,
      tiers: 0,
      stairs: false,
      eave: Math.max(1.6, mainD * 0.16),
      info: cfg.info,
      plaque: cfg.plaque,
      dimWin: cfg.dimWin
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
    const RC = GG.CONFIG.roof;
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
        h: hh, curv: RC.curv, lift: ww * 0.06,
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
    const latMat = cfg.noGlow ? M.latticeOff : (cfg.dimWin ? M.latticeDim : M.lattice);
    const lat = new THREE.Mesh(planeUV(L * 0.96, H * 0.68, L / 3.6, 1.2), latMat);
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
    const rm = new THREE.Mesh(rg, cfg.tileMat || M.tile);
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
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(L + 3.2, 0.55, 0.7), cfg.ridgeMat || M.ridge);
    ridge.position.y = bot + H + (cfg.roofH || D * 0.62);
    group.add(ridge);

    group.userData.isBuilding = !!cfg.info;
    group.userData.info = cfg.info || {};
    group.userData.labelY = bot + H + (cfg.roofH || D * 0.62) + 2;
    group.userData.pickRadius = Math.max(L, D) * 0.6;
    return group;
  }

  /* ============================================================
     宫墙（可带雉堞：城墙用垛口，院墙用瓦顶压顶）
     ============================================================ */
  function createWall(cfg) {
    const M = buildMaterials();
    const group = new THREE.Group();
    const L = cfg.length, H = cfg.h || 7.5, T = cfg.t || 2.4;
    /* 京师城墙是灰砖，皇城与院墙是红墙：材质由调用方传入，
       不再写死 M.wall。压顶同理，灰墙配石帽、红墙配琉璃。 */
    const bodyMat = cfg.mat || M.wall;
    const capMat = cfg.capMat || M.tileCapYellow;
    const ridgeMat = cfg.ridgeMat || M.ridge;
    const merlonH = cfg.merlonH || 1.3;
    /* 墙脚石：比墙身略宽的一道条石，把墙体"坐"在地上，
       否则墙身直接插进地面，近看像纸片 */
    const plinth = new THREE.Mesh(
      G.fitUV(new THREE.BoxGeometry(L + 0.35, 0.85, T + 0.5), 0.3, 0.85), M.stone
    );
    plinth.position.y = 0.42;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    group.add(plinth);
    const w = new THREE.Mesh(G.fitUV(new THREE.BoxGeometry(L, H, T), 0.3, H), bodyMat);
    w.position.y = H / 2;
    w.castShadow = true;
    w.receiveShadow = true;
    group.add(w);
    /* 压顶琉璃 */
    if (cfg.crenel) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(L + 0.5, 0.9, T + 1.1), capMat);
      cap.position.y = H + 0.45;
      cap.castShadow = true;
      group.add(cap);
      const capTop = new THREE.Mesh(new THREE.BoxGeometry(L + 0.5, 0.35, T + 1.4), capMat);
      capTop.position.y = H + 0.95;
      group.add(capTop);
    } else {
      /* 院墙压顶：两坡瓦顶比一块方盒子更像"墙帽"。
         两块斜板 + 一道脊，坡度按墙厚推，UV 按物理尺寸铺。
         厚墙（皇城）用 capRise / capOver 把帽顶做陡、做出檐。
         doubleCap：宫城城墙的做法 —— 内外各一道琉璃瓦压顶，
         中间留走道。紫禁城城墙是平滑红墙加黄琉璃瓦顶，没有垛口。 */
      if (cfg.doubleCap) {
        const rise = cfg.capRise || 0.5;
        const over = cfg.capOver == null ? 0.3 : cfg.capOver;
        for (const sz of [-1, 1]) {
          const zc = sz * (T / 2 - 0.45);
          const half = 0.45 + over;
          const slope = Math.hypot(half, rise);
          const ang = Math.atan2(rise, half);
          for (const s2 of [-1, 1]) {
            const slab = new THREE.Mesh(
              G.fitUV(new THREE.BoxGeometry(L + 0.4, 0.16, slope), 0.42, null),
              capMat
            );
            slab.rotation.x = s2 * ang;
            slab.position.set(0, H + rise / 2, zc + s2 * half / 2);
            slab.castShadow = true;
            slab.receiveShadow = true;
            group.add(slab);
          }
          const ridge = new THREE.Mesh(new THREE.BoxGeometry(L + 0.45, 0.17, 0.26), ridgeMat);
          ridge.position.set(0, H + rise, zc);
          group.add(ridge);
        }
        /* 走道面：两道德瓦之间的一道压顶，避免从空中看是空的 */
        const walk = new THREE.Mesh(
          G.fitUV(new THREE.BoxGeometry(L, 0.12, T - 1.1), 0.42, null), M.stone
        );
        walk.position.y = H + 0.06;
        walk.receiveShadow = true;
        group.add(walk);
        group.userData.isBuilding = false;
        return group;
      }
      const over = cfg.capOver == null ? 0.55 : cfg.capOver;
      const half = T / 2 + over;
      const rise = cfg.capRise || 0.46;
      const slope = Math.hypot(half, rise);
      const ang = Math.atan2(rise, half);
      for (const sz of [-1, 1]) {
        const slab = new THREE.Mesh(
          G.fitUV(new THREE.BoxGeometry(L + 0.4, 0.14, slope), 0.42, null),
          capMat
        );
        slab.rotation.x = sz * ang;
        slab.position.set(0, H + rise / 2, sz * half / 2);
        slab.castShadow = true;
        slab.receiveShadow = true;
        group.add(slab);
      }
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(L + 0.45, 0.16, 0.26), ridgeMat);
      ridge.position.y = H + rise;
      group.add(ridge);
    }
    /* 雉堞：沿墙顶等距立垛，齿部留射孔；垛口用同一材质合并成一次绘制。
       内城 / 外城城墙只做外侧一道，cfg.innerParapet === false 时省掉女墙。 */
    if (cfg.crenel) {
      const pitch = cfg.pitch || 2.6, mw = cfg.merlon || 1.5;
      const parts = [];
      const n = Math.floor(L / pitch);
      for (let i = 0; i < n; i++) {
        const x = -L / 2 + pitch * (i + 0.5);
        parts.push(G.box(mw, merlonH, T * 0.62, { x, y: H + 0.95 + merlonH / 2 }));
      }
      if (cfg.innerParapet !== false) {
        // 内侧女墙（低一档，与外侧垛口形成内外两道）
        for (let i = 0; i < n; i++) {
          const x = -L / 2 + pitch * (i + 0.5) + pitch * 0.5;
          parts.push(G.box(mw * 0.7, 0.75, T * 0.5, { x: x - pitch * 0.5, y: H + 0.95 + 0.375 }));
        }
      }
      const mm = new THREE.Mesh(G.merge(parts), bodyMat);
      mm.castShadow = true;
      group.add(mm);
    }
    group.userData.isBuilding = false;
    return group;
  }

  /* ============================================================
     马道 —— 从城内地面登上城墙顶的斜坡
     ============================================================ */
  function createRamp(cfg) {
    const M = buildMaterials();
    const group = new THREE.Group();
    const W = cfg.w || 6, L = cfg.len || 24, T = cfg.t || 0.9;
    const rise = cfg.rise || 9.6;
    const ang = Math.atan2(rise, L);
    const m = new THREE.Mesh(G.fitUV(new THREE.BoxGeometry(W, T, L), 0.3, T), M.stone);
    m.position.y = rise / 2 - T * 0.32;   // 高端（局部 -Z）抵住墙顶
    m.rotation.x = ang;
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    // 两侧牙石
    for (const sx of [-1, 1]) {
      const k = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, L), M.marble);
      k.position.set(sx * (W / 2 + 0.25), rise / 2 - T * 0.32 + 0.35, 0);
      k.rotation.x = ang;
      k.castShadow = true;
      group.add(k);
    }
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
    createCorridor, createWall, createRamp, treeGeometries, createBronzeSet,
    groundMaterial,
    get MAT() { return MAT; }
  };
})();
