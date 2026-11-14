/* ————————————————————————————————————————————————————————————
   GLSL for the axisymmetric flame volume, rendered by ray-marching
   the unit box [-0.5, 0.5]³.

   Follows the reference mapping from the PSI-159 brief (§6):
     r = 2·length(p.xz)   → radial texture coordinate (0..1)
     v = 0.5 − p.y        → axial texture coordinate (0 top .. 1 bottom)

   The field ε(r,v) is stored in two 2D LUTs (adjacent frames) and
   interpolated in time. Weak signal is thresholded ONLY here (visual
   choice), colours are explicitly false-colour — INTNS carries no
   real colour or temperature.
   ———————————————————————————————————————————————————————————— */

export const FLAME_VERTEX = /* glsl */ `
  varying vec3 vLocalPos;
  void main() {
    vLocalPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const FLAME_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform vec3 uCamLocal;
  uniform sampler2D uFieldA;
  uniform sampler2D uFieldB;
  uniform float uMix;
  uniform float uThreshold;
  uniform float uDensity;
  uniform float uGamma;
  uniform float uQuality;
  uniform int uPalette;

  varying vec3 vLocalPos;

  /* ray vs AABB [-0.5, 0.5] — returns (enter, exit) */
  vec2 intersectBox(vec3 ro, vec3 rd) {
    vec3 inv = 1.0 / rd;
    vec3 t0 = (-0.5 - ro) * inv;
    vec3 t1 = (0.5 - ro) * inv;
    vec3 mn = min(t0, t1);
    vec3 mx = max(t0, t1);
    float tEnter = max(max(mn.x, mn.y), mn.z);
    float tExit = min(min(mx.x, mx.y), mx.z);
    return vec2(tEnter, tExit);
  }

  float sampleField(vec2 uv) {
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
    float a = texture(uFieldA, uv).r;
    float b = texture(uFieldB, uv).r;
    return mix(a, b, uMix);
  }

  /* false-colour ramps — NOT temperature / NOT measured RGB */
  vec3 flameColor(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c = vec3(0.0);
    c = mix(c, vec3(0.60, 0.05, 0.02), smoothstep(0.00, 0.15, t));
    c = mix(c, vec3(1.00, 0.28, 0.02), smoothstep(0.10, 0.40, t));
    c = mix(c, vec3(1.00, 0.68, 0.10), smoothstep(0.35, 0.70, t));
    c = mix(c, vec3(1.00, 0.95, 0.55), smoothstep(0.65, 0.90, t));
    c = mix(c, vec3(1.00, 1.00, 1.00), smoothstep(0.88, 1.00, t));
    return c;
  }

  vec3 infernoColor(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c = vec3(0.0);
    c = mix(c, vec3(0.01, 0.01, 0.10), smoothstep(0.00, 0.15, t));
    c = mix(c, vec3(0.25, 0.05, 0.45), smoothstep(0.10, 0.35, t));
    c = mix(c, vec3(0.70, 0.15, 0.40), smoothstep(0.30, 0.55, t));
    c = mix(c, vec3(0.98, 0.35, 0.10), smoothstep(0.50, 0.72, t));
    c = mix(c, vec3(0.99, 0.80, 0.15), smoothstep(0.68, 0.88, t));
    c = mix(c, vec3(1.00, 1.00, 0.98), smoothstep(0.85, 1.00, t));
    return c;
  }

  vec3 iceColor(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c = vec3(0.0);
    c = mix(c, vec3(0.00, 0.05, 0.25), smoothstep(0.00, 0.30, t));
    c = mix(c, vec3(0.10, 0.45, 0.95), smoothstep(0.25, 0.60, t));
    c = mix(c, vec3(0.40, 0.85, 1.00), smoothstep(0.55, 0.85, t));
    c = mix(c, vec3(1.00, 1.00, 1.00), smoothstep(0.82, 1.00, t));
    return c;
  }

  vec3 falseColor(float x) {
    if (uPalette == 1) return infernoColor(x);
    if (uPalette == 2) return iceColor(x);
    return flameColor(x);
  }

  void main() {
    vec3 ro = uCamLocal;
    vec3 rd = normalize(vLocalPos - uCamLocal);
    vec2 tt = intersectBox(ro, rd);
    float tEnter = max(tt.x, 0.0);
    float tExit = tt.y;
    if (tExit <= tEnter) discard;

    int steps = int(160.0 * uQuality);
    steps = clamp(steps, 32, 256);
    float stepLength = (tExit - tEnter) / float(steps);

    /* dither jitter to suppress banding */
    float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    float t = tEnter + stepLength * (0.5 + jitter * 0.5);

    vec3 acc = vec3(0.0);
    float transmittance = 1.0;

    for (int i = 0; i < 256; i++) {
      if (i >= steps) break;
      if (t > tExit || transmittance < 0.02) break;

      vec3 p = ro + rd * t;
      float r = 2.0 * length(p.xz);
      float v = 0.5 - p.y;
      float val = sampleField(vec2(r, v));

      /* weak-signal threshold — visualisation only */
      val = clamp((val - uThreshold) / (1.0 - uThreshold), 0.0, 1.0);

      if (val > 0.001) {
        float alpha = 1.0 - exp(-uDensity * val * stepLength);
        vec3 col = falseColor(pow(val, 1.0 / uGamma));
        acc += transmittance * alpha * col;
        transmittance *= (1.0 - alpha);
      }
      t += stepLength;
    }

    gl_FragColor = vec4(acc, 1.0);
  }
`
