precision mediump float;

/** @resolution */
uniform vec2 u_resolution;

/** @time */
uniform float u_time;

/**
 * @label AI color
 * @color
 * @default #4F69F2
 */
uniform vec3 u_ai;

/**
 * @label Accent
 * @color
 * @default #FF58AE
 */
uniform vec3 u_accent;

/**
 * @label Agent color
 * @color
 * @default #D97757
 */
uniform vec3 u_agent;

/**
 * @label Agent label texture
 */
uniform sampler2D u_label;

/**
 * @label Label width (share of node width)
 * @default 0.12
 * @range 0.05, 0.5
 */
uniform float u_labelW;

/**
 * @label Loop seconds
 * @default 14
 * @range 8, 30
 */
uniform float u_loop;

/**
 * @label Phase offset
 * @default 0
 * @range 0, 30
 */
uniform float u_phase;

/**
 * @label Freeze at phase (1 = on)
 * @default 0
 * @range 0, 1
 */
uniform float u_freeze;

const float PI = 3.14159265;

vec4 over(vec4 top, vec4 base) { return top + base * (1.0 - top.a); }

float sdBox(vec2 p, vec2 c, vec2 h, float r) {
  vec2 d = abs(p - c) - h + vec2(r);
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

float ease4(float x) { x = clamp(x, 0.0, 1.0); return 1.0 - pow(1.0 - x, 4.0); }
float spring(float x) { x = clamp(x, 0.0, 1.0); return 1.0 - exp(-7.0 * x) * cos(9.0 * x); }

vec4 el(int i) {
  if (i == 0) return vec4(0.0, 0.0, 1.0, 0.13);
  if (i == 1) return vec4(0.06, 0.045, 0.22, 0.04);
  if (i == 2) return vec4(0.06, 0.18, 0.88, 0.36);
  if (i == 3) return vec4(0.06, 0.585, 0.25, 0.025);
  if (i == 4) return vec4(0.06, 0.635, 0.80, 0.05);
  if (i == 5) return vec4(0.06, 0.705, 0.55, 0.05);
  if (i == 6) return vec4(0.06, 0.79, 0.75, 0.022);
  return vec4(0.06, 0.855, 0.30, 0.075);
}

vec3 finalCol(int i, vec2 lp) {
  if (i == 0) return vec3(0.925, 0.125, 0.161);
  if (i == 1) return vec3(1.0, 1.0, 1.0);
  if (i == 2) {
    vec3 sky = mix(vec3(0.81, 0.90, 0.97), vec3(0.89, 0.87, 0.97), lp.y);
    float cloud = smoothstep(0.16, 0.12, length((lp - vec2(0.28, 0.38)) * vec2(1.4, 2.6)));
    cloud = max(cloud, smoothstep(0.14, 0.10, length((lp - vec2(0.70, 0.62)) * vec2(1.6, 3.0))));
    sky = mix(sky, vec3(1.0), cloud * 0.9);
    float sun = 1.0 - smoothstep(0.09, 0.10, length((lp - vec2(0.82, 0.30)) * vec2(2.4, 1.0)));
    return mix(sky, vec3(0.97, 0.78, 0.10), sun);
  }
  if (i == 3) return vec3(0.925, 0.125, 0.161);
  if (i == 4 || i == 5) return vec3(0.102, 0.161, 0.282);
  if (i == 6) return vec3(0.62, 0.64, 0.68);
  return vec3(0.97, 0.78, 0.10);
}

float edge(vec2 p, vec2 a, vec2 b, inout float s) {
  vec2 e = b - a; vec2 w = p - a;
  vec2 q = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
  bool c1 = p.y >= a.y; bool c2 = p.y < b.y; bool c3 = e.x * w.y > e.y * w.x;
  if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s *= -1.0;
  return dot(q, q);
}
float sdArrow(vec2 p) {
  vec2 v0 = vec2(0.0); vec2 v1 = vec2(16.0, 6.5); vec2 v2 = vec2(8.2, 8.6); vec2 v3 = vec2(5.8, 16.5);
  float s = 1.0; float d = dot(p, p);
  d = min(d, edge(p, v0, v1, s)); d = min(d, edge(p, v1, v2, s));
  d = min(d, edge(p, v2, v3, s)); d = min(d, edge(p, v3, v0, s));
  return s * sqrt(d);
}
float star(vec2 p) { p = abs(p); return (p.x * 0.35 + p.y) * (p.y * 0.35 + p.x) - 0.35; }

const float T_DRAG0 = 0.45;
const float T_DRAG1 = 1.15;
const float T_LAY = 1.35;
const float T_STEP = 0.18;
const float T_FILL = 2.0;
const float T_REVEAL = 4.15;
const float T_SETTLE = 5.15;
const float T_EDIT = 6.9;
const float T_LAND = 9.25;
const float T_LEAVE = 10.3;

vec2 gLp0;
vec2 gSize;

vec2 relp(vec2 r) { return gLp0 + r * gSize; }

vec4 key(int i) {
  if (i == 0) return vec4(-1.0, 1.35, 1.2, 0.01);
  if (i == 1) return vec4(0.0, 0.0, 0.0, 0.42);
  if (i == 2) return vec4(T_DRAG0, 1.0, 1.0, T_DRAG1 - T_DRAG0);
  if (i >= 3 && i <= 10) {
    vec4 e = el(i - 3);
    float t0 = T_LAY + float(i - 3) * T_STEP;
    return vec4(t0 - 0.17, e.x + 0.03, e.y + e.w * 0.5, 0.15);
  }
  if (i == 11) return vec4(2.85, 0.07, 0.66, 0.2);
  if (i == 12) return vec4(3.1, 0.82, 0.66, 0.5);
  if (i == 13) return vec4(3.65, 0.07, 0.73, 0.15);
  if (i == 14) return vec4(3.82, 0.60, 0.73, 0.32);
  if (i == 15) return vec4(T_REVEAL, 0.08, 0.10, 0.25);
  if (i == 16) return vec4(T_REVEAL + 0.3, 0.95, 0.95, 0.7);
  if (i == 17) return vec4(T_SETTLE + 0.1, 1.14, 0.56, 0.55);
  if (i == 18) return vec4(6.2, 0.58, 0.71, 0.55);
  if (i == 19) return vec4(T_LAND - 0.35, 0.955, 0.035, 0.3);
  return vec4(T_LEAVE, 1.7, -0.25, 0.8);
}

vec2 bend(vec2 a, vec2 b, float e) {
  vec2 d = b - a;
  vec2 c = (a + b) * 0.5 + vec2(-d.y, d.x) * 0.2;
  return mix(mix(a, c, e), mix(c, b, e), e);
}

vec2 cursorAt(float t) {
  vec2 prev = relp(key(0).yz);
  vec2 pos = prev;
  for (int i = 1; i < 21; i++) {
    vec4 k = key(i);
    if (t >= k.x) {
      vec2 tgt = relp(k.yz);
      float e = ease4((t - k.x) / k.w);
      pos = (i == 2) ? mix(prev, tgt, e) : bend(prev, tgt, e);
      prev = tgt;
    }
  }
  float typing = step(2.85, t) * step(t, 4.1);
  pos += vec2(0.0, sin(t * 38.0) * 0.0025) * typing;
  float drift = smoothstep(T_SETTLE + 0.7, T_SETTLE + 1.0, t) * step(t, 6.2) + smoothstep(6.8, 7.0, t) * step(t, T_LAND - 0.35);
  pos += vec2(sin(t * 1.9), cos(t * 1.5)) * 0.004 * drift;
  return pos;
}

float ripple(vec2 q, vec2 c, float t, float t0, float size, float px) {
  float lt = t - t0;
  if (lt < 0.0 || lt > 0.55) return 0.0;
  float r = ease4(lt / 0.55) * size;
  return (1.0 - smoothstep(px * 0.8, px * 2.2, abs(length(q - c) - r))) * (1.0 - lt / 0.55);
}

void main() {
  vec2 res = u_resolution;
  float aspect = res.x / res.y;
  vec2 uv = gl_FragCoord.xy / res; uv.y = 1.0 - uv.y;
  vec2 q = vec2(uv.x * aspect, uv.y);
  float px = 1.0 / res.y;
  float t = u_freeze > 0.5 ? u_phase : mod(u_time + u_phase, u_loop);

  vec2 dg = mod(gl_FragCoord.xy, 22.0) - 11.0;
  float dotm = 1.0 - smoothstep(0.6, 1.6, length(dg));
  vec4 col = vec4(mix(vec3(0.961), vec3(0.84), dotm), 1.0);
  float fade = smoothstep(0.0, 0.3, t) * (1.0 - smoothstep(u_loop - 0.7, u_loop - 0.1, t));

  vec2 bc = vec2(aspect * 0.5, 0.53);
  vec2 bh = vec2(0.30, 0.40);
  vec2 lp0 = bc - bh;
  gLp0 = lp0; gSize = bh * 2.0;
  vec2 rel = (q - lp0) / gSize;
  float bsd = sdBox(q, bc, bh, 0.02);

  vec2 cur = cursorAt(t);
  vec2 curLag = cursorAt(t - 0.07);

  if (t > T_DRAG0 && t < T_DRAG1 + 0.05) {
    vec2 a = lp0; vec2 b = max(cur, lp0 + vec2(0.002));
    vec2 dc = (a + b) * 0.5; vec2 dh = (b - a) * 0.5;
    float dsd = sdBox(q, dc, dh, 0.0);
    col = over(vec4(u_ai, 1.0) * 0.07 * (1.0 - smoothstep(-px, px, dsd)) * fade, col);
    col = over(vec4(u_ai, 1.0) * (1.0 - smoothstep(px * 0.6, px * 1.6, abs(dsd))) * fade, col);
  }

  float done = step(T_DRAG1, t);
  float lift = smoothstep(T_SETTLE - 0.2, T_SETTLE + 0.3, t) * (1.0 - smoothstep(T_SETTLE + 0.3, T_SETTLE + 1.2, t));
  float ink = smoothstep(T_REVEAL, T_REVEAL + 1.0, t);
  float sh = sdBox(q - vec2(0.0, 0.006 + 0.012 * lift), bc, bh, 0.02);
  col = over(vec4(0.0, 0.0, 0.0, 1.0) * (1.0 - smoothstep(-0.01, 0.03 + 0.02 * lift, sh)) * (0.06 + 0.08 * lift) * ink * fade, col);
  float binside = 1.0 - smoothstep(-px, px, bsd);
  col = over(vec4(1.0) * binside * done * fade * mix(0.6, 1.0, ink), col);
  float olA = done * (1.0 - smoothstep(T_SETTLE, T_SETTLE + 0.5, t)) * fade;
  float flash = 1.0 + 2.0 * exp(-(t - T_DRAG1) * 8.0) * done;
  col = over(vec4(u_ai, 1.0) * (1.0 - smoothstep(px * 0.6 * flash, px * 1.8 * flash, abs(bsd))) * olA, col);

  if (t > T_DRAG1 && t < T_REVEAL + 0.6) {
    vec2 dq = q - (lp0 + vec2(0.0, -0.035));
    if (dq.x > 0.0 && dq.x < 0.12 && dq.y > -0.012 && dq.y < 0.012) {
      vec2 cell = mod(dq, 0.012) - 0.006;
      float dm = 1.0 - smoothstep(0.0018, 0.0028, length(cell));
      float wv = 0.2 + 0.8 * pow(sin(fract(dq.x * 6.0 - t * 0.9) * PI), 6.0);
      col = over(vec4(u_ai, 1.0) * dm * wv * fade * (1.0 - smoothstep(T_REVEAL + 0.1, T_REVEAL + 0.6, t)), col);
    }
  }

  float editP = smoothstep(T_EDIT, T_EDIT + 2.0, t);
  float landed = smoothstep(T_LAND, T_LAND + 0.6, t);
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    vec4 e = el(i);
    if (i == 4) e.z = mix(0.80, 0.70, ease4((t - T_EDIT - 0.6) / 1.0));
    if (i == 5) e.z = mix(0.55, 0.78, ease4((t - T_EDIT - 0.9) / 1.0));
    float t0 = T_LAY + fi * T_STEP;
    float sp = spring((t - t0) / 0.6);
    float appear = step(t0, t);
    vec2 c = lp0 + (e.xy + e.zw * 0.5) * gSize;
    vec2 h = e.zw * 0.5 * gSize * mix(0.6, 1.0, sp);
    float r = (i == 7) ? h.y : 0.004;
    float sd = sdBox(q, c, h, r);
    float inside = 1.0 - smoothstep(-px * 0.6, px * 0.6, sd);
    vec2 lp = (q - (c - h)) / (h * 2.0);
    float fillT = smoothstep(T_FILL + fi * T_STEP, T_FILL + 0.4 + fi * T_STEP, t);
    float shim = 0.5 + 0.5 * sin(lp.x * 4.0 + lp.y - t * 4.0);
    vec3 ph = mix(vec3(0.925), vec3(0.97), shim);
    float revealed = smoothstep(0.0, 1.0, clamp((t - T_REVEAL - (rel.x + rel.y) * 0.45) / 0.35, 0.0, 1.0));
    vec3 fc = mix(ph, finalCol(i, lp), revealed);
    if ((i == 4 || i == 5) && editP > 0.0 && landed < 1.0) {
      float sw = 0.5 + 0.5 * sin((lp.x * 2.0 - t * 3.0) * PI);
      fc = mix(fc, mix(u_ai, u_accent, sw), editP * (1.0 - landed));
    }
    col = over(vec4(fc, 1.0) * inside * appear * fillT * fade, col);
    float glint = exp(-pow(((t - T_REVEAL) / 1.0 - (rel.x + rel.y) * 0.45) * 18.0, 2.0)) * inside * appear;
    col = over(vec4(mix(vec3(1.0), u_accent, 0.25), 1.0) * glint * 0.75 * fade, col);
    float line = 1.0 - smoothstep(px * 0.5, px * 1.5, abs(sd));
    col = over(vec4(u_ai, 1.0) * line * appear * olA * 0.85 * (1.0 - smoothstep(T_REVEAL, T_REVEAL + 0.8, t)), col);
    float newest = step(abs(fi - floor((t - T_LAY) / T_STEP)), 0.5) * step(t, T_LAY + 8.0 * T_STEP + 0.3);
    if (newest > 0.5 && appear > 0.5) {
      for (int j = 0; j < 4; j++) {
        vec2 cc = (c - h) + vec2(mod(float(j), 2.0), floor(float(j) / 2.0)) * h * 2.0;
        vec2 hb = abs(q - cc) - vec2(px * 3.0);
        float hsd = max(hb.x, hb.y);
        float hf = 1.0 - smoothstep(-px * 0.5, px * 0.5, hsd);
        float hl = 1.0 - smoothstep(-px * 1.4, -px * 0.4, hsd);
        col = over(vec4(1.0) * hl * fade, col);
        col = over(vec4(u_ai, 1.0) * (hf - hl) * fade, col);
      }
    }
    col = over(vec4(u_agent, 1.0) * ripple(q, lp0 + (e.xy + vec2(0.03, e.w * 0.5)) * gSize, t, t0 - 0.02, 0.03, px) * 0.8 * fade, col);
  }

  col = over(vec4(u_agent, 1.0) * ripple(q, lp0, t, T_DRAG0, 0.05, px) * fade, col);
  col = over(vec4(u_agent, 1.0) * ripple(q, lp0 + gSize, t, T_DRAG1, 0.06, px) * fade, col);

  vec2 gc = lp0 + vec2(0.06 + 0.40, 0.635 + 0.06) * gSize;
  vec2 gh = vec2(0.41, 0.075) * gSize + vec2(0.012);
  float selA = smoothstep(6.6, 6.9, t) * (1.0 - smoothstep(T_LAND - 0.4, T_LAND, t)) * fade;
  float gsd = sdBox(q, gc, gh, 0.004);
  float gline = 1.0 - smoothstep(px * 0.6, px * 1.8, abs(gsd));
  float along = abs(q.x - gc.x) / gh.x > abs(q.y - gc.y) / gh.y ? q.y : q.x;
  float dash = step(0.45, fract((along - t * 0.05) / (px * 10.0)));
  col = over(vec4(u_agent, 1.0) * gline * dash * selA, col);

  float glowA = editP * (1.0 - landed) * fade;
  float pulse = 0.6 + 0.4 * sin(t * 6.0);
  float glow = exp(-max(bsd, 0.0) * 40.0) * step(0.0, bsd);
  col = over(vec4(u_ai, 1.0) * glow * 0.35 * pulse * glowA, col);
  col = over(vec4(u_ai, 1.0) * (1.0 - smoothstep(px, px * 2.5, abs(bsd))) * glowA * 0.7, col);

  vec2 corner = relp(vec2(0.955, 0.035));
  float lt = t - T_LAND;
  if (lt > 0.0 && lt < 1.4) {
    float rr = ease4(lt / 1.0) * 0.12;
    float ring = 1.0 - smoothstep(px * 0.8, px * 2.4, abs(length(q - corner) - rr));
    col = over(vec4(u_ai, 1.0) * ring * (1.0 - lt / 1.4) * fade, col);
    for (int k = 0; k < 7; k++) {
      float a = float(k) / 7.0 * 2.0 * PI + 0.4;
      vec2 sp2 = corner + vec2(cos(a), sin(a)) * ease4(lt / 0.9) * 0.09;
      float sz = 0.009 * (1.0 - lt / 1.4);
      float sm = 1.0 - smoothstep(-0.05, 0.05, star((q - sp2) / max(sz, 0.0001)));
      col = over(vec4(mod(float(k), 2.0) < 0.5 ? u_ai : u_accent, 1.0) * sm * fade, col);
    }
  }
  float ed = 1.0 - smoothstep(0.009 - px, 0.009 + px, length(q - corner));
  col = over(vec4(u_ai, 1.0) * ed * landed * fade * spring((t - T_LAND - 0.1) / 0.6), col);

  float cA = (1.0 - smoothstep(T_LEAVE + 0.4, T_LEAVE + 0.8, t)) * fade;
  float scale = 0.026 / 17.0;
  float press = 1.0 - 0.12 * (step(T_DRAG0, t) * step(t, T_DRAG1));
  float labelW = u_labelW * aspect;
  vec2 ts = vec2(textureSize(u_label, 0));
  float labelH = labelW * ts.y / ts.x;
  vec2 l0 = curLag + vec2(0.017, 0.024);
  vec2 luv = (q - l0) / vec2(labelW, labelH);
  if (luv.x >= 0.0 && luv.x <= 1.0 && luv.y >= 0.0 && luv.y <= 1.0) {
    vec4 lc = texture2D(u_label, luv);
    col = over(vec4(lc.rgb * lc.a, lc.a) * cA, col);
  }
  float sa = sdArrow((q - cur) / (scale * press)) * scale * press;
  float shd = sdArrow((q - cur - vec2(px, px * 2.5)) / scale) * scale;
  col = over(vec4(0.0, 0.0, 0.0, 1.0) * (1.0 - smoothstep(-px, px * 4.0, shd)) * 0.2 * step(0.0, sa) * cA, col);
  col = over(vec4(1.0) * (1.0 - smoothstep(px * 1.4, px * 2.6, sa)) * step(0.0, sa) * cA, col);
  col = over(vec4(u_agent, 1.0) * (1.0 - smoothstep(-px * 0.6, px * 0.6, sa)) * cA, col);

  gl_FragColor = col;
}
