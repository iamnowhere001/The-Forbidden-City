/* ============================================================
   天空穹顶
   单 pass 片元着色器：垂直渐变 + 日轮 + 月轮 + 星空 + FBM 程序化云 + 地平线灰霾。
   不生成额外几何，穹顶每帧跟随相机（在 Stage.tick 里处理）。
   ============================================================ */
(function () {
  const GG = (window.GG = window.GG || {});

  const VERT = `
    varying vec3 vDir;
    void main(){
      vDir = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`;

  const FRAG = `
    uniform vec3 top; uniform vec3 bottom; uniform vec3 haze;
    uniform vec3 sunDir; uniform vec3 sunColor;
    uniform vec3 moonDir; uniform vec3 moonColor;
    uniform float uTime; uniform float cloudAmt;
    uniform float uNight;
    varying vec3 vDir;

    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
    float vnoise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }
    float fbm(vec2 p){
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 4; i++) {
        v += a * vnoise(p);
        p = p * 2.07 + vec2(9.1, 5.3);
        a *= 0.5;
      }
      return v;
    }

    /* 三维哈希：星空按方向切格，避免经纬度上的极点堆积 */
    float hash3(vec3 p){
      p = fract(p * vec3(443.897, 441.423, 437.195));
      p += dot(p, p.yzx + 19.19);
      return fract((p.x + p.y) * p.z);
    }

    /* 星点：每格至多一颗，位置随机偏向格心，亮度按哈希分布 */
    float starField(vec3 d){
      vec3 p = d * 190.0;
      vec3 ip = floor(p);
      vec3 fp = fract(p);
      float h = hash3(ip);
      float present = step(0.9955, h);
      vec3 off = vec3(0.25) + 0.5 * vec3(hash3(ip + 11.0), hash3(ip + 23.0), hash3(ip + 37.0));
      float dist = length(fp - off);
      float core = smoothstep(0.20, 0.0, dist);
      float bright = 0.25 + 0.75 * hash3(ip + 51.0);
      return present * core * bright;
    }

    void main(){
      vec3 d = normalize(vDir);
      float h = d.y;

      float t = pow(clamp(h, 0.0, 1.0), 0.5);
      vec3 c = mix(bottom, top, t);
      // 地平线灰霾：与场景雾色一致，让地面与天空无缝
      c = mix(c, haze, smoothstep(0.18, -0.05, h));

      /* ---------- 星空：只在地平线以上、夜间可见 ---------- */
      float skyMask = smoothstep(-0.02, 0.14, h);
      float nightAmt = uNight * skyMask;
      if (nightAmt > 0.002) {
        float s = starField(d);
        // 顶部更密、近地平线被灰霾吃掉
        c += vec3(0.82, 0.88, 1.0) * s * nightAmt * 1.8;
      }

      /* ---------- 月亮 ---------- */
      vec3 mdir = normalize(moonDir);
      float md = dot(d, mdir);
      float disc = smoothstep(0.99990, 0.99996, md);
      c += moonColor * disc * 2.6 * uNight;
      c += moonColor * pow(max(md, 0.0), 160.0) * 0.28 * uNight;
      c += moonColor * pow(max(md, 0.0), 12.0) * 0.05 * uNight;

      /* ---------- 太阳 ---------- */
      float sd = max(dot(d, normalize(sunDir)), 0.0);
      float sunVis = 1.0 - uNight;
      c += sunColor * pow(sd, 900.0) * 5.0 * sunVis;
      c += sunColor * pow(sd, 9.0) * 0.20 * sunVis;
      c += sunColor * pow(sd, 2.0) * 0.05 * sunVis;

      /* ---------- 云：夜里压暗、减量 ---------- */
      if (h > 0.002) {
        vec2 p = d.xz / (h + 0.16);
        float n = fbm(p * 0.55 + vec2(uTime * 0.0035, uTime * 0.0012)) * 0.72
                + fbm(p * 1.90 + vec2(-uTime * 0.006, 3.7)) * 0.38;
        float dens = smoothstep(0.46, 0.88, n);
        dens *= smoothstep(0.0, 0.10, h) * cloudAmt * (1.0 - uNight * 0.55);
        vec3 lit = vec3(0.52, 0.56, 0.64);
        vec3 hi = vec3(1.0, 0.985, 0.95);
        // 夜云只留月光冷灰，不跟着太阳变色
        lit = mix(lit, vec3(0.10, 0.12, 0.17), uNight);
        hi = mix(hi, vec3(0.34, 0.38, 0.46), uNight);
        vec3 cc = mix(lit, hi, smoothstep(0.2, 0.95, dens));
        cc = mix(cc, mix(sunColor, moonColor, uNight), pow(sd, 2.5) * 0.4);
        c = mix(c, cc, dens * 0.94);
      }

      gl_FragColor = vec4(c, 1.0);
    }`;

  /**
   * 创建天空材质与穹顶网格。
   * @param {object} C  GG.CONFIG
   * @param {THREE.Vector3} sunDir 初始太阳方向
   * @returns {{ material: THREE.ShaderMaterial, mesh: THREE.Mesh }}
   */
  GG.createSky = function (C, sunDir) {
    const init = C.colors.skyInitial;
    const material = new THREE.ShaderMaterial({
      uniforms: {
        top: { value: new THREE.Color(init.top) },
        bottom: { value: new THREE.Color(init.bottom) },
        haze: { value: new THREE.Color(init.haze) },
        sunDir: { value: sunDir.clone() },
        sunColor: { value: new THREE.Color(init.sun) },
        moonDir: { value: new THREE.Vector3(-0.3, 0.5, -0.8) },
        moonColor: { value: new THREE.Color(0xdfe8ff) },
        uTime: { value: 0 },
        cloudAmt: { value: 0.88 },
        uNight: { value: 0 }
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    });

    const mesh = new THREE.Mesh(new THREE.SphereGeometry(3200, 32, 20), material);
    return { material, mesh };
  };
})();
