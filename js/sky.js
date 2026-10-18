/* ============================================================
   天空穹顶
   单 pass 片元着色器：垂直渐变 + 日轮 + FBM 程序化云 + 地平线灰霾。
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
    uniform float uTime; uniform float cloudAmt;
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

    void main(){
      vec3 d = normalize(vDir);
      float h = d.y;

      float t = pow(clamp(h, 0.0, 1.0), 0.5);
      vec3 c = mix(bottom, top, t);
      // 地平线灰霾：与场景雾色一致，让地面与天空无缝
      c = mix(c, haze, smoothstep(0.18, -0.05, h));

      float sd = max(dot(d, normalize(sunDir)), 0.0);
      c += sunColor * pow(sd, 900.0) * 5.0;
      c += sunColor * pow(sd, 9.0) * 0.20;
      c += sunColor * pow(sd, 2.0) * 0.05;

      if (h > 0.002) {
        vec2 p = d.xz / (h + 0.16);
        float n = fbm(p * 0.55 + vec2(uTime * 0.0035, uTime * 0.0012)) * 0.72
                + fbm(p * 1.90 + vec2(-uTime * 0.006, 3.7)) * 0.38;
        float dens = smoothstep(0.46, 0.88, n);
        dens *= smoothstep(0.0, 0.10, h) * cloudAmt;
        vec3 cc = mix(vec3(0.52, 0.56, 0.64), vec3(1.0, 0.985, 0.95), smoothstep(0.2, 0.95, dens));
        cc = mix(cc, sunColor, pow(sd, 2.5) * 0.4);
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
        uTime: { value: 0 },
        cloudAmt: { value: 0.88 }
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
