export type GuideRule = { readonly adjusts: readonly string[]; readonly guides: readonly string[] }

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

export function presetGuides(rule: GuideRule, w: number, h: number, adjusts: Readonly<Record<string, number>>) {
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
