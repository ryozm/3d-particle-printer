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
  uniform float uDropOffset;

  attribute float aDelay;
  attribute float aSpeed;

  varying float vProgress;
  varying float vAlpha;

  void main() {
    // 每个粒子在不同的进度点开始动画
    // spread 控制延迟占总进度的比例（0.85 = 前 85% 用于分层延迟，后 15% 留给最顶部粒子完成）
    float spread = 0.85;
    float startAt = aDelay * spread;
    float duration = 1.0 - startAt;

    // 确保 uProgress=1 时所有粒子 particleProgress=1
    float particleProgress = clamp((uProgress - startAt) / duration * aSpeed, 0.0, 1.0);
    vProgress = particleProgress;

    vec3 pos = position;

    // 粒子从上方下落到目标位置的动画
    float dropOffset = (1.0 - particleProgress) * uDropOffset;
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
