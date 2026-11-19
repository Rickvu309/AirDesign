type Diamond = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

const whole = 100_000
const scale = 100

export function diamondQuarters(diamond: Diamond) {
  const x = (diamond.x / whole) * scale
  const y = (diamond.y / whole) * scale
  const across = whole / (diamond.width * scale)
  const down = whole / (diamond.height * scale)
  const norm = across * across + down * down
  return [-1, 1].flatMap((side) =>
    [-1, 1].map((end) => {
      const x0 = side < 0 ? 0 : x
      const y0 = end < 0 ? 0 : y
      return {
        x: x0,
        y: y0,
        width: (side < 0 ? x : scale) - x0,
        height: (end < 0 ? y : scale) - y0,
        fromX: x,
        fromY: y,
        toX: x + (side * across) / norm,
        toY: y + (end * down) / norm,
      }
    }),
  )
}

export function diamondImage(
  diamond: Diamond,
  stops: readonly { readonly position: number; readonly color: string }[],
) {
  const stopTags = stops.map(({ position, color }) => `<stop offset="${position}" stop-color="${color}"/>`).join("")
  const quarters = diamondQuarters(diamond)
    .map(
      ({ x, y, width, height, fromX, fromY, toX, toY }, key) =>
        `<linearGradient id="g${key}" gradientUnits="userSpaceOnUse" x1="${fromX}" y1="${fromY}" x2="${toX}" y2="${toY}">${stopTags}</linearGradient><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="url(#g${key})"/>`,
    )
    .join("")
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" preserveAspectRatio="none">${quarters}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") center / 100% 100% no-repeat`
}
