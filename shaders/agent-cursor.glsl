precision mediump float;

/** @resolution */
uniform vec2 u_resolution;

/** @time */
uniform float u_time;

/**
 * @label Agent color
 * @color
 * @default #D97757
 */
uniform vec3 u_color;

/**
 * @label Label texture
 */
uniform sampler2D u_label;

/**
 * @label Label width (share of node width)
 * @default 0.17
 * @range 0.05, 0.6
 */
uniform float u_labelW;

/**
 * @label Pointer size (share of node height)
 * @default 0.05
 * @range 0.02, 0.2
 */
uniform float u_size;

/**
 * @label Seconds per hop
 * @default 2.4
 * @range 1, 8
 */
uniform float u_hop;

/**
 * @label Phase offset
 * @default 0
 * @range 0, 10
 */
uniform float u_phase;

/**
 * @label Waypoint 1
 */
uniform vec2 u_p0;
/**
 * @label Waypoint 2
 */
uniform vec2 u_p1;
/**
 * @label Waypoint 3
 */
uniform vec2 u_p2;
/**
 * @label Waypoint 4
 */
uniform vec2 u_p3;

/**
 * @label Marquee half size (height units, 0 hides)
 */
uniform vec2 u_rect;

/**
 * @label Marquee offset from tip
 */
uniform vec2 u_rectOff;

vec2 wp(float i) {
  if (i < 0.5) return u_p0;
  if (i < 1.5) return u_p1;
  if (i < 2.5) return u_p2;
  return u_p3;
}

float edge(vec2 p, vec2 a, vec2 b, inout float s) {
  vec2 e = b - a;
  vec2 w = p - a;
  vec2 q = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
  bool c1 = p.y >= a.y;
  bool c2 = p.y < b.y;
  bool c3 = e.x * w.y > e.y * w.x;
  if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s *= -1.0;
  return dot(q, q);
}

float sdArrow(vec2 p) {
  vec2 v0 = vec2(0.0, 0.0);
  vec2 v1 = vec2(16.0, 6.5);
  vec2 v2 = vec2(8.2, 8.6);
  vec2 v3 = vec2(5.8, 16.5);
  float s = 1.0;
  float d = dot(p - v0, p - v0);
  d = min(d, edge(p, v0, v1, s));
  d = min(d, edge(p, v1, v2, s));
  d = min(d, edge(p, v2, v3, s));
  d = min(d, edge(p, v3, v0, s));
  return s * sqrt(d);
}

vec4 over(vec4 top, vec4 base) {
  return top + base * (1.0 - top.a);
}

vec2 curve(vec2 a, vec2 b, float e) {
  vec2 m = (a + b) * 0.5;
  vec2 d = b - a;
  vec2 c = m + vec2(-d.y, d.x) * 0.22;
  return mix(mix(a, c, e), mix(c, b, e), e);
}

void main() {
  float aspect = u_resolution.x / u_resolution.y;
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.y = 1.0 - uv.y;
  vec2 q = vec2(uv.x * aspect, uv.y);
  float px = 1.0 / u_resolution.y;

  float t = u_time + u_phase;
  float seg = floor(t / u_hop);
  float local = fract(t / u_hop) * u_hop;
  vec2 a = wp(mod(seg, 4.0));
  vec2 b = wp(mod(seg + 1.0, 4.0));
  a.x *= aspect;
  b.x *= aspect;

  float k = clamp(local / 0.85, 0.0, 1.0);
  float e = 1.0 - pow(1.0 - k, 4.0);
  float k2 = clamp((local - 0.07) / 0.95, 0.0, 1.0);
  float e2 = 1.0 - pow(1.0 - k2, 3.0);
  float dwell = smoothstep(0.85, 1.2, local);
  vec2 hover = vec2(sin(t * 1.9), cos(t * 1.4)) * 0.004 * dwell;
  vec2 tip = curve(a, b, e) + hover;
  vec2 tag = curve(a, b, e2) + hover;

  vec4 col = vec4(0.0);

  if (u_rect.x > 0.0) {
    float fadeIn = smoothstep(0.9, 1.25, local) * (1.0 - smoothstep(u_hop - 0.3, u_hop - 0.05, local));
    vec2 rc = b + u_rectOff + u_rect;
    vec2 bb = abs(q - rc) - u_rect;
    float sd = length(max(bb, 0.0)) + min(max(bb.x, bb.y), 0.0);
    float inside = 1.0 - smoothstep(-px, px, sd);
    col = over(vec4(u_color, 1.0) * 0.08 * inside * fadeIn, col);
    float line = 1.0 - smoothstep(px * 0.6, px * 1.6, abs(sd));
    float along = abs(bb.x) > abs(bb.y) ? q.y : q.x;
    float dash = step(0.45, fract((along - u_time * 0.05) / (px * 10.0)));
    col = over(vec4(u_color, 1.0) * line * dash * fadeIn, col);
    vec2 corner = rc - u_rect;
    float hs = px * 3.5;
    for (int i = 0; i < 4; i++) {
      vec2 cc = corner + vec2(mod(float(i), 2.0), floor(float(i) / 2.0)) * u_rect * 2.0;
      vec2 hb = abs(q - cc) - vec2(hs);
      float hsd = max(hb.x, hb.y);
      float hf = 1.0 - smoothstep(-px * 0.5, px * 0.5, hsd);
      float hl = 1.0 - smoothstep(-px * 1.5, -px * 0.5, hsd);
      col = over(vec4(u_color, 1.0) * (hf - hl) * fadeIn, col);
      col = over(vec4(1.0) * hl * fadeIn, col);
    }
  }

  float rip = local - 0.82;
  if (rip > 0.0 && rip < 0.6) {
    float r = rip * 0.09;
    float ring = 1.0 - smoothstep(px * 0.8, px * 2.2, abs(length(q - b) - r));
    col = over(vec4(u_color, 1.0) * ring * (1.0 - rip / 0.6) * 0.8, col);
  }

  float labelW = u_labelW * aspect;
  vec2 ts = vec2(textureSize(u_label, 0));
  float labelH = labelW * ts.y / ts.x;
  vec2 l0 = tag + vec2(u_size * 0.65, u_size * 0.95);
  vec2 luv = (q - l0) / vec2(labelW, labelH);
  if (luv.x >= 0.0 && luv.x <= 1.0 && luv.y >= 0.0 && luv.y <= 1.0) {
    vec4 lc = texture2D(u_label, luv);
    col = over(vec4(lc.rgb * lc.a, lc.a), col);
  }

  float scale = u_size / 17.0;
  float sa = sdArrow((q - tip) / scale) * scale;
  float sh = sdArrow((q - tip - vec2(px * 1.0, px * 2.5)) / scale) * scale;
  float shadow = (1.0 - smoothstep(-px * 1.0, px * 4.0, sh)) * 0.22;
  col = over(vec4(0.0, 0.0, 0.0, 1.0) * shadow * step(0.0, sa), col);
  float outline = 1.0 - smoothstep(px * 1.4, px * 2.6, sa);
  col = over(vec4(1.0) * outline * step(0.0, sa), col);
  float fill = 1.0 - smoothstep(-px * 0.6, px * 0.6, sa);
  col = over(vec4(u_color, 1.0) * fill, col);

  gl_FragColor = col;
}
