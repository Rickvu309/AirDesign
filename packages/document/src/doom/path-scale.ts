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

const printed = (value: number) => String(Math.round(value * 10_000) / 10_000)

export function scalePath(d: string, w: number, h: number): string {
  let out = ""
  let command = ""
  let at = 0
  for (const [, letter, number] of d.matchAll(token)) {
    if (letter !== undefined) {
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
    out += (at > 0 ? " " : "") + printed(scaled)
    at += 1
  }
  return out
}
