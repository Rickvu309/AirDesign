precision mediump float;

/** @resolution */
uniform vec2 u_resolution;

/**
 * @label Background
 * @color
 * @default #F5F5F5
 */
uniform vec3 u_bg;

/**
 * @label Dot
 * @color
 * @default #D4D4D4
 */
uniform vec3 u_dot;

/**
 * @label Spacing (share of height)
 * @default 0.028
 * @range 0.01, 0.1
 */
uniform float u_spacing;

void main() {
  float s = u_spacing * u_resolution.y;
  vec2 c = mod(gl_FragCoord.xy, s) - s * 0.5;
  float r = max(1.0, s * 0.06);
  float d = 1.0 - smoothstep(r - 0.5, r + 0.5, length(c));
  gl_FragColor = vec4(mix(u_bg, u_dot, d), 1.0);
}
