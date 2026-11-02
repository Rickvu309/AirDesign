precision mediump float;

/** @resolution */
uniform vec2 u_resolution;

/** @time */
uniform float u_time;

/**
 * @label Dot color
 * @color
 * @default #4F69F2
 */
uniform vec3 u_color;

/**
 * @label Spacing
 * @default 7
 * @range 4, 20
 */
uniform float u_gap;

/**
 * @label Speed
 * @default 0.9
 * @range 0.1, 3
 */
uniform float u_speed;

void main() {
  vec2 p = gl_FragCoord.xy;
  vec2 cell = mod(p, u_gap) - u_gap * 0.5;
  float r = u_gap * 0.26;
  float d = length(cell);
  float dotMask = 1.0 - smoothstep(r - 0.7, r + 0.7, d);
  float x = floor(p.x / u_gap) * u_gap / u_resolution.x;
  float row = floor(p.y / u_gap);
  float w = fract(x * 0.8 - u_time * u_speed * 0.45 + row * 0.04);
  float wave = 0.18 + 0.82 * pow(sin(w * 3.14159), 8.0);
  float a = dotMask * wave;
  gl_FragColor = vec4(u_color * a, a);
}
