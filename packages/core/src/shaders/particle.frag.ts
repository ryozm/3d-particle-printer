// Particle fragment shader
// TODO: 实现粒子打印的片元着色器

export default /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;

  varying float vProgress;

  void main() {
    // 圆形粒子
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    // TODO: 发光、颜色渐变等效果
    gl_FragColor = vec4(uColor, vProgress);
  }
`
