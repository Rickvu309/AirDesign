precision mediump float;

// Dashed outline that draws itself open from the top-left corner.
// Use as a stroke paint. The box is clipped open, never scaled, so the
// dashes keep their length.

/** @resolution */
uniform vec2 u_resolution;

/** @time */
uniform float u_time;

/**
 * @label Color
 * @color
 * @default #4F69F2
 */
uniform vec3 u_color;

/**
 * @label Dash (px)
 * @default 4
 * @range 1, 20
 */
uniform float u_dash;

/**
 * @label Gap (px)
 * @default 3
 * @range 1, 20
 */
uniform float u_gap;

/**
 * @label Progress (0 corner patch, 1 fully open)
 * @default 1
 * @range 0, 1
 */
uniform float u_progress;

/**
 * @label Start patch width (px)
 * @default 14
 * @range 2, 60
 */
uniform float u_startW;

/**
 * @label Start patch height (px)
 * @default 12
 * @range 2, 60
 */
uniform float u_startH;

/**
 * @label Loop (1 = replay the draw every 2 s)
 * @default 0
 * @range 0, 1
 */
uniform float u_loop;

// cubic-bezier(.3, .7, .25, 1): fast start, soft landing
float easeDraw(float x) {
  float lo = 0.0, hi = 1.0;
  for (int i = 0; i < 24; i++) {
    float m = 0.5 * (lo + hi);
    float bx = 3.0 * (1.0 - m) * (1.0 - m) * m * 0.3 + 3.0 * (1.0 - m) * m * m * 0.25 + m * m * m;
    if (bx < x) lo = m; else hi = m;
  }
  float s = 0.5 * (lo + hi);
  return 3.0 * (1.0 - s) * (1.0 - s) * s * 0.7 + 3.0 * (1.0 - s) * s * s + s * s * s;
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);

  float p = u_progress;
  float fade = 1.0;
  if (u_loop > 0.5) {
    float t = mod(u_time, 2.0);
    p = easeDraw(clamp(t / 0.52, 0.0, 1.0));
    fade = clamp(t / 0.12, 0.0, 1.0);
  }

  // Dashes run along whichever edge is nearer
  float dx = min(frag.x, u_resolution.x - frag.x);
  float dy = min(frag.y, u_resolution.y - frag.y);
  float along = dy < dx ? frag.x : frag.y;
  float dash = step(mod(along, u_dash + u_gap), u_dash);

  // Diagonal unmask from the top-left patch to the full box
  vec2 open = mix(vec2(u_startW, u_startH), u_resolution + 4.0, clamp(p, 0.0, 1.0));
  float visible = step(frag.x, open.x) * step(frag.y, open.y);

  float a = dash * visible * fade;
  gl_FragColor = vec4(u_color * a, a);
}
