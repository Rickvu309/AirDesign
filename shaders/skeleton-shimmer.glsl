precision mediump float;

/** @resolution */
uniform vec2 u_resolution;

/** @time */
uniform float u_time;

/**
 * @label Base
 * @color
 * @default #EDEDED
 */
uniform vec3 u_base;

/**
 * @label Highlight
 * @color
 * @default #F7F7F7
 */
uniform vec3 u_hi;

/**
 * @label Speed
 * @default 0.7
 * @range 0.1, 3
 */
uniform float u_speed;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float t = fract(u_time * u_speed * 0.5);
  float x = uv.x + (1.0 - uv.y) * 0.25;
  float band = exp(-pow((x - (t * 1.8 - 0.4)) * 5.0, 2.0));
  vec3 c = mix(u_base, u_hi, band);
  gl_FragColor = vec4(c, 1.0);
}
