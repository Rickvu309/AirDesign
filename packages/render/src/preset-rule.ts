export { presetGuides } from "@airdesign/document"

export type Shade = "lighten" | "lightenLess" | "darken" | "darkenLess"

export type PresetRule = {
  readonly area?: string
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

export function presetPath(data: string, value: (name: string) => number, sx: number, sy: number): string {
  const tokens = data.split(" ")
  let at = 0
  let x = 0
  let y = 0
  let startX = 0
  let startY = 0
  let d = ""
  const next = () => value(tokens[at++] ?? "")
  const point = (px: number, py: number) => `${printed(px * sx)} ${printed(py * sy)}`
  while (at < tokens.length) {
    const command = tokens[at++]
    if (command === "Z") {
      d += "Z"
      x = startX
      y = startY
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
      for (let step = 1; step <= steps; step += 1) {
        const end = radial(start + (sweep * step) / steps)
        x = cx + end[0]
        y = cy + end[1]
        d += rx <= 0 || ry <= 0 ? `L${point(x, y)}` : `A${point(rx, ry)} 0 0 ${sweep > 0 ? 1 : 0} ${point(x, y)}`
      }
    } else {
      const points = command === "C" ? 3 : command === "Q" ? 2 : 1
      d += command
      for (let index = 0; index < points; index += 1) {
        x = next()
        y = next()
        d += `${index === 0 ? "" : " "}${point(x, y)}`
      }
      if (command === "M") {
        startX = x
        startY = y
      }
    }
  }
  return d
}
