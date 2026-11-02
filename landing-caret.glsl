precision mediump float;

/** @resolution */
uniform vec2 u_resolution;

/** @time */
uniform float u_time;

void main() {
  float on = step(fract(u_time), 0.5);
  gl_FragColor = vec4(0.102, 0.102, 0.102, on);
}
