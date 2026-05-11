/**
 * Particle Fragment Shader
 */
export default /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;

  varying float vProgress;
  varying float vAlpha;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    if (dist > 0.5) discard;

    float core = smoothstep(0.5, 0.0, dist);
    float glow = smoothstep(0.5, 0.1, dist) * 0.6;
    float brightness = core + glow;

    vec3 color = uColor * (0.5 + vProgress * 0.5);
    float pulse = sin(uTime * 2.0 + vProgress * 10.0) * 0.05 + 1.0;
    color *= pulse;

    float alpha = brightness * vAlpha;
    gl_FragColor = vec4(color * brightness, alpha);
  }
`
