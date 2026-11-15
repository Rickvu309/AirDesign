function luminance(rgb: string): number {
  const [red, green, blue] = [0, 2, 4].map((at) => {
    const channel = Number.parseInt(rgb.slice(at, at + 2), 16) / 255
    return channel <= 0.040_45 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0)
}

export function contrast(left: string, right: string): number {
  const a = luminance(left)
  const b = luminance(right)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
