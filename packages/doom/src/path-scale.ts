const arguments_: Readonly<Record<string, readonly ("x" | "y" | "rx" | "ry" | "angle" | "flag")[]>> = {
  m: ["x", "y"],
  l: ["x", "y"],
  t: ["x", "y"],
  h: ["x"],
  v: ["y"],
  c: ["x", "y", "x", "y", "x", "y"],
  s: ["x", "y", "x", "y"],
  q: ["x", "y", "x", "y"],
  a: ["rx", "ry", "angle", "flag", "flag", "x", "y"],
  z: [],
}

const token = /([A-Za-z])|(-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)/gi

export type PathBounds = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

type ScaledPath = { readonly d: string; readonly bounds?: PathBounds }

export function scalePath(d: string, w: number, h: number): ScaledPath {
  let out = ""
  let command = ""
  let at = 0
  let linear = true
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const [, letter, number] of d.matchAll(token)) {
    if (letter !== undefined) {
      linear &&= letter === "M" || letter === "L" || letter === "Z" || letter === "z"
      command = letter
      at = 0
      out += letter
      continue
    }
    const pattern = arguments_[command.toLowerCase()]
    if (pattern === undefined || pattern.length === 0 || number === undefined) continue
    const kind = pattern[at % pattern.length]!
    const value = Number(number)
    const scaled = kind === "x" || kind === "rx" ? value * w : kind === "y" || kind === "ry" ? value * h : value
    const rounded = Math.round(scaled * 10_000) / 10_000
    if (linear && kind === "x") {
      left = Math.min(left, rounded)
      right = Math.max(right, rounded)
    } else if (linear && kind === "y") {
      top = Math.min(top, rounded)
      bottom = Math.max(bottom, rounded)
    }
    out += (at > 0 ? " " : "") + String(rounded)
    at += 1
  }
  if (!linear || ![left, top, right, bottom].every(Number.isFinite)) return { d: out }
  return { d: out, bounds: { x: left, y: top, width: right - left, height: bottom - top } }
}
