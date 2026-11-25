import type { Hex } from "../../paint.js"

function linear(hex: Hex) {
  return [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
}

function luminance(hex: Hex) {
  const [r = 0, g = 0, b = 0] = linear(hex)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(left: Hex, right: Hex) {
  const a = luminance(left)
  const b = luminance(right)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

function oklab(hex: Hex) {
  const [r = 0, g = 0, b = 0] = linear(hex)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ] as const
}

export function validatorDeltaE(left: Hex, right: Hex) {
  const a = oklab(left)
  const b = oklab(right)
  return 100 * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}
