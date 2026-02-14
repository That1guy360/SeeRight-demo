precision mediump float;
uniform sampler2D u_image;
varying vec2 v_texCoord;

uniform float u_sph;        // spherical strength
uniform float u_cyl;        // cylinder strength
uniform float u_axis;       // axis in radians
uniform vec2  u_eyeOffset;  // normalized eye offset (-1..1)
uniform vec2  u_resolution; // canvas size

vec2 radial_distort(vec2 uv, float k) {
  vec2 center = vec2(0.5, 0.5) + u_eyeOffset * 0.02;
  vec2 v = uv - center;
  float r = length(v);
  float r2 = r * r;
  float factor = 1.0 + k * r2;
  return center + v * factor;
}

vec2 anisotropic_warp(vec2 uv, float cyl, float axis) {
  vec2 center = vec2(0.5, 0.5) + u_eyeOffset * 0.02;
  vec2 v = uv - center;
  float ca = cos(-axis);
  float sa = sin(-axis);
  vec2 vr = vec2(ca * v.x - sa * v.y, sa * v.x + ca * v.y);
  float s = cyl;
  vr.x = vr.x * (1.0 + s);
  float ca2 = cos(axis);
  float sa2 = sin(axis);
  vec2 v2 = vec2(ca2 * vr.x - sa2 * vr.y, sa2 * vr.x + ca2 * vr.y);
  return center + v2;
}

vec4 directional_blur(sampler2D img, vec2 uv, float amount, float axis) {
  int samples = 8;
  vec4 col = vec4(0.0);
  float total = 0.0;
  vec2 dir = vec2(cos(axis), sin(axis)) * amount;
  for (int i = -4; i <= 4; i++) {
    float fi = float(i);
    vec2 sampleUV = uv + dir * fi;
    col += texture2D(img, sampleUV);
    total += 1.0;
  }
  return col / total;
}

void main() {
  vec2 uv = v_texCoord;
  float k = -0.6 * u_sph;
  vec2 uv_rad = radial_distort(uv, k);
  vec2 uv_aniso = anisotropic_warp(uv_rad, u_cyl, u_axis);
  float blurAmount = abs(u_cyl) * 0.01;
  vec4 color;
  if (abs(u_cyl) > 0.001) {
    color = directional_blur(u_image, uv_aniso, blurAmount, u_axis + 1.5708);
  } else {
    color = texture2D(u_image, uv_aniso);
  }
  gl_FragColor = color;
}
