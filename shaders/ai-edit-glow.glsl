precision mediump float;

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
 * @label Speed
 * @default 0.6
 * @range 0.1, 3
 */
uniform float u_speed;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float t = u_time * u_speed;
  float pulse = 0.5 + 0.5 * sin(t * 3.14159);
  float sweep = exp(-pow((uv.x + uv.y * 0.3 - fract(t * 0.5) * 1.6 + 0.3) * 4.0, 2.0));
  float a = 0.06 + 0.06 * pulse + 0.10 * sweep;
  gl_FragColor = vec4(u_color * a, a);
}
