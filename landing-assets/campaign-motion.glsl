precision mediump float;
/** @resolution */
uniform vec2 u_resolution;
/** @time */
uniform float u_time;
/** @label Campaign artwork */
uniform sampler2D u_scene;
/** @label Human edit */
uniform sampler2D u_edit;
/** @label AI cursor */
uniform sampler2D u_ai_cursor;
/** @label Teammate cursor */
uniform sampler2D u_human_cursor;
/** @label Autoplay @default 1 */
uniform float u_autoplay;
/** @label Reduced motion @default 0 */
uniform float u_reduced_motion;
/** @label Timeline @range 0, 1 @default 0.75 */
uniform float u_progress;
/** @label Speed @range 0.25, 2 @default 1 */
uniform float u_speed;

float easeOut(float p) {
  return p >= 1.0 ? 1.0 : 1.0 - pow(2.0, -10.0 * max(p, 0.0));
}
float easeInOut(float p) {
  return 0.5 - 0.5 * cos(3.14159265 * clamp(p, 0.0, 1.0));
}
vec2 cursorMove(vec2 from, vec2 to, vec2 bend, float p) {
  float progress = easeInOut(p);
  return mix(from, to, progress) + bend * sin(3.14159265 * progress);
}
float inside(vec2 p, vec4 r) {
  return step(r.x, p.x) * step(r.y, p.y) * step(p.x, r.x + r.z) * step(p.y, r.y + r.w);
}
float reveal(float t, float start) {
  return easeOut(clamp((t - start) / 0.6, 0.0, 1.0));
}
vec4 sprite(sampler2D image, vec2 p, vec2 origin, vec2 size) {
  vec2 uv = (p - origin) / size;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
  return texture2D(image, uv);
}
float outline(vec2 p, vec4 r) {
  vec2 q = abs(p - r.xy - r.zw * 0.5) - r.zw * 0.5;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  return 1.0 - smoothstep(0.35, 1.05, abs(d));
}
float building(float t, float start, float end) {
  return smoothstep(start, start + 0.1, t) * (1.0 - smoothstep(end, end + 0.4, t));
}
vec3 writeLayer(vec3 color, vec2 p, vec4 r, float t, float start, vec3 paper) {
  float age = t - start;
  float progress = clamp(age / 0.82, 0.0, 1.0);
  if (inside(p, r) > 0.5) {
    vec2 uv = p / vec2(854.0, 644.0);
    vec3 art = mix(texture2D(u_scene, uv).rgb, texture2D(u_edit, uv).rgb, reveal(t, 10.2));
    float y = (p.y - r.y) / r.w;
    float front = clamp((progress - 0.3) / 0.7, 0.0, 1.0) * 1.14 - 0.07;
    float written = 1.0 - smoothstep(front - 0.04, front + 0.04, y);
    color = mix(paper, art, written);
    float pass = exp(-abs(y - front) * 16.0) * building(t, start + 0.12, start + 0.7);
    color = mix(color, vec3(0.85, 0.91, 1.0), pass * 0.16);
  }
  float active = building(t, start, start + 0.82);
  float wave = 0.22 + 0.78 * pow(0.5 + 0.5 * sin((p.x + p.y) * 0.026 - age * 6.28), 2.0);
  return mix(color, vec3(52.0, 133.0, 249.0) / 255.0, outline(p, r) * active * wave * 0.8);
}
vec3 workingFrame(vec3 color, vec2 p, vec4 r, float t, float start, float end) {
  float active = building(t, start, end);
  float wave = 0.15 + 0.65 * pow(0.5 + 0.5 * sin((p.x + p.y) * 0.012 - t * 2.51), 3.0);
  float pixels = 0.0;
  for (int i = 0; i < 8; i++) {
    float x = float(i);
    float pulse = 0.2 + 0.8 * pow(0.5 + 0.5 * sin(t * 6.28 - x * 0.75), 2.0);
    pixels += inside(p, vec4(r.x + 4.0 + x * 6.0, r.y - 9.0, 3.0, 3.0)) * pulse;
  }
  float strength = (outline(p, r) * wave + pixels) * active;
  return mix(color, vec3(52.0, 133.0, 249.0) / 255.0, clamp(strength, 0.0, 0.85));
}
void main() {
  vec2 uv = vec2(gl_FragCoord.x / u_resolution.x, 1.0 - gl_FragCoord.y / u_resolution.y);
  vec2 p = uv * vec2(854.0, 644.0);
  float t = u_autoplay > 0.5 ? mod(u_time * u_speed, 16.0) : u_progress * 16.0;
  vec3 source = texture2D(u_scene, uv).rgb;
  vec3 edit = texture2D(u_edit, uv).rgb;
  if (u_reduced_motion > 0.5) { gl_FragColor = vec4(edit, 1.0); return; }
  vec3 bg = vec3(245.0 / 255.0);
  vec3 white = vec3(1.0);
  vec3 paper = vec3(229.0, 230.0, 226.0) / 255.0;
  vec3 orange = vec3(255.0, 100.0, 45.0) / 255.0;
  vec3 color = source;
  if (inside(p, vec4(20.0, 12.0, 150.0, 22.0)) > 0.5) color = mix(bg, source, reveal(t, 0.6));
  if (inside(p, vec4(23.0, 41.0, 362.0, 574.0)) > 0.5) {
    color = mix(bg, white, reveal(t, 0.6));
    color = writeLayer(color, p, vec4(24.0, 42.0, 360.0, 48.0), t, 0.8, color);
    color = writeLayer(color, p, vec4(24.0, 90.0, 360.0, 30.0), t, 1.4, color);
    color = writeLayer(color, p, vec4(24.0, 120.0, 360.0, 112.0), t, 2.0, color);
    color = writeLayer(color, p, vec4(24.0, 232.0, 360.0, 232.0), t, 2.7, color);
    color = writeLayer(color, p, vec4(48.0, 488.0, 312.0, 42.0), t, 3.5, color);
    color = writeLayer(color, p, vec4(48.0, 550.0, 136.0, 40.0), t, 4.2, color);
    color = mix(color, vec3(0.87), outline(p, vec4(24.0, 42.0, 360.0, 572.0)) * reveal(t, 0.6) * 0.5);
  }
  if (inside(p, vec4(412.0, 12.0, 200.0, 22.0)) > 0.5) color = mix(bg, source, reveal(t, 4.7));
  if (inside(p, vec4(415.0, 41.0, 406.0, 230.0)) > 0.5) {
    color = mix(bg, paper, reveal(t, 4.7));
    color = writeLayer(color, p, vec4(436.0, 60.0, 196.0, 20.0), t, 4.9, color);
    color = writeLayer(color, p, vec4(436.0, 104.0, 196.0, 80.0), t, 5.5, color);
    color = writeLayer(color, p, vec4(636.0, 42.0, 184.0, 228.0), t, 6.2, color);
    color = writeLayer(color, p, vec4(436.0, 239.0, 196.0, 16.0), t, 6.8, color);
  }
  if (inside(p, vec4(412.0, 296.0, 188.0, 22.0)) > 0.5) color = mix(bg, source, reveal(t, 7.4));
  if (inside(p, vec4(415.0, 325.0, 188.0, 214.0)) > 0.5) {
    color = mix(bg, orange, reveal(t, 7.4));
    color = writeLayer(color, p, vec4(470.0, 355.0, 78.0, 130.0), t, 7.7, color);
    color = writeLayer(color, p, vec4(464.0, 492.0, 100.0, 30.0), t, 8.3, color);
  }
  if (inside(p, vec4(630.0, 296.0, 200.0, 22.0)) > 0.5) color = mix(bg, source, reveal(t, 10.0));
  if (inside(p, vec4(633.0, 325.0, 188.0, 214.0)) > 0.5) {
    color = mix(bg, orange, reveal(t, 10.0));
    color = writeLayer(color, p, vec4(650.0, 346.0, 154.0, 72.0), t, 10.4, color);
    color = writeLayer(color, p, vec4(634.0, 422.0, 186.0, 80.0), t, 11.1, color);
    color = writeLayer(color, p, vec4(650.0, 510.0, 154.0, 28.0), t, 11.8, color);
  }
  color = workingFrame(color, p, vec4(24.0, 42.0, 360.0, 572.0), t, 0.6, 4.95);
  color = workingFrame(color, p, vec4(416.0, 42.0, 404.0, 228.0), t, 4.7, 7.6);
  color = workingFrame(color, p, vec4(416.0, 326.0, 186.0, 212.0), t, 7.4, 9.1);
  color = workingFrame(color, p, vec4(634.0, 326.0, 186.0, 212.0), t, 10.0, 12.65);
  float selected = smoothstep(9.6, 9.8, t) * (1.0 - smoothstep(11.8, 12.0, t));
  color = mix(color, vec3(79.0, 105.0, 242.0) / 255.0, outline(p, vec4(436.0, 104.0, 196.0, 76.0)) * selected);
  float aiVisible = smoothstep(0.4, 0.7, t) * (1.0 - smoothstep(12.65, 13.0, t));
  aiVisible *= 1.0 - smoothstep(9.05, 9.25, t) * (1.0 - smoothstep(9.8, 10.0, t));
  vec2 ai = vec2(162.0, 54.0);
  ai = cursorMove(ai, vec2(162.0, 102.0), vec2(-1.68, 0.0), (t - 1.3) / 0.28);
  ai = cursorMove(ai, vec2(302.0, 187.0), vec2(-2.975, 4.9), (t - 1.9) / 0.28);
  ai = cursorMove(ai, vec2(342.0, 244.0), vec2(-1.995, 1.4), (t - 2.6) / 0.28);
  ai = cursorMove(ai, vec2(280.0, 507.0), vec2(-9.205, -2.17), (t - 3.3798) / 0.3002);
  ai = cursorMove(ai, vec2(166.0, 550.0), vec2(-1.505, -3.99), (t - 4.1) / 0.28);
  ai = cursorMove(ai, vec2(554.0, 57.0), vec2(9.4298, 7.4215), (t - 4.46) / 0.42);
  ai = cursorMove(ai, vec2(592.0, 158.0), vec2(-3.535, 1.33), (t - 5.4) / 0.28);
  ai = cursorMove(ai, vec2(646.0, 57.0), vec2(3.535, 1.89), (t - 6.1) / 0.28);
  ai = cursorMove(ai, vec2(512.0, 238.0), vec2(-6.335, -4.69), (t - 6.7) / 0.28);
  ai = cursorMove(ai, vec2(519.0, 408.0), vec2(-5.95, 0.245), (t - 7.3) / 0.28);
  ai = cursorMove(ai, vec2(537.0, 497.0), vec2(-3.115, 0.63), (t - 8.2) / 0.28);
  ai = cursorMove(ai, vec2(664.0, 370.0), vec2(4.445, 4.445), (t - 9.9) / 0.28);
  ai = cursorMove(ai, vec2(657.0, 444.0), vec2(-2.59, -0.245), (t - 11.0) / 0.28);
  ai = cursorMove(ai, vec2(652.0, 510.0), vec2(-2.31, -0.175), (t - 11.7) / 0.28);
  vec4 agent = sprite(u_ai_cursor, p, ai, vec2(176.0, 64.0));
  color = mix(color, agent.rgb, agent.a * aiVisible);
  float humanVisible = smoothstep(8.5, 8.8, t) * (1.0 - smoothstep(12.0, 12.3, t));
  vec2 human = cursorMove(vec2(684.0, 566.0), vec2(614.0, 162.0), vec2(12.0, -2.0), (t - 8.5) / 0.6);
  human = mix(human, vec2(618.0, 170.0), easeInOut((t - 10.3) / 0.4));
  vec4 teammate = sprite(u_human_cursor, p, human, vec2(152.0, 64.0));
  color = mix(color, teammate.rgb, teammate.a * humanVisible);
  color = mix(color, edit, smoothstep(12.65, 13.0, t));
  color = mix(color, bg, smoothstep(15.55, 16.0, t));
  gl_FragColor = vec4(color, 1.0);
}
