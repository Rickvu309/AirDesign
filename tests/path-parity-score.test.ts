import { describe, expect, it } from "vitest"
import { differences, lines, measure, parityFaults, sweepSize, sweeps, type Picture } from "./browser/path-parity-score"
import { ink, nearFullColor } from "./browser/path-parity-art"

const scale = 0.5
const blank = (): { width: number; height: number; data: Uint8Array } => {
  const width = Math.round(1920 * scale)
  const height = Math.round(1080 * scale)
  return { width, height, data: new Uint8Array(width * height * 4).fill(255) }
}

function paint(picture: ReturnType<typeof blank>, hex: string, covers: (x: number, y: number) => boolean) {
  const color = [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16))
  for (let row = 0; row < picture.height; row++)
    for (let column = 0; column < picture.width; column++)
      if (covers(column / scale, row / scale)) picture.data.set(color, (row * picture.width + column) * 4)
}

const nearFull = (picture: ReturnType<typeof blank>, skip: number | undefined) =>
  sweeps.forEach(({ corner, ring }, index) => {
    if (index === skip) return
    const [cx, cy] = [corner[0] + sweepSize / 2, corner[1] + sweepSize / 2]
    paint(picture, nearFullColor, (x, y) => {
      const reach = Math.hypot(x - cx, y - cy)
      return reach <= sweepSize / 2 && (!ring || reach >= sweepSize * 0.29)
    })
  })

describe("path parity measures", () => {
  it("finds every near-full sweep that is painted and names the one that is not", () => {
    const whole = blank()
    nearFull(whole, undefined)
    expect(measure(whole).missing).toEqual([])
    const gap = blank()
    nearFull(gap, 3)
    expect(measure(gap).missing).toHaveLength(1)
    expect(measure(blank()).missing).toHaveLength(sweeps.length)
  })

  it("counts the dashes along a dashed line and compares them with the canvas", () => {
    const dashed = lines.find((line) => line.name === "dashed stroke")!
    const drawn = (count: number) => {
      const picture = blank()
      const run = dashed.box.w / (count * 2)
      paint(picture, ink, (x, y) => {
        const along = x - dashed.box.x
        return (
          Math.abs(y - (dashed.box.y + dashed.box.h / 2)) < 6 &&
          along >= 0 &&
          along < dashed.box.w - 1 &&
          Math.floor(along / run) % 2 === 0
        )
      })
      return picture
    }
    const canvas = measure(drawn(8))
    expect(canvas.dashes["dashed stroke"]?.runs).toBe(8)
    expect(parityFaults("PDF", measure(drawn(8)), canvas).filter((fault) => fault.includes("dashes"))).toEqual([])
    expect(parityFaults("PDF", measure(drawn(6)), canvas).filter((fault) => fault.includes("dashes"))).toHaveLength(1)
  })

  it("reads no difference between a picture and itself, and a large one against a blank page", () => {
    const picture = blank()
    nearFull(picture, undefined)
    const same = differences(picture, picture)
    expect(Object.values(same).every((gap) => gap.mean === 0 && gap.strong === 0)).toBe(true)
    const against = differences(blank(), picture satisfies Picture)
    expect(against["near-full discs"]?.strong).toBeGreaterThan(0.3)
  })
})
