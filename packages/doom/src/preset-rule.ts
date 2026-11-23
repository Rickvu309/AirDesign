export type Shade = "lighten" | "lightenLess" | "darken" | "darkenLess"

export type PresetRule = {
  readonly area?: string
  readonly sites?: readonly string[]
  readonly adjusts: readonly string[]
  readonly guides: readonly string[]
  readonly paths: readonly {
    readonly data: string
    readonly fill: boolean
    readonly shade?: Shade
    readonly stroke: boolean
    readonly width?: number
    readonly height?: number
  }[]
}

const radians = Math.PI / 10_800_000
const printed = (number: number) => String(Math.round(number * 1_000_000) / 1_000_000)

type Spot = { readonly x: number; readonly y: number }

export type Traced = { readonly d: string; readonly rings: readonly (readonly Spot[])[] }

const curveSteps = 8

export function presetPath(data: string, value: (name: string) => number, sx: number, sy: number): Traced {
  const tokens = data.split(" ")
  let at = 0
  let x = 0
  let y = 0
  let startX = 0
  let startY = 0
  let d = ""
  const rings: Spot[][] = []
  const next = () => value(tokens[at++] ?? "")
  const point = (px: number, py: number) => `${printed(px * sx)} ${printed(py * sy)}`
  const reach = (px: number, py: number) => rings[rings.length - 1]?.push({ x: px * sx, y: py * sy })
  while (at < tokens.length) {
    const command = tokens[at++]
    if (command === "Z") {
      d += "Z"
      x = startX
      y = startY
      reach(x, y)
    } else if (command === "A") {
      const rx = next()
      const ry = next()
      const start = next() * radians
      const sweep = next() * radians
      const radial = (angle: number) => {
        const parameter = Math.atan2(rx * Math.sin(angle), ry * Math.cos(angle))
        return [rx * Math.cos(parameter), ry * Math.sin(parameter)] as const
      }
      const initial = radial(start)
      const cx = x - initial[0]
      const cy = y - initial[1]
      const steps = Math.max(1, Math.ceil(Math.abs(sweep) / Math.PI))
      for (let step = 1; step <= steps * curveSteps; step += 1) {
        const along = radial(start + (sweep * step) / (steps * curveSteps))
        reach(cx + along[0], cy + along[1])
      }
      for (let step = 1; step <= steps; step += 1) {
        const end = radial(start + (sweep * step) / steps)
        x = cx + end[0]
        y = cy + end[1]
        d += rx <= 0 || ry <= 0 ? `L${point(x, y)}` : `A${point(rx, ry)} 0 0 ${sweep > 0 ? 1 : 0} ${point(x, y)}`
      }
    } else {
      const count = command === "C" ? 3 : command === "Q" ? 2 : 1
      const from = { x, y }
      const controls: Spot[] = []
      d += command
      for (let index = 0; index < count; index += 1) {
        x = next()
        y = next()
        controls.push({ x, y })
        d += `${index === 0 ? "" : " "}${point(x, y)}`
      }
      if (command === "M") {
        startX = x
        startY = y
        rings.push([])
        reach(x, y)
      } else if (count === 1) reach(x, y)
      else
        for (let step = 1; step <= curveSteps; step += 1) {
          const spot = bezier([from, ...controls], step / curveSteps)
          reach(spot.x, spot.y)
        }
    }
  }
  return { d, rings }
}

function bezier(points: readonly Spot[], share: number): Spot {
  if (points.length === 1) return points[0]!
  return bezier(
    points.slice(1).map((point, index) => ({
      x: points[index]!.x + (point.x - points[index]!.x) * share,
      y: points[index]!.y + (point.y - points[index]!.y) * share,
    })),
    share,
  )
}
