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
    let po = 0, uo = 0;
    for (const g of list) {
      const p = g.attributes.position;
      pos.set(p.array, po);
      if (g.attributes.normal) nor.set(g.attributes.normal.array, po);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, uo);
      po += p.count * 3;
      uo += p.count * 2;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
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
    const liftExp = o.liftExp == null ? 7.0 : o.liftExp;

    const pos = [], uvs = [], idx = [], cols = [];
    const tileGroup = { start: 0, count: 0 };
    const gableRanges = [];

    // 角部起翘权重：只在檐角最后一段显著
    const corner = (u) => Math.pow(Math.abs(u), 11.0);

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
          const y = yOf(v) + liftOf(u, v);
          return [x, y, z, (x / 9.6), (v * Math.max(hw, hd)) / 7.6];
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
          const y = yOf(v) + liftOf(u, v);
          return [x, y, z, (x / 9.6), (v * Math.max(hw, hd)) / 7.6];
        }
      },
      uSeg, vSeg, 1
    );

    // ---- 东 / 西坡 ----
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
            const y = yOf(v) + liftOf(u, v);
            return [x, y, z, (z / 9.6), (v * Math.max(hw, hd)) / 7.6];
          }
        },
        Math.max(4, Math.round(hd * 0.6)), Math.max(3, Math.round(vSeg * vMaxS)), 1
      );
      const eastEnd = pos.length / 3;
      // 西坡 (-x)
      pushSurface(
        {
          vMax: vMaxS,
          fn: (u, v) => {
            const x = -lerp(hw, topX, v);
            const z = u * lerp(hd, topZ, v);
            const y = yOf(v) + liftOf(u, v);
            return [x, y, z, (z / 9.6), (v * Math.max(hw, hd)) / 7.6];
          }
        },
        Math.max(4, Math.round(hd * 0.6)), Math.max(3, Math.round(vSeg * vMaxS)), 1
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

    // 正脊
    if (topX > 0.6) {
      parts.push(box(topX * 2 + hipWidth * 2.2, hipWidth * 1.9, hipWidth * 1.5, { y: h + hipWidth * 0.72 }));
      // 脊上小兽列
      const n = Math.max(2, Math.round(topX * 2 / 2.6));
      for (let i = 0; i <= n; i++) {
        const x = -topX + (topX * 2 * i) / n;
        if (Math.abs(x) > topX - 0.4) continue;
        parts.push(box(0.45, 0.5, 0.45, { x, y: h + hipWidth * 1.5 }));
      }
    }

    // 四条垂脊
    const corners = [
      [hw, hd], [-hw, hd], [hw, -hd], [-hw, -hd]
    ];
    for (const [cx, cz] of corners) {
      const sx = Math.sign(cx), sz = Math.sign(cz);
      // 从正脊端点到檐角，v 单调递减（0.55 / 0.2 对应檐口到脊的插值）
      const pts = [
        new THREE.Vector3(topX * sx, h + hipWidth * 0.7, topZ * sz * 0.2),
        new THREE.Vector3(lerp(topX, hw, 0.45) * sx, h * Math.pow(0.58, curv) + hipWidth * 0.55, lerp(topZ, hd, 0.45) * sz),
        new THREE.Vector3(lerp(topX, hw, 0.8) * sx, h * Math.pow(0.24, curv) + hipWidth * 0.35, lerp(topZ, hd, 0.8) * sz),
        new THREE.Vector3(cx * 0.985, lift * 0.5 + hipWidth * 0.18, cz * 0.985)
      ];
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.TubeGeometry(curve, 14, hipWidth * 0.24, 5, false);
      parts.push(tube);

      // 檐角走兽（简化为三个小方块）
      for (let i = 0; i < 2; i++) {
        const t = 0.88 + i * 0.04;
        const p = curve.getPoint(t);
        parts.push(box(0.26, 0.36, 0.26, { x: p.x, y: p.y + 0.26, z: p.z }));
      }
    }

    // 鸱吻（正脊两端）：侧影轮廓挤出
    if (topX > 0.6) {
      const K = Math.min(2.1, Math.max(1.0, hw * 0.072));
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
          y: h + hipWidth * 1.75,
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
  function terraceGeometry(w, d, h, tiers) {
    const parts = [];
    tiers = tiers || 1;
    let cw = w, cd = d, y = 0;
    const th = h / tiers;
    for (let i = 0; i < tiers; i++) {
      parts.push(box(cw, th, cd, { y: y + th / 2 }));
      // 上下枭混线脚
      parts.push(box(cw + 0.35, th * 0.16, cd + 0.35, { y: y + th * 0.08 }));
      parts.push(box(cw + 0.35, th * 0.16, cd + 0.35, { y: y + th * 0.92 }));
      y += th;
      cw -= i === tiers - 1 ? 0 : Math.min(2.6, w * 0.045);
      cd -= i === tiers - 1 ? 0 : Math.min(2.6, d * 0.045);
    }
    return { geo: fitUV(merge(parts), 0.26), top: y, topW: cw + (tiers > 1 ? Math.min(2.6, w * 0.045) : 0), topD: cd + (tiers > 1 ? Math.min(2.6, d * 0.045) : 0) };
  }

  /* 望柱 + 栏板 */
  function railingGeometry(w, d, h, weight) {
    const parts = [];
    const step = 2.6;
    const postW = 0.3 * (weight || 1);
    const postH = h * (weight || 1);

    function edge(x1, z1, x2, z2) {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const n = Math.max(2, Math.round(len / step));
      const ang = Math.atan2(z2 - z1, x2 - x1);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = lerp(x1, x2, t), z = lerp(z1, z2, t);
        parts.push(box(postW, postH, postW, { x, y: postH / 2, z }));
        // 望柱头
        parts.push(box(postW * 1.35, postH * 0.12, postW * 1.35, { x, y: postH + postH * 0.05, z }));
      }
      // 栏板
      parts.push(box(len, postH * 0.5, postW * 0.72, {
        x: (x1 + x2) / 2, y: postH * 0.55, z: (z1 + z2) / 2, ry: -ang
      }));
      parts.push(box(len, postH * 0.1, postW * 0.9, {
        x: (x1 + x2) / 2, y: postH * 0.92, z: (z1 + z2) / 2, ry: -ang
      }));
    }

    const hw = w / 2, hd = d / 2;
    edge(-hw, hd, hw, hd);
    edge(-hw, -hd, hw, -hd);
    edge(hw, -hd, hw, hd);
    edge(-hw, -hd, -hw, hd);
    return merge(parts);
  }

  /* 踏跺（台阶） */
  function stairsGeometry(w, totalH, steps, depth, side) {
    const parts = [];
    const sh = totalH / steps;
    const sd = depth / steps;
    for (let i = 0; i < steps; i++) {
      const h = totalH - i * sh;
      parts.push(box(w, h, sd, {
        y: h / 2,
        z: (side === 'n' ? -1 : 1) * (i * sd + sd / 2)
      }));
    }
    // 垂带
    for (const sx of [-1, 1]) {
      parts.push(box(0.6, totalH + 0.4, depth + 0.6, {
        x: sx * (w / 2 + 0.3), y: (totalH + 0.4) / 2,
        z: (side === 'n' ? -1 : 1) * depth / 2, rx: 0
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

  GG.geo = {
    merge, xform, box, fitUV, roofGeometry, gableGeometry, ridgeGeometry,
    terraceGeometry, railingGeometry, stairsGeometry, columnRing, dougongRing,
    lerp
  };
})();
