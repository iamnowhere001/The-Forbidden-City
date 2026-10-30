/* ============================================================
   几何生成引擎 —— 中式大木作 / 瓦作 / 石作 的程序化建模
   ============================================================ */
(function () {
  const GG = (window.GG = window.GG || {});
  const T = () => GG.getTextures();

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------------- 几何合并（避免 addon 依赖） ---------------- */
  function merge(geoms) {
    const list = geoms.filter(Boolean).map((g) => (g.index ? g.toNonIndexed() : g));
    let n = 0;
    for (const g of list) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3);
    const nor = new Float32Array(n * 3);
    const uv = new Float32Array(n * 2);
    /* 屋面顶点着色（roofGeometry 的 shadeColor）必须随合并携带，
       否则琉璃瓦的檐口压暗、垄脊提亮会整片丢失 */
    const anyColor = list.some((g) => g.attributes.color);
    const col = anyColor ? new Float32Array(n * 3) : null;
    let po = 0, uo = 0, co = 0;
    for (const g of list) {
      const p = g.attributes.position;
      pos.set(p.array, po);
      if (g.attributes.normal) nor.set(g.attributes.normal.array, po);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, uo);
      if (col) {
        if (g.attributes.color) col.set(g.attributes.color.array, co);
        else col.fill(1, co, co + p.count * 3);
      }
      po += p.count * 3;
      uo += p.count * 2;
      co += p.count * 3;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.computeBoundingSphere();
    return out;
  }

  const _m4 = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();
  const _v = new THREE.Vector3();

  function xform(geo, o) {
    o = o || {};
    const g = geo.clone();
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0);
    _q.setFromEuler(_e);
    _v.set(o.sx == null ? 1 : o.sx, o.sy == null ? 1 : o.sy, o.sz == null ? 1 : o.sz);
    _m4.compose(new THREE.Vector3(o.x || 0, o.y || 0, o.z || 0), _q, _v);
    g.applyMatrix4(_m4);
    return g;
  }

  /* ============================================================
     按物理尺寸重算 UV
     —— 大盒子的默认 UV 会把贴图整块拉伸，导致石活 / 抹灰全是模糊色块。
     按顶点法线选投影面，u = 水平距离 * uScale，v = y / h（单次铺满，保留贴图底部的勒脚）
     ============================================================ */
  function fitUV(geo, uScale, h) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
      let u, v;
      if (ny > nx && ny > nz) { u = x * uScale; v = z * uScale; }
      else if (nx > nz) { u = z * uScale; v = y; }
      else { u = x * uScale; v = y; }
      if (h) v = v / h + 0.5; else v *= uScale;
      uv[i * 2] = u;
      uv[i * 2 + 1] = v;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return g;
  }

  function box(w, h, d, o) {
    return xform(new THREE.BoxGeometry(w, h, d), o);
  }

  /* 按倍率缩放几何 UV（贴图 repeat 的替代：多实例共享同一张贴图时，
     把平铺密度写进各实例的几何，避免为每个地面 clone 一份 GPU 贴图） */
  function uvScale(geo, su, sv) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    uv.needsUpdate = true;
    g.computeBoundingSphere();
    return g;
  }

  /* 取非索引几何的顶点区间 [start, start+count)（配合 toNonIndexed 切材质组） */
  function sliceGeom(geo, start, count) {
    const g = new THREE.BufferGeometry();
    for (const name of Object.keys(geo.attributes)) {
      const a = geo.attributes[name];
      const arr = new a.array.constructor(count * a.itemSize);
      for (let i = 0; i < count; i++) {
        for (let k = 0; k < a.itemSize; k++) {
          arr[i * a.itemSize + k] = a.array[(start + i) * a.itemSize + k];
        }
      }
      g.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
    }
    g.computeBoundingSphere();
    return g;
  }

  /* ============================================================
     静态合并：把一个 Group 直属的 Mesh 按（材质 × 投影 × 受影）分桶，
     每桶合成一个 Mesh。draw call 从"每 mesh 每材质组一次"降为"每桶一次"。
     约束（保证逐像素等价）：
     - 只合直属子节点，不递归；Group 层级与变换原样保留（拾取靠它找建筑）
     - InstancedMesh、ShaderMaterial、userData.noMerge 不参与
     - 同一 mesh 的材质数组按 group 切开再入桶
     ============================================================ */
  function mergeGroup(group) {
    if (!group || group.isInstancedMesh) return 0;
    const meshes = [];
    for (const child of group.children) {
      if (!child.isMesh || child.isInstancedMesh || child.userData.noMerge) continue;
      const mats = child.material;
      if (!Array.isArray(mats) && mats && mats.isShaderMaterial) continue;
      if (Array.isArray(mats) && mats.some((m) => m && m.isShaderMaterial)) continue;
      meshes.push(child);
    }
    if (meshes.length < 2) return 0;

    /* 每个 mesh 按材质组切成"零件"，零件带归属，便于精确回收：
       只有全部零件都进入 >=2 块的桶，原 mesh 才能被替换掉。
       否则整块保留——以前这里无条件 remove，单实例材质（屋顶、墙身、
       匾额）连桶带块一起消失，正是"殿无顶、墙无身"的根因。 */
    const entries = [];
    const parts = [];
    for (const child of meshes) {
      child.updateMatrix();
      const mats = Array.isArray(child.material) ? child.material : null;
      const geo = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry;
      const n = mats ? mats.length : 1;
      /* 材质数组但几何没有分组：three 一个面也画不出来，原样留着 */
      if (mats && (!geo.groups || geo.groups.length === 0)) {
        entries.push({ child, parts: [] });
        continue;
      }
      const e = { child, parts: [] };
      for (let gi = 0; gi < n; gi++) {
        const mat = mats ? (mats[gi] || mats[0]) : child.material;
        if (!mat) continue;
        const key = mat.id + '|' + (child.castShadow ? 1 : 0) + (child.receiveShadow ? 1 : 0);
        let g;
        if (mats) {
          const grp = geo.groups[gi] || { start: 0, count: geo.attributes.position.count };
          g = sliceGeom(geo, grp.start, grp.count);
        } else {
          g = geo;
        }
        const p = {
          owner: e, key: key, mat: mat,
          cast: child.castShadow, recv: child.receiveShadow,
          geo: uvScale(g, 1, 1).applyMatrix4(child.matrix)
        };
        e.parts.push(p);
        parts.push(p);
      }
      entries.push(e);
    }

    /* 桶内块数；只保留 >=2 的桶，并级联剔除"部分零件落单"的 mesh */
    const count = new Map();
    for (const p of parts) count.set(p.key, (count.get(p.key) || 0) + 1);
    const kept = new Set();
    let dirty = true;
    while (dirty) {
      dirty = false;
      for (const e of entries) {
        if (kept.has(e) || !e.parts.length) { kept.add(e); continue; }
        if (e.parts.some((p) => count.get(p.key) < 2)) {
          kept.add(e);
          for (const p of e.parts) count.set(p.key, count.get(p.key) - 1);
          dirty = true;                 // 剔除后别的桶可能掉到 1，再扫一遍
        }
      }
    }

    const buckets = new Map();
    for (const e of entries) {
      if (kept.has(e)) continue;
      for (const p of e.parts) {
        let b = buckets.get(p.key);
        if (!b) {
          b = { mat: p.mat, cast: p.cast, recv: p.recv, geos: [] };
          buckets.set(p.key, b);
        }
        b.geos.push(p.geo);
      }
    }

    let merged = 0;
    for (const b of buckets.values()) {
      if (b.geos.length < 2) continue;
      const m = new THREE.Mesh(merge(b.geos), b.mat);
      m.castShadow = b.cast;
      m.receiveShadow = b.recv;
      group.add(m);
      merged++;
    }
    /* 只摘掉真正被替换的 mesh；保留的块原地不动 */
    for (const e of entries) {
      if (!kept.has(e)) group.remove(e.child);
    }
    return merged;
  }

  /** 全场景静态合并：先深后浅，自底向上，返回合并出的 Mesh 数 */
  function optimizeStatics(root) {
    let n = 0;
    (function walk(o) {
      for (const child of o.children.slice()) walk(child);
      n += mergeGroup(o);
    })(root);
    return n;
  }

  /* ============================================================
     跨组静态合并：把"不属于任何建筑"的静态 Mesh 按材质合批。
     mergeGroup 只在一个 Group 内部合，城墙、地坪、坛墙这些
     各自成组的东西合不到一起，一座城下来仍有一两千次绘制。
     这里按材质把世界变换烘进几何，跨组合并到场景根下。

     约束（保证逐像素等价）：
     - 建筑（有 isBuilding 祖先）一律跳过：它们要保持独立供拾取
     - 只合 MeshStandardMaterial 且不透明、无顶点色、材质唯一的块
       （顶点色几何的属性集不同，混进来会被 merge 填成白色）
     - InstancedMesh / ShaderMaterial / Points 不参与
     ============================================================ */
  function mergeWorldStatics(root) {
    const buckets = new Map();
    const meshes = [];
    root.traverse((o) => { if (o.isMesh) meshes.push(o); });

    for (const o of meshes) {
      if (o.isInstancedMesh || o.userData.noMerge) continue;
      let p = o.parent, inBuilding = false;
      while (p) {
        if (p.userData && p.userData.isBuilding) { inBuilding = true; break; }
        p = p.parent;
      }
      if (inBuilding) continue;
      const m = o.material;
      if (!m || Array.isArray(m) || !m.isMeshStandardMaterial) continue;
      if (m.transparent) continue;
      const g = o.geometry;
      if (!g || !g.attributes.position) continue;
      /* 属性集要一致：有颜色属性的块单独走，避免被填白 */
      const sig = [
        m.uuid, o.castShadow ? 1 : 0, o.receiveShadow ? 1 : 0,
        g.attributes.color ? 'c' : '-', g.attributes.uv ? 'u' : '-'
      ].join('|');
      let b = buckets.get(sig);
      if (!b) {
        b = { mat: m, cast: o.castShadow, recv: o.receiveShadow, geos: [], victims: [] };
        buckets.set(sig, b);
      }
      o.updateWorldMatrix(true, false);
      b.geos.push(g.clone().applyMatrix4(o.matrixWorld));
      b.victims.push(o);
    }

    let merged = 0;
    for (const b of buckets.values()) {
      if (b.victims.length < 2) continue;
      const m = new THREE.Mesh(merge(b.geos), b.mat);
      m.castShadow = b.cast;
      m.receiveShadow = b.recv;
      m.matrixAutoUpdate = false;
      root.add(m);
      merged++;
      for (const v of b.victims) {
        if (v.parent) v.parent.remove(v);
      }
    }
    /* 清掉被掏空的空 Group（城墙段、院落骨架之类） */
    (function prune(o) {
      for (const c of o.children.slice()) prune(c);
      if (o !== root && o.isGroup && o.children.length === 0) {
        if (o.parent) o.parent.remove(o);
      }
    })(root);
    return merged;
  }

  /* ============================================================
     屋顶曲面 —— 庑殿 / 歇山 / 悬山 / 攒尖 / 腰檐
     核心：举折（上陡下缓的凹曲）+ 翼角起翘
     ============================================================ */
  function roofGeometry(o) {
    const hw = o.hw, hd = o.hd;
    const topX = o.topX, topZ = o.topZ == null ? 0 : o.topZ;
    const h = o.h || 4;
    const curv = o.curv == null ? 1.7 : o.curv;
    const lift = o.lift == null ? Math.min(hw, hd) * 0.045 : o.lift;
    const uSeg = o.uSeg || Math.max(8, Math.round(hw * 0.5));
    const vSeg = o.vSeg || 6;
    const sideVMax = o.sideVMax == null ? 1 : o.sideVMax;
    const withSides = o.withSides !== false;
    const liftExp = o.liftExp == null ? 4.6 : o.liftExp;

    /* 筒瓦立体起伏：把屋面沿横向压成余弦波纹（盖瓦凸、垄沟凹），
       起伏周期与瓦垄贴图一致，才不会和贴图打架。只在近看的殿宇上开。
       靠近正脊衰减到 0，避免把脊线拱出一道波浪。 */
    const relief = o.tileRelief || null;
    function reliefAt(coord, v) {
      if (!relief) return 0;
      const w = 0.5 - 0.5 * Math.cos((coord / relief.pitch) * Math.PI * 2);
      const t = Math.min(1, v / (relief.taper || 0.4));
      const fade = t * t * (3 - 2 * t);
      return relief.amp * w * fade;
    }

    const pos = [], uvs = [], idx = [], cols = [];
    const tileGroup = { start: 0, count: 0 };
    const gableRanges = [];

    /* 角部起翘权重：原先 |u|^11，只有最后几个顶点抬起，远看等于没有翼角。
       改成 ^5.5 后，檐口最后两成宽度一起上扬，屋角才有"翘"的轮廓。 */
    const corner = (u) => Math.pow(Math.abs(u), 5.5);

    // 屋面明暗：檐口压暗（雨水积尘 + 檐下阴影），垄脊略提亮
    function shadeColor(u, v) {
      const eave = Math.pow(1 - v, 1.7);
      const hip = Math.pow(Math.abs(u), 3.0);
      const s = 1 - 0.36 * eave - 0.09 * hip + 0.05 * Math.pow(v, 3.0);
      return s < 0.35 ? 0.35 : s;
    }

    function pushSurface(P, uDirCount, vCount, tileUvScale) {
      const base = pos.length / 3;
      for (let i = 0; i <= vCount; i++) {
        const v = (i / vCount) * (P.vMax == null ? 1 : P.vMax);
        for (let j = 0; j <= uDirCount; j++) {
          const u = -1 + (2 * j) / uDirCount;
          const p = P.fn(u, v);
          pos.push(p[0], p[1], p[2]);
          uvs.push(p[3], p[4]);
          const c = shadeColor(u, v);
          cols.push(c, c, c);
        }
      }
      for (let i = 0; i < vCount; i++) {
        for (let j = 0; j < uDirCount; j++) {
          const a = base + i * (uDirCount + 1) + j;
          const b = a + 1;
          const c = a + (uDirCount + 1);
          const d = c + 1;
          idx.push(a, b, c, b, d, c);
        }
      }
    }

    const yOf = (v) => h * Math.pow(v, curv);
    const liftOf = (u, v) => lift * corner(u) * Math.pow(1 - v, liftExp);

    // ---- 南坡 (+z) ----
    pushSurface(
      {
        fn: (u, v) => {
          const s = lerp(hw, topX, v);
          const x = u * s;
          const z = lerp(hd, topZ, v);
          const y = yOf(v) + liftOf(u, v) + reliefAt(x, v);
          return [x, y, z, (x / 4.2), (v * Math.max(hw, hd)) / 7.6];
        }
      },
      uSeg, vSeg, 1
    );

    // ---- 北坡 (-z) ----
    pushSurface(
      {
        fn: (u, v) => {
          const s = lerp(hw, topX, v);
          const x = -u * s;
          const z = -lerp(hd, topZ, v);
          const y = yOf(v) + liftOf(u, v) + reliefAt(x, v);
          return [x, y, z, (x / 4.2), (v * Math.max(hw, hd)) / 7.6];
        }
      },
      uSeg, vSeg, 1
    );

    // ---- 东 / 西坡 ----
    const sideUSeg = o.sideUSeg || Math.max(4, Math.round(hd * 0.6));
    if (withSides) {
      const sideH = topZ > 0.01 ? h * 0.999 : h;
      const vMaxS = sideVMax;
      // 东坡 (+x)
      pushSurface(
        {
          vMax: vMaxS,
          fn: (u, v) => {
            const x = lerp(hw, topX, v);
            const z = -u * lerp(hd, topZ, v);
            const y = yOf(v) + liftOf(u, v) + reliefAt(z, v);
            return [x, y, z, (z / 4.2), (v * Math.max(hw, hd)) / 7.6];
          }
        },
        sideUSeg, Math.max(3, Math.round(vSeg * vMaxS)), 1
      );
      const eastEnd = pos.length / 3;
      // 西坡 (-x)
      pushSurface(
        {
          vMax: vMaxS,
          fn: (u, v) => {
            const x = -lerp(hw, topX, v);
            const z = u * lerp(hd, topZ, v);
            const y = yOf(v) + liftOf(u, v) + reliefAt(z, v);
            return [x, y, z, (z / 4.2), (v * Math.max(hw, hd)) / 7.6];
          }
        },
        sideUSeg, Math.max(3, Math.round(vSeg * vMaxS)), 1
      );
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  /* 山花（歇山 / 悬山的两侧三角壁） */
  function gableGeometry(o) {
    const { hw, hd, topX, h, curv, vCut } = o;
    const v = vCut == null ? 0 : vCut;
    const yCut = h * Math.pow(v, curv);
    const xCut = lerp(hw, topX, v);
    const zCut = lerp(hd, 0, v);

    const geoms = [];
    for (const sx of [1, -1]) {
      // 三角面：底边两点 + 顶点
      const g = new THREE.BufferGeometry();
      const p = [
        sx * xCut, yCut, -zCut,
        sx * xCut, yCut, zCut,
        sx * topX, h, 0
      ];
      const uvs = [
        (zCut * 2) / 4, 0,
        0, 0,
        zCut / 4, (h - yCut) / 4
      ];
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      if (sx > 0) g.setIndex([0, 1, 2]);
      else g.setIndex([2, 1, 0]);
      g.computeVertexNormals();
      geoms.push(g);
    }
    return merge(geoms);
  }

  /* 正脊 + 垂脊 + 吻兽 */
  function ridgeGeometry(o) {
    const { hw, hd, topX, topZ = 0, h, lift, curv = 1.55 } = o;
    const parts = [];
    const hipWidth = Math.max(0.7, Math.min(1.85, hw * 0.048));

    // 正脊：太和殿实物脊高约 1.5 m，之前按 1.9 倍脊宽做出来将近 3 m，
    // 从近景看是一条粗金条，压住了屋面
    if (topX > 0.6) {
      parts.push(box(topX * 2 + hipWidth * 2.2, hipWidth * 1.05, hipWidth * 0.95, { y: h + hipWidth * 0.5 }));
      // 脊上小兽列
      const n = Math.max(2, Math.round(topX * 2 / 2.6));
      for (let i = 0; i <= n; i++) {
        const x = -topX + (topX * 2 * i) / n;
        if (Math.abs(x) > topX - 0.4) continue;
        parts.push(box(0.38, 0.42, 0.38, { x, y: h + hipWidth * 0.98 }));
      }
    }

    // 四条垂脊
    const corners = [
      [hw, hd], [-hw, hd], [hw, -hd], [-hw, -hd]
    ];
    for (const [cx, cz] of corners) {
      const sx = Math.sign(cx), sz = Math.sign(cz);
      /* 檐角起翘后，垂脊末端必须跟着抬到 lift，否则屋角翘起、
         脊却停在低处，近看会裂开一道缝。中间控制点带一点
         起翘衰减，曲线才贴着屋面走。 */
      const pts = [
        new THREE.Vector3(topX * sx, h + hipWidth * 0.7, topZ * sz * 0.2),
        new THREE.Vector3(lerp(topX, hw, 0.45) * sx, h * Math.pow(0.58, curv) + lift * 0.06 + hipWidth * 0.55, lerp(topZ, hd, 0.45) * sz),
        new THREE.Vector3(lerp(topX, hw, 0.8) * sx, h * Math.pow(0.24, curv) + hipWidth * 0.35, lerp(topZ, hd, 0.8) * sz),
        new THREE.Vector3(cx * 0.985, lift + hipWidth * 0.18, cz * 0.985)
      ];
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.TubeGeometry(curve, 14, hipWidth * 0.24, 5, false);
      parts.push(tube);

      // 檐角走兽：仙人骑凤压头，后面一列蹲兽，越靠里越小
      const nb = o.beasts == null ? 3 : o.beasts;
      for (let i = 0; i < nb; i++) {
        const t = 0.775 + i * 0.036;
        const p = curve.getPoint(t);
        const s = 1 - i * 0.055;
        parts.push(box(0.3 * s, 0.4 * s, 0.28 * s, { x: p.x, y: p.y + 0.3 * s, z: p.z }));
        parts.push(box(0.19 * s, 0.2 * s, 0.2 * s, { x: p.x, y: p.y + 0.56 * s, z: p.z }));
      }
      {
        const p = curve.getPoint(0.975);
        parts.push(box(0.26, 0.46, 0.24, { x: p.x, y: p.y + 0.33, z: p.z }));
        parts.push(box(0.17, 0.2, 0.19, { x: p.x, y: p.y + 0.62, z: p.z }));
      }
    }

    // 鸱吻（正脊两端）：侧影轮廓挤出
    if (topX > 0.6) {
      const K = Math.min(3.4, Math.max(1.0, hw * 0.105));
      const th = hipWidth * 0.95;
      const sh = new THREE.Shape();
      // 单位轮廓：底部宽，向上收，顶部向后卷（尾朝外）
      sh.moveTo(-0.62, 0.0);
      sh.lineTo(0.62, 0.0);
      sh.lineTo(0.5, 0.26);
      sh.bezierCurveTo(0.42, 0.62, 0.16, 0.72, 0.2, 0.98);
      sh.bezierCurveTo(0.24, 1.2, 0.5, 1.24, 0.62, 1.05);
      sh.bezierCurveTo(0.78, 0.82, 0.5, 0.64, 0.3, 0.74);
      sh.bezierCurveTo(0.16, 0.82, 0.26, 0.52, 0.3, 0.36);
      sh.lineTo(0.42, 0.06);
      sh.lineTo(-0.3, 0.06);
      sh.lineTo(-0.44, 0.3);
      sh.bezierCurveTo(-0.56, 0.6, -0.72, 0.52, -0.7, 0.28);
      sh.lineTo(-0.62, 0.0);
      const kg = new THREE.ExtrudeGeometry(sh, {
        depth: th, bevelEnabled: true, bevelSize: th * 0.1,
        bevelThickness: th * 0.1, bevelSegments: 1, curveSegments: 7
      });
      kg.scale(K, K, 1);
      kg.translate(0, 0, -th / 2);
      const kBase = xform(kg, { ry: Math.PI / 2 });
      for (const sx of [1, -1]) {
        const k = xform(kBase, {
          x: sx * (topX + hipWidth * 0.42),
          y: h + hipWidth * 1.05,
          ry: 0, sy: 1, sx: 1,
          rz: 0
        });
        // 左右镜像：翻转 z
        if (sx < 0) k.scale(1, 1, 1);
        parts.push(k);
      }
    }

    return merge(parts);
  }

  /* ============================================================
     台基 / 须弥座
     ============================================================ */
  function terraceGeometry(w, d, h, tiers, waist) {
    const parts = [];
    tiers = tiers || 1;
    let cw = w, cd = d, y = 0;
    const th = h / tiers;
    for (let i = 0; i < tiers; i++) {
      if (waist) {
        /* 须弥座：下枋、束腰、上枋三段。三台这种大体量台基如果只做成
           一块斜收的方盒，近看只有几条白线；束腰退进去 0.55 m 之后，
           阳光才能在台基上压出一道真正的水平阴影。 */
        const bh = th * 0.22, wh = th * 0.52, uh = th * 0.26;
        parts.push(box(cw + 0.4, bh, cd + 0.4, { y: y + bh / 2 }));
        parts.push(box(cw - 0.55, wh, cd - 0.55, { y: y + bh + wh / 2 }));
        parts.push(box(cw + 0.35, uh, cd + 0.35, { y: y + bh + wh + uh / 2 }));
        parts.push(box(cw + 0.55, th * 0.045, cd + 0.55, { y: y + bh }));
        parts.push(box(cw + 0.55, th * 0.045, cd + 0.55, { y: y + bh + wh }));
      } else {
        parts.push(box(cw, th, cd, { y: y + th / 2 }));
        // 上下枭混线脚
        parts.push(box(cw + 0.35, th * 0.16, cd + 0.35, { y: y + th * 0.08 }));
        parts.push(box(cw + 0.35, th * 0.16, cd + 0.35, { y: y + th * 0.92 }));
      }
      y += th;
      cw -= i === tiers - 1 ? 0 : Math.min(2.6, w * 0.045);
      cd -= i === tiers - 1 ? 0 : Math.min(2.6, d * 0.045);
    }
    return { geo: fitUV(merge(parts), 0.26), top: y, topW: cw + (tiers > 1 ? Math.min(2.6, w * 0.045) : 0), topD: cd + (tiers > 1 ? Math.min(2.6, d * 0.045) : 0) };
  }

  /* 望柱 + 栏板
     gaps: { s: 南面缺口中宽, n: 北面缺口中宽 }，给三台大台阶让出上口。
     旧版一整条栏板横跨台阶，人还没上台阶就先被一道栏杆挡住。 */
  function railingGeometry(w, d, h, weight, gaps) {
    const parts = [];
    const step = 2.6;
    const postW = 0.32 * (weight || 1);
    const postH = h * (weight || 1);

    function post(x, z, big) {
      const pw = postW * (big ? 1.35 : 1);
      const ph = postH * (big ? 1.12 : 1);
      parts.push(box(pw * 1.45, ph * 0.07, pw * 1.45, { x, y: ph * 0.035, z })); // 柱础
      parts.push(box(pw, ph, pw, { x, y: ph / 2, z }));
      // 望柱头：四棱云头，比一块方帽更像石活
      parts.push(xform(new THREE.CylinderGeometry(pw * 0.34, pw * 0.58, ph * 0.15, 4), {
        x, y: ph * 1.06, z, ry: Math.PI / 4
      }));
      parts.push(box(pw * 1.38, ph * 0.05, pw * 1.38, { x, y: ph * 1.15, z }));
    }

    function run(x1, z1, x2, z2) {
      const len = Math.hypot(x2 - x1, z2 - z1);
      if (len < 0.3) return;
      const n = Math.max(1, Math.round(len / step));
      const ang = Math.atan2(z2 - z1, x2 - x1);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        post(lerp(x1, x2, t), lerp(z1, z2, t), false);
      }
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const x = lerp(x1, x2, t), z = lerp(z1, z2, t);
        const seg = len / n - postW * 0.9;
        // 地栿、栏板、上枋三段；栏板实心，不做成一道栅栏
        parts.push(box(seg, postH * 0.09, postW * 1.25, { x, y: postH * 0.06, z, ry: -ang }));
        parts.push(box(seg, postH * 0.54, postW * 0.62, { x, y: postH * 0.47, z, ry: -ang }));
        parts.push(box(seg, postH * 0.1, postW * 0.9, { x, y: postH * 0.88, z, ry: -ang }));
      }
    }

    const hw = w / 2, hd = d / 2;
    const gs = gaps && gaps.s ? Math.min(gaps.s, w - 1) : 0;
    const gn = gaps && gaps.n ? Math.min(gaps.n, w - 1) : 0;
    if (gs) {
      run(-hw, hd, -gs / 2, hd);
      run(gs / 2, hd, hw, hd);
      post(-gs / 2, hd, true); post(gs / 2, hd, true);
    } else {
      run(-hw, hd, hw, hd);
    }
    if (gn) {
      run(-hw, -hd, -gn / 2, -hd);
      run(gn / 2, -hd, hw, -hd);
      post(-gn / 2, -hd, true); post(gn / 2, -hd, true);
    } else {
      run(-hw, -hd, hw, -hd);
    }
    run(hw, -hd, hw, hd);
    run(-hw, -hd, -hw, hd);
    return merge(parts);
  }

  /* 踏跺（台阶）
     垂带石要顺着踏步斜下来；旧版是两块从地到顶的直墙，近看像台阶
     两侧砌了两堵挡土墙。 */
  function stairsGeometry(w, totalH, steps, depth, side) {
    const parts = [];
    const sh = totalH / steps;
    const sd = depth / steps;
    const dir = side === 'n' ? -1 : 1;
    for (let i = 0; i < steps; i++) {
      const h = totalH - i * sh;
      parts.push(box(w, h, sd, {
        y: h / 2,
        z: dir * (i * sd + sd / 2)
      }));
    }
    // 垂带
    const ang = Math.atan2(totalH, depth);
    const slope = Math.hypot(totalH, depth);
    for (const sx of [-1, 1]) {
      parts.push(box(0.72, 0.38, slope + 0.7, {
        x: sx * (w / 2 + 0.36), y: totalH / 2 + 0.19,
        z: dir * depth / 2, rx: dir > 0 ? ang : -ang
      }));
      // 垂带压面：沿斜面的一道窄条
      parts.push(box(0.82, 0.12, slope + 0.7, {
        x: sx * (w / 2 + 0.36), y: totalH / 2 + 0.44,
        z: dir * depth / 2, rx: dir > 0 ? ang : -ang
      }));
    }
    return merge(parts);
  }

  /* ============================================================
     构件小件
     ============================================================ */
  function columnRing(w, d, h, spacing) {
    const parts = [];
    const r = 0.33;
    const nx = Math.max(2, Math.round(w / spacing));
    const nz = Math.max(2, Math.round(d / spacing));
    const hw = w / 2, hd = d / 2;
    for (let i = 0; i <= nx; i++) {
      const x = -hw + (w * i) / nx;
      parts.push(xform(new THREE.CylinderGeometry(r, r * 1.06, h, 8), { x, y: h / 2, z: hd }));
      parts.push(xform(new THREE.CylinderGeometry(r, r * 1.06, h, 8), { x, y: h / 2, z: -hd }));
    }
    for (let i = 1; i < nz; i++) {
      const z = -hd + (d * i) / nz;
      parts.push(xform(new THREE.CylinderGeometry(r, r * 1.06, h, 8), { x: hw, y: h / 2, z }));
      parts.push(xform(new THREE.CylinderGeometry(r, r * 1.06, h, 8), { x: -hw, y: h / 2, z }));
    }
    return merge(parts);
  }

  /* 柱础：与 columnRing 同一套柱位，石鼓略粗于柱径。
     近景看，柱子不再直接插进台面。 */
  function columnBases(w, d, spacing) {
    const parts = [];
    const r = 0.58, h = 0.34;
    const nx = Math.max(2, Math.round(w / spacing));
    const nz = Math.max(2, Math.round(d / spacing));
    const hw = w / 2, hd = d / 2;
    for (let i = 0; i <= nx; i++) {
      const x = -hw + (w * i) / nx;
      parts.push(xform(new THREE.CylinderGeometry(r, r * 1.14, h, 8), { x, y: h / 2, z: hd }));
      parts.push(xform(new THREE.CylinderGeometry(r, r * 1.14, h, 8), { x, y: h / 2, z: -hd }));
    }
    for (let i = 1; i < nz; i++) {
      const z = -hd + (d * i) / nz;
      parts.push(xform(new THREE.CylinderGeometry(r, r * 1.14, h, 8), { x: hw, y: h / 2, z }));
      parts.push(xform(new THREE.CylinderGeometry(r, r * 1.14, h, 8), { x: -hw, y: h / 2, z }));
    }
    return merge(parts);
  }

  /* 斗拱层：一圈小方块，比屋身略外挑 */
  function dougongRing(w, d, y, h) {
    const parts = [];
    const step = 1.5;
    const nx = Math.max(2, Math.round(w / step));
    const nz = Math.max(2, Math.round(d / step));
    const hw = w / 2 + 0.35, hd = d / 2 + 0.35;
    const size = step * 0.92;
    for (let i = 0; i < nx; i++) {
      const x = -hw + (w * (i + 0.5)) / nx;
      parts.push(box(size, h, 0.9, { x, y: y + h / 2, z: hd }));
      parts.push(box(size, h, 0.9, { x, y: y + h / 2, z: -hd }));
    }
    for (let i = 0; i < nz; i++) {
      const z = -hd + (d * (i + 0.5)) / nz;
      parts.push(box(0.9, h, size, { x: hw, y: y + h / 2, z }));
      parts.push(box(0.9, h, size, { x: -hw, y: y + h / 2, z }));
    }
    // 挑檐枋
    parts.push(box(w + 1.6, h * 0.55, d + 1.6, { y: y + h * 0.78 }));
    return merge(parts);
  }

  /* 逐攒斗拱：太和殿这类高等级殿宇的檐下不是一条连续的方块带，
     而是一攒一攒的斗拱，攒与攒之间留空。三层出跳，近看才有
     "层层叠叠托住屋檐"的读感。 */
  function dougongRingDetailed(w, d, y, h, step) {
    const parts = [];
    const hw = w / 2 + 0.32, hd = d / 2 + 0.32;

    function cluster(x, z, nx, nz) {
      const add = (tw, hh, rd, yo, off) => {
        const bx = Math.abs(nx) > 0.5 ? rd : tw;
        const bz = Math.abs(nx) > 0.5 ? tw : rd;
        parts.push(box(bx, hh, bz, {
          x: x + nx * off, y: y + yo + hh / 2, z: z + nz * off
        }));
      };
      add(0.62, h * 0.42, 0.5, 0, 0.16);
      add(0.86, h * 0.3, 0.64, h * 0.42, 0.1);
      add(1.06, h * 0.2, 0.8, h * 0.72, 0.04);
      add(0.24, h * 0.72, 0.34, 0, 0.3);
    }

    function face(len, at, nx, nz) {
      const n = Math.max(2, Math.round(len / (step || 1.15)));
      for (let i = 0; i <= n; i++) {
        const p = at(i / n);
        cluster(p[0], p[1], nx, nz);
      }
      // 平板枋：把一攒攒斗拱串起来的一条薄板
      const p0 = at(0), p1 = at(1);
      const cx = (p0[0] + p1[0]) / 2, cz = (p0[1] + p1[1]) / 2;
      const bx = Math.abs(nx) > 0.5 ? 0.3 : len + 0.6;
      const bz = Math.abs(nx) > 0.5 ? len + 0.6 : 0.3;
      parts.push(box(bx, h * 0.16, bz, {
        x: cx + nx * 0.06, y: y + h * 0.93, z: cz + nz * 0.06
      }));
    }

    face(w, (t) => [-hw + w * t, hd], 0, 1);
    face(w, (t) => [hw - w * t, -hd], 0, -1);
    face(d, (t) => [hw, hd - d * t], 1, 0);
    face(d, (t) => [-hw, -hd + d * t], -1, 0);
    return merge(parts);
  }

  /* ============================================================
     檐口细节：瓦当 / 滴水 / 檐椽 / 檐口板
     屋面几何在檐口是一条零厚度的边。补上这一圈以后，
     屋檐才有"瓦当一排、椽子一排"的断面，而不是一块板。
     返回三组几何，调用方按材质分别合并。
     ============================================================ */
  function eaveEdgeGeometry(o) {
    const hw = o.hw, hd = o.hd;
    const lift = o.lift || 0;
    const pitch = o.pitch || 0.525;
    const tileR = o.tileR || 0.19;
    const tiles = [], rafters = [];
    const fpos = [], fuv = [], fidx = [];

    const yAt = (u) => lift * Math.pow(Math.abs(u), 5.5);

    function strip(len, at, out) {
      const n = Math.max(2, Math.round(len / 0.9));
      const base = fpos.length / 3;
      for (let i = 0; i <= n; i++) {
        const t = -1 + 2 * i / n;
        const p = at(t);
        fpos.push(p[0], p[1] + 0.02, p[2]);
        fpos.push(p[0], p[1] - 0.26, p[2]);
        fuv.push((i / n) * len / 2, 1, (i / n) * len / 2, 0);
      }
      for (let i = 0; i < n; i++) {
        const a = base + i * 2, b = a + 1, c = a + 2, d = a + 3;
        // 用叉积判断朝向，避免四条边的绕序各写一套
        const ax = fpos[a * 3], ay = fpos[a * 3 + 1], az = fpos[a * 3 + 2];
        const bx = fpos[b * 3], by = fpos[b * 3 + 1], bz = fpos[b * 3 + 2];
        const cx = fpos[c * 3], cy = fpos[c * 3 + 1], cz = fpos[c * 3 + 2];
        const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
        const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
        const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
        if (nx * out[0] + ny * out[1] + nz * out[2] < 0) {
          fidx.push(a, c, b, b, c, d);
        } else {
          fidx.push(a, b, c, b, d, c);
        }
      }
    }

    function edge(len, at, out) {
      const n = Math.max(2, Math.round(len / pitch));
      for (let i = 0; i <= n; i++) {
        const p = at(-1 + 2 * i / n);
        const cyl = new THREE.CylinderGeometry(tileR, tileR * 0.9, 0.12, 10);
        const oo = {
          x: p[0] + out[0] * 0.06,
          y: p[1] - 0.04,
          z: p[2] + out[2] * 0.06
        };
        if (Math.abs(out[2]) > 0.5) oo.rx = Math.PI / 2;
        else oo.rz = Math.PI / 2;
        tiles.push(xform(cyl, oo));

        if (i < n) {
          const q = at(-1 + 2 * (i + 0.5) / n);
          const drip = new THREE.ConeGeometry(tileR * 1.08, 0.42, 4);
          tiles.push(xform(drip, {
            x: q[0] + out[0] * 0.06, y: q[1] - 0.22,
            z: q[2] + out[2] * 0.06,
            ry: Math.PI / 4, rz: Math.PI, sz: 0.42
          }));
        }
      }
      const nr = Math.max(2, Math.round(len / 0.42));
      for (let i = 0; i <= nr; i++) {
        const p = at(-1 + 2 * i / nr);
        const bx = Math.abs(out[2]) > 0.5 ? 0.13 : 0.58;
        const bz = Math.abs(out[2]) > 0.5 ? 0.58 : 0.13;
        rafters.push(box(bx, 0.13, bz, {
          x: p[0] - out[0] * 0.3, y: p[1] - 0.33, z: p[2] - out[2] * 0.3
        }));
      }
      strip(len, at, out);
    }

    edge(hw * 2, (t) => [t * hw, yAt(t), hd], [0, 0, 1]);
    edge(hw * 2, (t) => [-t * hw, yAt(t), -hd], [0, 0, -1]);
    edge(hd * 2, (t) => [hw, yAt(t), -t * hd], [1, 0, 0]);
    edge(hd * 2, (t) => [-hw, yAt(t), t * hd], [-1, 0, 0]);

    const fascia = new THREE.BufferGeometry();
    fascia.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3));
    fascia.setAttribute('uv', new THREE.Float32BufferAttribute(fuv, 2));
    fascia.setIndex(fidx);
    fascia.computeVertexNormals();

    return {
      tiles: tiles.length ? merge(tiles) : null,
      rafters: rafters.length ? merge(rafters) : null,
      fascia: fidx.length ? fascia : null
    };
  }

  GG.geo = {
    merge, xform, box, fitUV, uvScale, roofGeometry, gableGeometry, ridgeGeometry,
    terraceGeometry, railingGeometry, stairsGeometry, columnRing, columnBases, dougongRing,
    dougongRingDetailed, eaveEdgeGeometry,
    mergeGroup, optimizeStatics, mergeWorldStatics, lerp
  };
})();
