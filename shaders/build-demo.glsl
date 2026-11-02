precision mediump float;

// End-to-end demo of an agent building a frame on the AirDesign canvas.
// Loops every 8 s: the board pops in, its solid outline draws open, the
// contrail takes off, each piece gets a box that draws open, then the
// content lifts in as the box steps away, and finally the outline fades, the
// contrail flies off and the frame name returns. Timings match the Motion spec.

/** @resolution */
uniform vec2 u_resolution;
/** @time */
uniform float u_time;
/** @label Finished board (640 x 500, 2x) */
uniform sampler2D u_board;
/** @label Frame name label (160 x 17, 2x) */
uniform sampler2D u_label;
/** @label Autoplay @default 1 */
uniform float u_autoplay;
/** @label Timeline (when autoplay is off) @range 0, 1 @default 0.5 */
uniform float u_progress;
/** @label Speed @range 0.25, 2 @default 1 */
uniform float u_speed;

const float K = 2.0;            // demo scale: design px -> screen px
const float LOOP = 8.0;
const vec3 STAGE = vec3(0.980);
const vec3 AI = vec3(79.0, 105.0, 242.0) / 255.0;
const vec3 PINK = vec3(255.0, 88.0, 174.0) / 255.0;

float cl(float x) { return clamp(x, 0.0, 1.0); }
float eOut(float x) { x = cl(x); return 1.0 - (1.0 - x) * (1.0 - x); }
float eDraw(float x) { x = cl(x); return 1.0 - pow(1.0 - x, 3.0); }
float ePop(float x) { x = cl(x); float a = x - 1.0; return 1.0 + 1.6 * a * a * a + 0.6 * a * a; }

float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }

// Signed distance to a rectangle given by its top-left and size
float sdRect(vec2 p, vec2 o, vec2 s) {
  vec2 q = abs(p - o - s * 0.5) - s * 0.5;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

// Outline that draws open from a top-left patch. gap 0 = solid.
float drawnOutline(vec2 p, vec2 o, vec2 s, float width, float dash, float gap, vec2 startSz, float progress) {
  float d = abs(sdRect(p, o, s));
  float line = 1.0 - smoothstep(width * 0.5 - 0.5, width * 0.5 + 0.5, d);
  float dashes = 1.0;
  if (gap > 0.0) {
    vec2 l = p - o;
    float nearH = min(abs(l.y), abs(l.y - s.y));
    float nearV = min(abs(l.x), abs(l.x - s.x));
    float along = nearH < nearV ? l.x : l.y;
    dashes = step(mod(along, dash + gap), dash);
  }
  vec2 open = mix(startSz, s + width, progress);
  vec2 l = p - o + width;
  float visible = step(l.x, open.x + width) * step(l.y, open.y + width);
  return line * dashes * visible;
}

float pieceY(int i) {
  if (i == 0) return 16.0; if (i == 1) return 48.0; if (i == 2) return 68.0; if (i == 3) return 112.0;
  if (i == 4) return 134.0; if (i == 5) return 166.0; return 198.0;
}
float pieceH(int i) {
  if (i == 0) return 22.0; if (i == 1) return 16.0; if (i == 2) return 32.0; if (i == 3) return 16.0;
  return 26.0;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
  float t = u_autoplay > 0.5 ? mod(u_time * u_speed, LOOP) : u_progress * LOOP;

  vec2 bsize = vec2(320.0, 250.0) * K;
  vec2 bo = vec2(floor(u_resolution.x * 0.5 - bsize.x * 0.5), 120.0);
  float END = 1.1 + 6.0 * 0.6 + 1.05;          // last row settled
  float loopFade = 1.0 - cl((t - 7.6) / 0.35);

  vec3 col = STAGE;

  // 1. Board pops in: opacity 0.5 s, scale 0.94 -> 1 over 0.55 s, no slide
  float bop = eOut(t / 0.5) * loopFade;
  float sc = 0.94 + 0.06 * ePop(t / 0.55);
  vec2 c = bo + bsize * 0.5;
  vec2 q = c + (p - c) / sc;                     // inverse scale around the center
  vec2 u = (q - bo) / K;                         // board design coordinates

  // soft shadow and board
  float sd = sdRect(q, bo + vec2(0.0, 4.0), bsize);
  col = mix(col, vec3(0.0), 0.05 * (1.0 - smoothstep(0.0, 18.0, sd)) * bop);
  float inBoard = step(0.0, u.x) * step(0.0, u.y) * step(u.x, 320.0) * step(u.y, 250.0);
  vec3 board = vec3(1.0);

  // 4. Content lifts in per piece (fade 450 ms, rise 6 px), revealed from the finished board
  for (int i = 0; i < 7; i++) {
    float s = 1.1 + float(i) * 0.6;
    float cp = eOut((t - s - 0.6) / 0.45);
    float rise = 6.0 * (1.0 - cp);
    float y0 = pieceY(i);
    float h = pieceH(i);
    float uy = u.y - rise;
    if (cp > 0.0 && uy >= y0 && uy <= y0 + h && u.x >= 14.0 && u.x <= 306.0) {
      vec4 tex = texture2D(u_board, vec2(u.x, uy) / vec2(320.0, 250.0));
      board = mix(board, tex.rgb, cp);
    }
  }
  col = mix(col, board, inBoard * bop);
  // hairline board edge
  float edge = 1.0 - smoothstep(0.5, 1.5, abs(sdRect(q, bo, bsize)));
  col = mix(col, vec3(0.0), 0.08 * edge * bop);

  // 2-3. Piece boxes: solid 1 px, draw open from a 10 x 8 patch, out 320 ms after 80 ms
  for (int i = 0; i < 7; i++) {
    float s = 1.1 + float(i) * 0.6;
    if (t < s) continue;
    float dp = eDraw((t - s) / 0.52);
    float op = cl((t - s) / 0.12) * (1.0 - cl((t - s - 0.68) / 0.32));
    vec2 ro = bo + vec2(12.0, pieceY(i) - 3.0) * K;
    vec2 rs = vec2(296.0, pieceH(i) + 6.0) * K;
    float a = drawnOutline(p, ro, rs, 1.0 * K, 0.0, 0.0, vec2(10.0, 8.0) * K, dp);
    col = mix(col, AI, a * op * loopFade);
  }

  // Board outline: solid 1 px, draws open from a 14 x 12 patch, fades when done
  if (t > 0.55) {
    float dp = eDraw((t - 0.55) / 0.52);
    float op = cl((t - 0.55) / 0.12) * (1.0 - cl((t - END - 0.08) / 0.32));
    float a = drawnOutline(p, bo - 1.0, bsize + 2.0, 1.0 * K, 0.0, 0.0, vec2(14.0, 12.0) * K, dp);
    col = mix(col, AI, a * op * loopFade);
  }

  // Contrail: 3 rows of round dots above the board's top-left, pink head climbs at 15 deg
  float cop = step(0.55, t) * (1.0 - cl((t - END) / 0.3)) * loopFade;
  if (cop > 0.0) {
    float dsz = 2.0 * K;
    float gp = 2.0 * K;
    float pitch = dsz + gp;
    vec2 co = bo + vec2(-1.0, -17.0 * K);
    vec2 lp = p - co;
    if (lp.x >= 0.0 && lp.y >= 0.0 && lp.x < 18.0 * pitch && lp.y < 3.0 * pitch) {
      vec2 cell = floor(lp / pitch);
      vec2 local = lp - cell * pitch;
      float r = dsz * 0.5;
      float inside = 1.0 - smoothstep(r - 0.6, r + 0.6, length(local - r));
      float tick = floor(u_time * 1000.0 / 60.0);
      float headCol = mod(tick, 22.0);
      float row = max(0.0, 2.0 - floor(cell.x * 0.268 + 0.5));
      float age = headCol - cell.x;
      vec3 dc = AI;
      float da = 0.0;
      if (cell.y == row && age >= 0.0 && age < 6.0 && headCol < 18.0) {
        if (age < 0.5) { dc = PINK; da = 1.0; } else { da = mix(1.0, 0.2, age / 6.0); }
      } else if (hash(vec3(cell, floor(u_time * 1000.0 / 120.0))) < 0.12) {
        da = 0.35;
      }
      col = mix(col, dc, da * inside * cop);
    }
  }

  // Done: the frame name comes back above the board
  float lop = cl((t - END - 0.4) / 0.25) * loopFade;
  vec2 lo = bo + vec2(0.0, -20.0 * K);
  vec2 luv = (p - lo) / vec2(160.0, 17.0);
  if (lop > 0.0 && luv.x >= 0.0 && luv.y >= 0.0 && luv.x <= 1.0 && luv.y <= 1.0) {
    vec4 lt = texture2D(u_label, luv);
    col = mix(col, lt.rgb, lt.a * lop);
  }

  gl_FragColor = vec4(col, 1.0);
}
