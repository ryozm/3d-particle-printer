// Particle vertex shader
// TODO: 实现粒子打印的顶点着色器

export default /* glsl */ `
  uniform float uTime;
  uniform float uProgress;

  attribute float aDelay;
  attribute float aSpeed;

  varying float vProgress;

  void main() {
    vProgress = clamp((uProgress - aDelay) * aSpeed, 0.0, 1.0);

    vec3 pos = position;
    // TODO: 根据 vProgress 控制粒子位置（打印效果）

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = 2.0;
  }
`
