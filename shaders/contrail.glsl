precision mediump float;

// AirDesign "Contrail": the agent-working indicator.
// A pink head takes off from the bottom-left of a 3-row dot strip, climbs at
// the logo's 15 degree flight path, then cruises along the top row. A blue
// trail fades behind it and a faint blue hum of random dots fills the rest.

/** @resolution */
uniform vec2 u_resolution;

/** @time */
uniform float u_time;

/**
 * @label Trail color
 * @color
 * @default #4F69F2
 */
uniform vec3 u_color;

/**
 * @label Head color
 * @color
 * @default #FF58AE
 */
uniform vec3 u_head;

/**
 * @label Dot size (px)
 * @default 3
 * @range 1, 24
 */
uniform float u_dot;

/**
 * @label Gap (px)
 * @default 3
 * @range 1, 24
 */
uniform float u_gap;

/**
 * @label Step (ms per column)
 * @default 60
 * @range 20, 200
 */
uniform float u_step;

/**
 * @label Trail length (dots)
 * @default 6
 * @range 2, 16
 */
uniform float u_trail;

/**
 * @label Hum (share of dots at the low level)
 * @default 0.12
 * @range 0, 0.5
 */
uniform float u_hum;

/**
 * @label Frozen (1 = still frame for reduced motion)
 * @default 0
 * @range 0, 1
 */
uniform float u_frozen;

float hash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

// Row of the flight path at a column: 2 = bottom, 0 = top. tan(15deg) = 0.268
float pathRow(float col) {
  return max(0.0, 2.0 - floor(col * 0.268 + 0.5));
}

void main() {
  float pitch = u_dot + u_gap;
  vec2 frag = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
  vec2 cell = floor(frag / pitch);
  vec2 local = frag - cell * pitch;
  float cols = floor((u_resolution.x + u_gap) / pitch);

  // Round dot
  float r = u_dot * 0.5;
  float inside = 1.0 - smoothstep(r - 0.6, r + 0.6, length(local - r));

  float frozen = step(0.5, u_frozen);
  float tick = floor(u_time * 1000.0 / u_step);
  float cycle = cols + 4.0;                   // a short pause between takeoffs
  float headCol = mix(mod(tick, cycle), cols - 1.0, frozen);
  float trail = mix(u_trail, cols, frozen);

  vec3 color = vec3(0.0);
  float alpha = 0.0;

  float age = headCol - cell.x;
  if (cell.y == pathRow(cell.x) && age >= 0.0 && age < trail && headCol < cols) {
    if (age < 0.5) {
      color = u_head;
      alpha = 1.0;
    } else {
      color = u_color;
      alpha = frozen > 0.5 ? mix(1.0, 0.35, clamp(age / 6.0, 0.0, 1.0))
                           : mix(1.0, 0.2, age / trail);
    }
  } else {
    float humTick = frozen > 0.5 ? 5.0 : floor(u_time * 1000.0 / 120.0);
    if (hash(vec3(cell, humTick)) < u_hum) {
      color = u_color;
      alpha = 0.35;
    }
  }

  alpha *= inside;
  gl_FragColor = vec4(color * alpha, alpha);
}
