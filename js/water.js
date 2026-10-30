/* ============================================================
   水面材质 —— 程序化波纹 + 菲涅耳天光 + 日光碎金
   护城河、金水河、太液池（北海 / 中南海）共用一份材质。
   与日照联动：renderer.setSun() 调用 GG.water.sync(...)，
   主循环调用 GG.water.tick(dt)（?still=1 时不推进时间）。

   与 v2.3 的差别：
   - 反射色不再直接取"天空底部的雾色"，而是按反射向量在
     天顶色 / 地平色之间插值。掠射角反射天顶、俯视透出水色，
     水面才有"深度"，不会整片发白。
   - 高光从单瓣镜面改成多尺度闪烁（碎金），低太阳角时拉长。
   - 夜间叠一条月光带，不再靠环境光把水面照成灰蓝。
   ============================================================ */
(function () {
  const GG = (window.GG = window.GG || {});

  const VERT = `
    varying vec3 vWorld;
    void main(){
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`;

  const FRAG = `
    uniform float uTime;
    uniform vec3 uSunDir;
    uniform vec3 uSunColor;
    uniform vec3 uSkyTop;
    uniform vec3 uSkyBottom;
    uniform vec3 uDeepColor;
    uniform vec3 uFogColor;
    uniform float uFogDensity;
    uniform float uRain;
    uniform float uNight;
    varying vec3 vWorld;

    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
    float noise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }

    void main(){
      vec3 toCam = cameraPosition - vWorld;
      float dist = length(toCam);
      vec3 V = toCam / max(dist, 0.001);

      /* 波纹斜率：远处衰减，但留一个下限。
         原先远场完全抹平，水面成了完美镜面 —— 一片塑料。
         低频大浪不随距离衰减，远处才有起伏与光斑变化。 */
      float damp = exp(-dist * 0.0060);
      vec2 q = vWorld.xz;
      float t = uTime;
      /* 相位扰动：正交的余弦列会结成棋盘格，护城河上尤其明显。
         用低频噪声把波峰扭弯，水面才不像编织物。 */
      float ph = (noise(q * 0.028 + vec2(t * 0.02, -t * 0.015)) - 0.5) * 7.0;
      float dx = cos(q.x * 1.15 + t * 1.25 + ph) * 1.15 * 0.044
         + cos((q.x + q.y) * 0.42 + t * 0.70) * 0.42 * 0.055
         + cos((q.x - q.y) * 0.33 - t * 0.55) * 0.33 * 0.048;
      float dz = cos(q.y * 0.95 - t * 0.95 + ph * 0.8) * 0.95 * 0.040
               + cos((q.x + q.y) * 0.42 + t * 0.70) * 0.42 * 0.055
               - cos((q.x - q.y) * 0.33 - t * 0.55) * 0.33 * 0.048;

      /* 低频涌浪：波长 150~300 m，1 km 外仍在，负责"这不是玻璃" */
      float fx = cos(q.x * 0.026 + q.y * 0.011 + t * 0.30) * 0.075
               + cos(q.x * 0.041 - q.y * 0.019 - t * 0.22) * 0.055;
      float fz = cos(q.y * 0.031 - q.x * 0.013 - t * 0.26) * 0.070
               + cos(q.y * 0.047 + q.x * 0.021 + t * 0.19) * 0.050;

      /* 近景细纹：60 米内可见，远处迅速衰减 */
      float nearFade = exp(-dist * 0.038);
      dx += (cos(q.x * 7.3 + t * 3.1) * 0.0062 + cos(q.y * 9.1 - t * 2.4) * 0.0048) * nearFade;
      dz += (cos(q.y * 8.7 - t * 2.9) * 0.0058 + cos(q.x * 10.3 + t * 3.4) * 0.0044) * nearFade;

      /* 风纹：低频噪声扰出的宽窄水带，让水面不是一张均匀的网 */
      vec2 wind = vec2(q.x * 0.021 + t * 0.03, q.y * 0.055 - t * 0.02);
      float streak = noise(wind) - 0.5;
      dx += streak * 0.09 * damp;
      dz += streak * 0.045 * damp;

      /* 雨滴涟漪：格点随机相位，向外扩散的圆环 */
      if (uRain > 0.01) {
        vec2 rp = vWorld.xz * 0.42;
        vec2 ip = floor(rp);
        vec2 fp = fract(rp) - 0.5;
        float h = hash(ip);
        float phase = fract(uTime * 0.55 + h * 7.0);
        float r = length(fp);
        float ring = smoothstep(0.06, 0.0, abs(r - phase * 0.42));
        float drop = ring * (1.0 - phase) * step(0.62, h) * uRain;
        vec2 dir = normalize(fp + vec2(0.0001));
        dx += dir.x * drop * 0.85;
        dz += dir.y * drop * 0.85;
      }

      float nx = -(dx * damp * 6.0 + fx * 2.4);
      float nz = -(dz * damp * 6.0 + fz * 2.4);
      vec3 N = normalize(vec3(nx, 1.0, nz));

      /* 反射：按反射向量的仰角在天顶 / 地平之间取色。
         掠射看到的是地平线的亮色，正射看到的是深水色 —— 这是
         水面"透"的来源，只靠菲涅耳一项做不出来。 */
      vec3 R = reflect(-V, N);
      float up = clamp(R.y, 0.0, 1.0);
      vec3 skyRefl = mix(uSkyBottom, uSkyTop, pow(up, 0.35));

      /* 菲涅耳反射率封顶：不封顶时 10° 掠射角下水面 100% 反射天空，
         整片湖变成一块浅蓝的塑料板。真实湖面还有水色与水草。 */
      float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
      float reflAmt = clamp(0.12 + fres * 0.92, 0.0, 0.60);
      vec3 col = mix(uDeepColor, skyRefl, reflAmt);

      /* 日光碎金：多尺度噪声调制的窄高光，低角度时被拉长成一条光带 */
      vec3 L = normalize(uSunDir);
      vec3 Hv = normalize(L + V);
      float spec = pow(max(dot(N, Hv), 0.0), 380.0);
      float spark = noise(q * 1.9 + vec2(t * 0.6, -t * 0.45));
      spark = smoothstep(0.42, 1.0, spark);
      col += uSunColor * spec * (1.4 + spark * 4.2) * max(L.y, 0.0);

      /* 月光带：夜里高光换成冷色、更宽的一束 */
      if (uNight > 0.01) {
        float mspec = pow(max(dot(N, Hv), 0.0), 90.0);
        col += vec3(0.72, 0.80, 1.0) * mspec * 0.55 * uNight;
        col = mix(col, col * vec3(0.72, 0.82, 1.0), uNight * 0.45);
      }

      /* 整体向雾色靠一点，低角度阳光下水面不发死 */
      col = mix(col, uFogColor, 0.05);

      /* FogExp2 同款衰减，天地无缝 */
      float fogF = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
      col = mix(col, uFogColor, clamp(fogF, 0.0, 1.0));

      gl_FragColor = vec4(col, 1.0);
    }`;

  /* 岸线浅滩：贴着水岸的一圈半透明浅色带。
     水面本身是单张平面，没有"水深"可插值；用一圈带渐变的环
     把岸边的浅水补出来，远看才不是一块塑料板。 */
  const SHORE_VERT = `
    attribute float aT;
    varying float vT;
    void main(){
      vT = aT;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`;

  const SHORE_FRAG = `
    uniform vec3 uShoreColor;
    uniform float uNight;
    varying float vT;
    void main(){
      float a = (1.0 - vT) * 0.42;
      vec3 c = mix(uShoreColor, uShoreColor * vec3(0.55, 0.68, 0.85), uNight);
      gl_FragColor = vec4(c, a);
    }`;

  const UNIFORMS = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.3, 0.9, 0.4) },
    uSunColor: { value: new THREE.Color(0xfff4de) },
    uSkyTop: { value: new THREE.Color(0x6fa8d8) },
    uSkyBottom: { value: new THREE.Color(0xc3cdd8) },
    uDeepColor: { value: new THREE.Color(0x152a2b) },
    uFogColor: { value: new THREE.Color(0xc3cdd8) },
    uFogDensity: { value: 0.00026 },
    uRain: { value: 0 },
    uNight: { value: 0 }
  };

  const SHORE_UNIFORMS = {
    uShoreColor: { value: new THREE.Color(0x5d7f6d) },
    uNight: { value: 0 }
  };

  let material = null;
  let shoreMaterial = null;
  let rainAmt = 0;

  /** 单例：所有水面共用，避免重复编译着色器 */
  GG.water = {
    create() {
      if (material) return material;
      material = new THREE.ShaderMaterial({
        uniforms: UNIFORMS,
        vertexShader: VERT,
        fragmentShader: FRAG,
        fog: false,
        side: THREE.DoubleSide
      });
      UNIFORMS.uRain.value = rainAmt;
      return material;
    },

    /** 岸线浅滩材质（透明、不写深度，压在水面上方 1 cm） */
    createShore() {
      if (shoreMaterial) return shoreMaterial;
      shoreMaterial = new THREE.ShaderMaterial({
        uniforms: SHORE_UNIFORMS,
        vertexShader: SHORE_VERT,
        fragmentShader: SHORE_FRAG,
        transparent: true,
        depthWrite: false,
        fog: false,
        side: THREE.DoubleSide
      });
      return shoreMaterial;
    },

    /** 日照联动：太阳方向 / 日色 / 天空上下色 / 雾色与雾密度 / 夜晚系数 */
    sync(sunDir, sunColor, skyBottom, skyTop, fogColor, fogDensity, night) {
      if (!material) return;
      const u = material.uniforms;
      u.uSunDir.value.copy(sunDir);
      u.uSunColor.value.copy(sunColor);
      if (skyBottom) u.uSkyBottom.value.copy(skyBottom);
      if (skyTop) u.uSkyTop.value.copy(skyTop);
      u.uFogColor.value.copy(fogColor);
      u.uFogDensity.value = fogDensity;
      u.uNight.value = night || 0;
      if (shoreMaterial) {
        SHORE_UNIFORMS.uNight.value = night || 0;
      }
    },

    /** 雨天打开涟漪；材质未创建时先记下，create 时补上 */
    setRain(on) {
      rainAmt = on ? 1 : 0;
      if (material) material.uniforms.uRain.value = rainAmt;
    },

    /** 每帧推进波纹时间 */
    tick(dt) {
      if (material) material.uniforms.uTime.value += dt;
    }
  };
})();
