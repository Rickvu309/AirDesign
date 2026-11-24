import { vi } from "vitest"

type Pt = readonly [number, number]

function flatten(d: string): readonly Pt[] {
  const tokens = d.match(/[MHVAZ]|-?\d*\.?\d+/g) ?? []
  const points: Pt[] = []
  let at: Pt = [0, 0]
  let index = 0
  const read = () => Number(tokens[index++])
  while (index < tokens.length) {
    const command = tokens[index++]
    if (command === "M") at = [read(), read()]
    else if (command === "H") at = [read(), at[1]]
    else if (command === "V") at = [at[0], read()]
    else if (command === "A") {
      const r = read()
      index += 4
      const to: Pt = [read(), read()]
      const quarter = (centre: Pt) => {
        const from = Math.atan2(at[1] - centre[1], at[0] - centre[0])
        const end = Math.atan2(to[1] - centre[1], to[0] - centre[0])
        return { from, sweep: ((end - from + 3 * Math.PI) % (2 * Math.PI)) - Math.PI }
      }
      const centre: Pt = Math.abs(quarter([at[0], to[1]]).sweep - Math.PI / 2) < 1e-6 ? [at[0], to[1]] : [to[0], at[1]]
      const { from, sweep } = quarter(centre)
      for (let step = 1; step <= 16; step += 1) {
        const angle = from + (sweep * step) / 16
        points.push([centre[0] + r * Math.cos(angle), centre[1] + r * Math.sin(angle)])
      }
      at = to
      continue
    }
    points.push(at)
  }
  return points
}

function inside(polygon: readonly Pt[], x: number, y: number): boolean {
  let holds = false
  for (let a = 0, b = polygon.length - 1; a < polygon.length; b = a++) {
    const [ax, ay] = polygon[a]!
    const [bx, by] = polygon[b]!
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) holds = !holds
  }
  return holds
}

export function stubPathCanvas(): void {
  vi.stubGlobal(
    "Path2D",
    class {
      constructor(readonly d: string) {}
    },
  )
  vi.stubGlobal("document", {
    createElement: () => ({
      getContext: () => ({
        isPointInPath: (path: { d: string }, x: number, y: number) => inside(flatten(path.d), x, y),
      }),
    }),
  })
}
