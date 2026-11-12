export type PresetRule = {
  readonly adjusts: readonly string[]
  readonly guides: readonly string[]
  readonly paths: readonly {
    readonly data: string
    readonly fill: boolean
    readonly stroke: boolean
    readonly width?: number
    readonly height?: number
  }[]
}

const radians = Math.PI / 10_800_000
const divide = (x: number, y: number) => (y === 0 ? 0 : x / y)
const formulas: Readonly<Record<string, (x: number, y: number, z: number) => number>> = {
  val: (x) => x,
  "*/": (x, y, z) => divide(x * y, z),
  "+-": (x, y, z) => x + y - z,
  "+/": (x, y, z) => divide(x + y, z),
  "?:": (x, y, z) => (x > 0 ? y : z),
  pin: (x, y, z) => Math.max(x, Math.min(y, z)),
  abs: Math.abs,
  min: (x, y) => Math.min(x, y),
  max: (x, y) => Math.max(x, y),
  sqrt: Math.sqrt,
  mod: Math.hypot,
  sin: (x, y) => x * Math.sin(y * radians),
  cos: (x, y) => x * Math.cos(y * radians),
  tan: (x, y) => x * Math.tan(y * radians),
  at2: (x, y) => Math.atan2(y, x) / radians,
  cat2: (x, y, z) => x * Math.cos(Math.atan2(z, y)),
  sat2: (x, y, z) => x * Math.sin(Math.atan2(z, y)),
}

export function presetGuides(rule: PresetRule, w: number, h: number, adjusts: Readonly<Record<string, number>>) {
  const values = new Map<string, number>([
    ["w", w],
    ["h", h],
    ["l", 0],
    ["t", 0],
    ["r", w],
    ["b", h],
    ["hc", w / 2],
    ["vc", h / 2],
    ["ss", Math.min(w, h)],
    ["ls", Math.max(w, h)],
  ])
  for (const divisor of [2, 3, 4, 5, 6, 8, 10, 12, 16, 32]) {
    values.set(`wd${divisor}`, w / divisor)
    values.set(`hd${divisor}`, h / divisor)
    values.set(`ssd${divisor}`, Math.min(w, h) / divisor)
  }
  for (const divisor of [2, 4, 8]) {
    for (const multiple of [1, 3, 5, 7]) {
      values.set(`${multiple === 1 ? "" : multiple}cd${divisor}`, (21_600_000 * multiple) / divisor)
    }
  }
  const value = (token: string): number => {
    const number = values.get(token) ?? Number(token)
    if (!Number.isFinite(number)) throw new Error(`preset guide ${token}`)
    return number
  }
  const evaluate = (definition: string, adjusted: boolean) => {
    const [name = "", operator = "", ...tokens] = definition.trim().split(/\s+/)
    const formula = formulas[operator]
    if (formula === undefined) throw new Error(`preset formula ${operator}`)
    const override = adjusted ? adjusts[name] : undefined
    const number =
      override !== undefined && Number.isFinite(override)
        ? override
        : formula(value(tokens[0] ?? "0"), value(tokens[1] ?? "0"), value(tokens[2] ?? "0"))
    values.set(name, number)
  }
  for (const definition of rule.adjusts) evaluate(definition, true)
  for (const definition of rule.guides) evaluate(definition, false)
  return value
}

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
