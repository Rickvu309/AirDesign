precision mediump float;

/** @resolution */
uniform vec2 u_resolution;

/** @time */
uniform float u_time;

/**
 * @label Outline color
 * @color
 * @default #4F69F2
 */
uniform vec3 u_line;

/**
 * @label Loop seconds
 * @default 10
 * @range 4, 20
 */
uniform float u_loop;

/**
 * @label Phase offset
 * @default 0
 * @range 0, 20
 */
uniform float u_phase;

/**
 * @label Freeze at phase (1 = on)
 * @default 0
 * @range 0, 1
 */
uniform float u_freeze;

vec4 box(int i) {
  if (i == 0) return vec4(0.0, 0.0, 1.0, 0.09);
  if (i == 1) return vec4(0.06, 0.12, 0.88, 0.27);
  if (i == 2) return vec4(0.06, 0.43, 0.80, 0.045);
  if (i == 3) return vec4(0.06, 0.495, 0.58, 0.045);
  if (i == 4) return vec4(0.06, 0.57, 0.86, 0.022);
  if (i == 5) return vec4(0.06, 0.61, 0.70, 0.022);
  if (i == 6) return vec4(0.06, 0.67, 0.40, 0.06);
  if (i == 7) return vec4(0.06, 0.77, 0.42, 0.19);
  return vec4(0.52, 0.77, 0.42, 0.19);
}

vec3 finalColor(int i, vec2 uv) {
  if (i == 0) return vec3(0.925, 0.125, 0.161);
  if (i == 1) {
    vec3 a = vec3(0.81, 0.90, 0.97);
    vec3 b = vec3(0.98, 0.78, 0.55);
    return mix(a, b, uv.y * 0.8 + uv.x * 0.3);
  }
  if (i == 2 || i == 3) return vec3(0.10, 0.16, 0.28);
  if (i == 4 || i == 5) return vec3(0.62, 0.64, 0.68);
  if (i == 6) return vec3(0.97, 0.78, 0.10);
  return vec3(0.93, 0.95, 0.98);
}

vec4 over(vec4 top, vec4 base) {
  return top + base * (1.0 - top.a);
}

void main() {
  vec2 res = u_resolution;
  vec2 uv = gl_FragCoord.xy / res;
  uv.y = 1.0 - uv.y;
  float px = 1.0 / res.y;
  float aspect = res.x / res.y;
  vec2 q = vec2(uv.x * aspect, uv.y);
  float t = u_freeze > 0.5 ? u_phase : mod(u_time + u_phase, u_loop);
  float out_ = 1.0 - smoothstep(u_loop - 0.6, u_loop - 0.1, t);
  float real = smoothstep(5.6, 6.4, t);
  vec4 col = vec4(0.0);
  float active = floor(t / 0.45);

  for (int i = 0; i < 9; i++) {
    vec4 bx = box(i);
    float fi = float(i);
    float t0 = 0.3 + fi * 0.45;
    float appear = smoothstep(t0, t0 + 0.18, t);
    float filled = smoothstep(t0 + 1.4, t0 + 1.9, t);
    vec2 c = vec2((bx.x + bx.z * 0.5) * aspect, bx.y + bx.w * 0.5);
    vec2 h = vec2(bx.z * 0.5 * aspect, bx.w * 0.5);
    h *= mix(0.92, 1.0, appear);
    vec2 d = abs(q - c) - h;
    float sd = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
    float inside = 1.0 - smoothstep(-px * 0.5, px * 0.5, sd);
    vec2 local = (q - (c - h)) / (h * 2.0);
    float shimmer = 0.5 + 0.5 * sin((local.x * 3.0 - t * 2.5));
    vec3 ph = mix(vec3(0.929), vec3(0.965), shimmer);
    vec3 fc = mix(ph, finalColor(i, local), real);
    col = over(vec4(fc, 1.0) * inside * filled * out_, col);
    float lineA = appear * (1.0 - smoothstep(6.6, 7.4, t)) * out_;
    float line = 1.0 - smoothstep(px * 0.5, px * 1.5, abs(sd));
    col = over(vec4(u_line, 1.0) * line * lineA * 0.9, col);
    if (abs(fi - min(active, 8.0)) < 0.5 && t < 6.6) {
      vec2 corner = c - h;
      float hs = px * 3.0;
      for (int j = 0; j < 4; j++) {
        vec2 cc = corner + vec2(mod(float(j), 2.0), floor(float(j) / 2.0)) * h * 2.0;
        vec2 hb = abs(q - cc) - vec2(hs);
        float hsd = max(hb.x, hb.y);
        float hf = 1.0 - smoothstep(-px * 0.5, px * 0.5, hsd);
        float hl = 1.0 - smoothstep(-px * 1.4, -px * 0.4, hsd);
        col = over(vec4(1.0) * hl * out_, col);
        col = over(vec4(u_line, 1.0) * (hf - hl) * out_, col);
      }
    }
  }
  gl_FragColor = col;
}
