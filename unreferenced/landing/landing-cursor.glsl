precision mediump float;

/** @resolution */
uniform vec2 u_resolution;

/** @time */
uniform float u_time;

uniform sampler2D u_cursor;
uniform sampler2D u_edit;

/**
 * @label Autoplay
 * @default 1
 */
uniform float u_autoplay;

/**
 * @label Timeline
 * @range 0, 1
 * @default 0
 */
uniform float u_progress;

/**
 * @label Reduced motion
 * @default 0
 */
uniform float u_reduced_motion;

float easeInOut(float x) {
  float t = x;
  for (int i = 0; i < 5; i++) {
    float s = 1.0 - t;
    float xt = 3.0 * s * s * t * 0.77 + 3.0 * s * t * t * 0.175 + t * t * t;
    float dx = 3.0 * s * s * 0.77 + 6.0 * s * t * (0.175 - 0.77) + 3.0 * t * t * (1.0 - 0.175);
    t = clamp(t - (xt - x) / max(dx, 0.0001), 0.0, 1.0);
  }
  float s2 = 1.0 - t;
  return 3.0 * s2 * t * t + t * t * t;
}

float box(vec2 p, vec2 o, vec2 s) {
  vec2 q = p - o;
  return step(0.0, q.x) * step(0.0, q.y) * step(q.x, s.x) * step(q.y, s.y);
}

float ring(vec2 p, vec2 o, vec2 s) {
  return box(p, o, s) * (1.0 - box(p, o + vec2(1.5), s - vec2(3.0)));
}

float handles(vec2 p, vec2 o, vec2 s) {
  float h = box(p, o - vec2(3.5), vec2(7.0));
  h = max(h, box(p, o + vec2(s.x - 3.5, -3.5), vec2(7.0)));
  h = max(h, box(p, o + vec2(-3.5, s.y - 3.5), vec2(7.0)));
  h = max(h, box(p, o + vec2(s.x - 3.5, s.y - 3.5), vec2(7.0)));
  return h;
}

vec4 sprite(sampler2D image, vec2 p, vec2 origin, vec2 size) {
  vec2 uv = (p - origin) / size;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
  return texture2D(image, uv);
}

vec4 over(vec4 under, vec4 src) {
  float a = src.a + under.a * (1.0 - src.a);
  vec3 rgb = src.rgb * src.a + under.rgb * under.a * (1.0 - src.a);
  return vec4(rgb / max(a, 0.0001), a);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 p = vec2(uv.x, 1.0 - uv.y) * vec2(1296.0, 896.0);
  float loop = 11.6;
  float t = u_autoplay > 0.5 ? mod(u_time, loop) : clamp(u_progress, 0.0, 1.0) * loop;

  vec2 email = vec2(381.0, 139.0);
  vec2 banner = vec2(1058.0, 270.0);
  vec2 ad = vec2(884.0, 494.0);
  vec2 dock = vec2(430.0, 769.0);
  vec2 anchor = email;
  float bannerSel = 0.0;
  float adSel = 0.0;
  float editA = 0.0;

  if (u_reduced_motion < 0.5) {
    if (t < 0.7) {
      anchor = email;
    } else if (t < 2.5) {
      anchor = mix(email, banner, easeInOut(clamp((t - 0.7) / 1.8, 0.0, 1.0)));
    } else if (t < 4.1) {
      anchor = banner;
    } else if (t < 5.8) {
      anchor = mix(banner, ad, easeInOut(clamp((t - 4.1) / 1.7, 0.0, 1.0)));
    } else if (t < 6.7) {
      anchor = ad;
    } else if (t < 8.5) {
      anchor = mix(ad, dock, easeInOut(clamp((t - 6.7) / 1.8, 0.0, 1.0)));
    } else if (t < 9.2) {
      anchor = dock;
    } else if (t < 11.0) {
      anchor = mix(dock, email, easeInOut(clamp((t - 9.2) / 1.8, 0.0, 1.0)));
    }
    bannerSel = smoothstep(2.25, 2.6, t) * (1.0 - smoothstep(4.15, 4.5, t));
    adSel = smoothstep(5.5, 5.85, t) * (1.0 - smoothstep(6.75, 7.1, t));
    editA = smoothstep(2.6, 3.1, t) * (1.0 - smoothstep(4.2, 4.65, t));
  }

  vec3 blue = vec3(79.0, 105.0, 242.0) / 255.0;
  vec4 color = vec4(0.0);
  vec2 bannerBox = vec2(622.0, 248.0);
  vec2 bannerSize = vec2(440.0, 86.0);
  float bMark = max(ring(p, bannerBox, bannerSize), handles(p, bannerBox, bannerSize));
  color = over(color, vec4(blue, bMark * bannerSel));
  vec2 adBox = vec2(612.0, 468.0);
  vec2 adSize = vec2(272.0, 56.0);
  float aMark = max(ring(p, adBox, adSize), handles(p, adBox, adSize));
  color = over(color, vec4(blue, aMark * adSel));

  vec4 line = sprite(u_edit, p, vec2(628.0, 310.0), vec2(240.5, 16.0));
  color = over(color, vec4(line.rgb, line.a * editA));

  vec2 origin = anchor - vec2(7.0, 6.0);
  vec4 agent = sprite(u_cursor, p, origin, vec2(166.5, 56.5));
  color = over(color, agent);
  gl_FragColor = color;
}
