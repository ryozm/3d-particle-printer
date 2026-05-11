/**
 * Particle Vertex Shader
 */
export default /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uPointSize;

  attribute float aDelay;
  attribute float aSpeed;

  varying float vProgress;
  varying float vAlpha;

  void main() {
    float particleProgress = clamp((uProgress - aDelay) * aSpeed * 3.0, 0.0, 1.0);
    vProgress = particleProgress;

    vec3 pos = position;

    // 粒子从上方下落到目标位置
    float dropOffset = (1.0 - particleProgress) * 0.5;
    pos.y += dropOffset;

    vAlpha = smoothstep(0.0, 0.1, particleProgress);

    float scale = smoothstep(0.0, 0.3, particleProgress);
    float finalSize = uPointSize * scale;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = finalSize * (300.0 / -mvPosition.z);
  }
`
