/**
 * Particle Vertex Shader
 * 
 * 核心逻辑：
 * - 根据 uProgress 和 aDelay 控制粒子显现
 * - 粒子从无到有的缩放动画
 * - 粒子尺寸随打印进度变化
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
    // 计算当前粒子的打印进度
    float particleProgress = clamp((uProgress - aDelay) * aSpeed * 3.0, 0.0, 1.0);
    vProgress = particleProgress;

    // 粒子位置
    vec3 pos = position;

    // 粒子从上方下落到目标位置的动画
    float dropOffset = (1.0 - particleProgress) * 0.5;
    pos.y += dropOffset;

    // 透明度：未打印的粒子完全透明
    vAlpha = smoothstep(0.0, 0.1, particleProgress);

    // 粒子尺寸：打印时有缩放动画
    float scale = smoothstep(0.0, 0.3, particleProgress);
    float finalSize = uPointSize * scale;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // 粒子大小随距离衰减
    gl_PointSize = finalSize * (300.0 / -mvPosition.z);
  }
`
