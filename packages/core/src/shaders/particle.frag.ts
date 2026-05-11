/**
 * Particle Fragment Shader
 * 
 * 核心逻辑：
 * - 圆形粒子渲染
 * - 发光效果（Bloom-like glow）
 * - 颜色渐变（打印区域高亮，边缘发光）
 */
export default /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uGlowIntensity;

  varying float vProgress;
  varying float vAlpha;

  void main() {
    // 圆形粒子 — 距离中心的距离
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    // 丢弃超出圆形范围的像素
    if (dist > 0.5) discard;

    // 核心发光效果
    // 内核：明亮的核心
    float core = smoothstep(0.5, 0.0, dist);
    // 外晕：柔和的边缘发光
    float glow = smoothstep(0.5, 0.1, dist) * uGlowIntensity;

    float brightness = core + glow;

    // 颜色：打印中的粒子更亮
    vec3 color = uColor * (0.5 + vProgress * 0.5);

    // 添加微弱的时间波动（呼吸感）
    float pulse = sin(uTime * 2.0 + vProgress * 10.0) * 0.05 + 1.0;
    color *= pulse;

    // 最终颜色
    float alpha = brightness * vAlpha;

    gl_FragColor = vec4(color * brightness, alpha);
  }
`
