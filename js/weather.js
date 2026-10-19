/* ============================================================
   天候预设
   ?weather=clear|snow|rain|autumn
   只改材质颜色、天空与雾参数，不动几何；雪 / 雨 / 落叶用粒子补足。
   粒子随机数走独立 LCG，不消耗 Math.random，避免破坏 ?seed=1 的可复现性。
   ============================================================ */
(function () {
  const GG = (window.GG = window.GG || {});

  /* 每套预设只描述"相对默认值的偏移"，颜色为 null 表示保持原样 */
  const PRESETS = {
    clear: {
      fogMul: 1, fogColor: null, cloudMul: 1, sunMul: 1,
      skyTop: null, skyBottom: null,
      tile: null, tileGreen: null, tileCap: null, wall: null, paving: null, leaf: null, leaf2: null,
      particle: null
    },
    snow: {
      fogMul: 2.6, fogColor: 0xc2cbd6, cloudMul: 1.35, sunMul: 0.52,
      skyTop: 0x7f8c9c, skyBottom: 0xc6d0da,
      /* 雪压屋顶：靠颜色提亮 + 提高粗糙度，不做积雪几何 */
      tile: 0xdde4ea, tileGreen: 0xc8d4d0, tileCap: 0xc9d3d2,
      wall: 0xa84a3c, paving: 0xc6cfd7,
      leaf: 0x40503f, leaf2: 0x4b5c48,
      particle: 'snow'
    },
    rain: {
      fogMul: 3.4, fogColor: 0x8d9aa6, cloudMul: 1.55, sunMul: 0.32,
      skyTop: 0x53626f, skyBottom: 0x8e9aa4,
      tile: 0x8f8a80, tileGreen: 0x6f8070, tileCap: 0x74827a,
      wall: 0x8a3628, paving: 0x767b80,
      leaf: 0x23381f, leaf2: 0x2b4325,
      particle: 'rain'
    },
    autumn: {
      fogMul: 1.05, fogColor: 0xd0bb9a, cloudMul: 0.92, sunMul: 0.96,
      skyTop: 0x4f6f9c, skyBottom: 0xe4cfae,
      tile: 0xc2a46e, tileGreen: 0x8a9a66, tileCap: 0x8f9a72,
      wall: 0xa5321f, paving: 0xb7a684,
      leaf: 0xb0722a, leaf2: 0xc78d34,
      particle: 'leaf'
    }
  };

  /* 默认材质色，首次 apply 时记录，用于切回 clear */
  let base = null;
  let current = 'clear';
  let group = null;           // 粒子容器
  let kind = null;            // 当前粒子类型
  let rs = 987654321;
  const rnd = () => {
    rs = (rs * 1664525 + 1013904223) >>> 0;
    return rs / 4294967296;
  };
  const _c = new THREE.Color();

  const tint = {
    fogMul: 1, cloudMul: 1, sunMul: 1,
    fogColor: null, skyTop: null, skyBottom: null
  };

  function ensureBase() {
    if (base) return;
    const M = GG.build && GG.build.MAT;
    if (!M) return;
    base = {};
    for (const k of ['tile', 'tileGreen', 'tileCap', 'wall', 'paving', 'leaf', 'leaf2']) {
      if (M[k] && M[k].color) base[k] = M[k].color.clone();
    }
  }

  function applyMaterials(p) {
    ensureBase();
    const M = GG.build && GG.build.MAT;
    if (!M) return;
    for (const k of Object.keys(base)) {
      const hex = p[k];
      if (hex == null) M[k].color.copy(base[k]);
      else M[k].color.copy(_c.setHex(hex));
    }
    /* 雪面 / 湿地：同时调粗糙度，避免"白色但还是釉面反光" */
    if (p.particle === 'snow') {
      M.tile.roughness = 0.95;
      M.tileGreen.roughness = 0.95;
    } else {
      M.tile.roughness = 0.7;
      M.tileGreen.roughness = 0.7;
    }
  }

  function disposeParticles(scene) {
    if (!group) return;
    scene.remove(group);
    group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    group = null;
    kind = null;
  }

  function makeParticles(k, scene) {
    const isRain = k === 'rain';
    const isLeaf = k === 'leaf';
    const N = isRain ? 900 : isLeaf ? 260 : 1500;
    const span = 520;
    const height = 160;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (rnd() - 0.5) * span;
      pos[i * 3 + 1] = rnd() * height;
      pos[i * 3 + 2] = (rnd() - 0.5) * span;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({
      color: isRain ? 0xaebccc : isLeaf ? 0xc08a3a : 0xffffff,
      size: isRain ? 2.4 : isLeaf ? 2.8 : 1.8,
      transparent: true,
      opacity: isRain ? 0.42 : isLeaf ? 0.8 : 0.9,
      depthWrite: false,
      sizeAttenuation: true,
      fog: false
    });
    group = new THREE.Points(g, m);
    group.frustumCulled = false;
    group.renderOrder = 5;
    group.userData.kind = k;
    scene.add(group);
    kind = k;
  }

  GG.weather = {
    presets: PRESETS,

    /** 切换天候。stage 用于挂粒子，可省略（只改材质与 tint） */
    apply(name, stage) {
      const key = PRESETS[name] ? name : 'clear';
      const p = PRESETS[key];
      current = key;

      applyMaterials(p);
      if (GG.water) GG.water.setRain(key === 'rain');

      tint.fogMul = p.fogMul;
      tint.cloudMul = p.cloudMul;
      tint.sunMul = p.sunMul;
      tint.fogColor = p.fogColor == null ? null : _c.setHex(p.fogColor).clone();
      tint.skyTop = p.skyTop == null ? null : _c.setHex(p.skyTop).clone();
      tint.skyBottom = p.skyBottom == null ? null : _c.setHex(p.skyBottom).clone();

      if (stage) {
        disposeParticles(stage.scene);
        if (p.particle) makeParticles(p.particle, stage.scene);
      }
      return key;
    },

    get name() { return current; },

    /** 每帧推进粒子；STILL 模式下不调用 */
    tick(dt, camera) {
      if (!group) return;
      const isRain = kind === 'rain';
      const isLeaf = kind === 'leaf';
      const fall = isRain ? 64 : isLeaf ? 1.5 : 2.4;
      const drift = isRain ? 7 : isLeaf ? 4.5 : 1.3;
      const arr = group.geometry.attributes.position.array;
      const n = arr.length / 3;
      const H = 160;
      for (let i = 0; i < n; i++) {
        arr[i * 3 + 1] -= fall * dt;
        arr[i * 3] += drift * dt;
        if (arr[i * 3 + 1] < 0) {
          arr[i * 3 + 1] = H;
          arr[i * 3] = (rnd() - 0.5) * 520;
          arr[i * 3 + 2] = (rnd() - 0.5) * 520;
        }
      }
      group.geometry.attributes.position.needsUpdate = true;
      /* 粒子域跟随相机，按 40m 取整避免走动时抖动 */
      group.position.set(
        Math.round(camera.position.x / 40) * 40,
        0,
        Math.round(camera.position.z / 40) * 40
      );
    }
  };
})();
