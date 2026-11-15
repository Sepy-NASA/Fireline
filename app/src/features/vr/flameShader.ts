/** Emission/absorption ray integration in linear space. The INTNS palette is
 * illustrative; intensity is not converted into an asserted temperature/RGB. */
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
  uniform float uExposure;
  uniform float uGamma;
  uniform float uQuality;
  uniform float uBurnerRadius;
  uniform int uPalette;
  varying vec3 vLocalPos;

  vec2 intersectBox(vec3 ro, vec3 rd) {
    vec3 inv = 1.0 / (sign(rd) * max(abs(rd), vec3(1e-8)) + vec3(equal(rd, vec3(0.0))) * 1e-8);
    vec3 a = (-0.5 - ro) * inv;
    vec3 b = (0.5 - ro) * inv;
    vec3 mn = min(a, b);
    vec3 mx = max(a, b);
    return vec2(max(max(mn.x, mn.y), mn.z), min(min(mx.x, mx.y), mx.z));
  }
  float solidHit(vec3 ro, vec3 rd) {
    float hit = 1e6;
    float b = dot(ro, rd);
    float c = dot(ro, ro) - uBurnerRadius * uBurnerRadius;
    float d = b*b - c;
    if (c < 0.0) return 0.0;
    if (d > 0.0 && -b-sqrt(d) > 0.0) hit = -b-sqrt(d);
    // Support tube along negative X; matches the separate scene mesh.
    float tubeR = uBurnerRadius * 0.18;
    float qa = dot(rd.yz, rd.yz);
    float qb = dot(ro.yz, rd.yz);
    float qc = dot(ro.yz, ro.yz) - tubeR*tubeR;
    if (qc < 0.0 && ro.x >= -0.5 && ro.x <= 0.0) return 0.0;
    if (abs(rd.x) > 1e-8) {
      for (int cap=0; cap<2; cap++) {
        float capX = cap == 0 ? -0.5 : 0.0;
        float tCap = (capX-ro.x)/rd.x;
        vec2 yz = (ro+rd*tCap).yz;
        if (tCap > 0.0 && dot(yz,yz) <= tubeR*tubeR) hit = min(hit,tCap);
      }
    }
    float qd = qb*qb - qa*qc;
    if (qa > 1e-8 && qd > 0.0) {
      float t = (-qb-sqrt(qd))/qa;
      float x = ro.x + t*rd.x;
      if (t > 0.0 && x >= -0.5 && x <= 0.0) hit = min(hit, t);
    }
    return hit;
  }
  float sampleField(vec2 uv) {
    if (uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
    return mix(texture2D(uFieldA, uv).r, texture2D(uFieldB, uv).r, uMix);
  }
  vec3 tint(float emission) {
    if (uPalette == 1) return vec3(1.0);
    if (uPalette == 2) {
      float t = clamp(log(1.0+emission)/2.0, 0.0, 1.0);
      return mix(vec3(0.12,0.015,0.35), vec3(1.0,0.32,0.025), t);
    }
    return vec3(0.08, 0.25, 1.0);
  }
  void main() {
    vec3 ro = uCamLocal;
    vec3 rd = normalize(vLocalPos - ro);
    vec2 limits = intersectBox(ro, rd);
    float enter = max(limits.x, 0.0);
    // Gas in front of hardware remains visible; integration stops at metal.
    float leave = min(limits.y, solidHit(ro, rd));
    if (leave <= enter) discard;
    int steps = int(clamp(160.0*uQuality, 48.0, 256.0));
    float ds = (leave-enter)/float(steps);
    float attenuation = exp(-max(0.0,uDensity)*ds);
    float segment = uDensity > 1e-5 ? (1.0-attenuation)/uDensity : ds;
    float transmittance = 1.0;
    vec3 radiance = vec3(0.0);
    for (int i=0; i<256; i++) {
      if (i >= steps || transmittance < 0.001) break;
      vec3 p = ro + rd*(enter+(float(i)+0.5)*ds);
      float emission = max(0.0, sampleField(vec2(2.0*length(p.xz), 0.5-p.y))-uThreshold);
      radiance += transmittance * emission * tint(emission) * segment;
      transmittance *= attenuation;
    }
    vec3 mapped = vec3(1.0)-exp(-uExposure*radiance);
    gl_FragColor = vec4(pow(max(mapped,vec3(0.0)), vec3(1.0/uGamma)), 1.0-transmittance);
    #include <colorspace_fragment>
  }
`
