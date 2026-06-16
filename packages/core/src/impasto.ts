// ─── Impasto (oil-paint relief) lighting — Phase A ──────────────────────────────────────────────────
//
// ONE SkSL source, compiled by BOTH backends (CanvasKit on web, react-native-skia on native), so the
// oil stroke is lit identically on every platform. It reads a flat ALBEDO (the paint colour) plus a
// single-channel HEIGHT (thickness) buffer, derives a surface normal from the height gradient, and adds
// a directional diffuse + specular term so thick paint reads as raised 3D relief with ridge highlights.
//
// CRITICAL no-op property: the shading is the DELTA from a flat surface (normal = +Z). Where the height
// is flat — i.e. zero-height non-oil pixels, OR the interior of a uniformly-thick region — the gradient
// is zero, the normal is +Z, both delta terms are exactly 0, and the albedo passes through UNCHANGED.
// That is what lets us run the pass over a whole layer without disturbing any other tool's pixels.
//
// Height is read from the .a (coverage) channel of the height buffer: oil dabs are painted white with a
// soft round falloff, so coverage accumulates (impasto build-up, saturating at 1) and its spatial
// gradient gives the relief.
//
// Uniform layout note: only `float2` + scalars are used (no float3/float4) so the flat uniform array is
// tightly packed in declaration order with no std140 alignment surprises across CanvasKit / RN-Skia.

export const IMPASTO_SKSL = `
uniform shader albedo;
uniform shader height;
uniform float2 texel;     // (1/width, 1/height) in eval() coordinate space
uniform float lx;         // light direction (normalised), pointing toward the light
uniform float ly;
uniform float lz;
uniform float heightScale; // amplifies the height gradient into a normal slope
uniform float diffuse;     // diffuse delta strength
uniform float spec;        // specular strength
uniform float shininess;   // specular exponent

half4 main(float2 coord) {
  half4 c = albedo.eval(coord);                       // premultiplied albedo

  // Central-difference gradient of the height field.
  float hl = height.eval(coord - float2(texel.x, 0.0)).a;
  float hr = height.eval(coord + float2(texel.x, 0.0)).a;
  float hu = height.eval(coord - float2(0.0, texel.y)).a;
  float hd = height.eval(coord + float2(0.0, texel.y)).a;
  float gx = (hr - hl) * heightScale;
  float gy = (hd - hu) * heightScale;

  float3 N = normalize(float3(-gx, -gy, 1.0));
  float3 L = normalize(float3(lx, ly, lz));
  float3 V = float3(0.0, 0.0, 1.0);
  float3 H = normalize(L + V);

  // Shading as a DELTA from the flat surface (N = +Z) → exact no-op when the height is flat.
  float dN = max(dot(N, L), 0.0) - max(L.z, 0.0);
  float sN = pow(max(dot(N, H), 0.0), shininess) - pow(max(H.z, 0.0), shininess);
  float shade = diffuse * dN + spec * sN;

  // Premultiplied: scale the additive term by coverage (c.a) and keep the result a valid premul colour.
  half3 rgb = clamp(c.rgb + half3(c.a) * half(shade), half3(0.0), half3(c.a));
  return half4(rgb, c.a);
}
`

export interface ImpastoParams {
  /** Light direction (will be normalised), pointing toward the light. Default = upper-left, raised. */
  lightDir: [number, number, number]
  /** Amplifies the height gradient → steeper normals → stronger relief. */
  heightScale: number
  /** Diffuse delta strength. */
  diffuse: number
  /** Specular strength (ridge sheen). */
  spec: number
  /** Specular exponent (higher = tighter highlight). */
  shininess: number
}

export const DEFAULT_IMPASTO: ImpastoParams = {
  lightDir: [-0.55, -0.7, 0.45],
  heightScale: 1400,
  diffuse: 0.9,
  spec: 0.6,
  shininess: 18,
}

/**
 * Build the flat uniform array for IMPASTO_SKSL, in declaration order. `w`/`h` are the buffer size in
 * pixels; the eval() coordinate space is pixel space, so a one-texel step is 1px.
 */
export function impastoUniforms(p: ImpastoParams, w: number, h: number): number[] {
  const [lx, ly, lz] = p.lightDir
  const n = Math.hypot(lx, ly, lz) || 1
  return [
    1 / w, 1 / h,        // texel
    lx / n, ly / n, lz / n,
    p.heightScale,
    p.diffuse,
    p.spec,
    p.shininess,
  ]
}
