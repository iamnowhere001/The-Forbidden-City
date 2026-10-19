/* ============================================================
   水面材质 —— 程序化波纹 + 菲涅耳 + 日光高光的自定义着色器
   护城河与内金水河共用一份材质。
   与日照联动：renderer.setSun() 调用 GG.water.sync(...)，
   主循环调用 GG.water.tick(dt)（?still=1 时不推进时间）。
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
    uniform vec3 uSkyColor;
    uniform vec3 uDeepColor;
    uniform vec3 uFogColor;
    uniform float uFogDensity;
    uniform float uRain;
    varying vec3 vWorld;

    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

    void main(){
      vec3 toCam = cameraPosition - vWorld;
      float dist = length(toCam);
      vec3 V = toCam / max(dist, 0.001);

      /* 波纹斜率：远处抹平，避免采样网纹与远距离闪烁 */
      float damp = exp(-dist * 0.0055);
      vec2 q = vWorld.xz;
      float t = uTime;
      float dx = cos(q.x * 1.15 + t * 1.25) * 1.15 * 0.050
         + cos((q.x + q.y) * 0.42 + t * 0.70) * 0.42 * 0.060
         + cos((q.x - q.y) * 0.33 - t * 0.55) * 0.33 * 0.052;
      float dz = cos(q.y * 0.95 - t * 0.95) * 0.95 * 0.044
               + cos((q.x + q.y) * 0.42 + t * 0.70) * 0.42 * 0.060
               - cos((q.x - q.y) * 0.33 - t * 0.55) * 0.33 * 0.052;

      /* 近景细纹：60 米内可见，远处迅速衰减；不做镜面 pass 的补偿 */
      float nearFade = exp(-dist * 0.040);
      dx += (cos(q.x * 7.3 + t * 3.1) * 0.0062 + cos(q.y * 9.1 - t * 2.4) * 0.0048) * nearFade;
      dz += (cos(q.y * 8.7 - t * 2.9) * 0.0058 + cos(q.x * 10.3 + t * 3.4) * 0.0044) * nearFade;

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

      vec3 N = normalize(vec3(-dx * damp * 6.0, 1.0, -dz * damp * 6.0));

      /* 菲涅耳：掠射角反射天空，正射角透出深水色 */
      float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
      vec3 col = mix(uDeepColor, uSkyColor, clamp(0.10 + fres * 0.95, 0.0, 1.0));

      /* 日光高光：窄高光形成碎金反光 */
      vec3 L = normalize(uSunDir);
      vec3 Hv = normalize(L + V);
      float spec = pow(max(dot(N, Hv), 0.0), 420.0);
      col += uSunColor * spec * 2.2 * max(L.y, 0.0);

      /* 整体向雾色靠一点，低角度阳光下水面不发死 */
      col = mix(col, uFogColor, 0.06);

      /* FogExp2 同款衰减，天地无缝 */
      float fogF = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
      col = mix(col, uFogColor, clamp(fogF, 0.0, 1.0));

      gl_FragColor = vec4(col, 1.0);
    }`;

  const UNIFORMS = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.3, 0.9, 0.4) },
    uSunColor: { value: new THREE.Color(0xfff4de) },
    uSkyColor: { value: new THREE.Color(0xc3cdd8) },
    uDeepColor: { value: new THREE.Color(0x223c46) },
    uFogColor: { value: new THREE.Color(0xc3cdd8) },
    uFogDensity: { value: 0.00026 },
    uRain: { value: 0 }
  };

  let material = null;
  let rainAmt = 0;

  /** 单例：护城河与金水河共用，避免重复编译着色器 */
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

    /** 日照联动：太阳方向 / 日色 / 天空色 / 雾色与雾密度 */
    sync(sunDir, sunColor, skyColor, fogColor, fogDensity) {
      if (!material) return;
      const u = material.uniforms;
      u.uSunDir.value.copy(sunDir);
      u.uSunColor.value.copy(sunColor);
      u.uSkyColor.value.copy(skyColor);
      u.uFogColor.value.copy(fogColor);
      u.uFogDensity.value = fogDensity;
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
