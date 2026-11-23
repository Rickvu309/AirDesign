type Value = boolean | number | string
type Spec = Record<string, Value>
export type Graph = {
  states: Map<string, Spec>
  edges: { from: string; to: string; action: string }[]
}

function parseValue(raw: string): Value {
  if (raw === "TRUE") return true
  if (raw === "FALSE") return false
  if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1)
  const number = Number(raw)
  if (Number.isNaN(number)) throw new Error(`bad value ${raw}`)
  return number
}

function parseLabel(label: string): Spec {
  const spec: Spec = {}
  for (const part of label.split("\n")) {
    const [, name, raw] = part.match(/^\/\\ (\w+) = (.+)$/) ?? []
    if (name === undefined || raw === undefined) throw new Error(`bad state line ${part}`)
    spec[name] = parseValue(raw)
  }
  return spec
}

export function parseDot(dot: string): Graph {
  const states = new Map<string, Spec>()
  const edges: Graph["edges"] = []
  for (const line of dot.split("\n")) {
    const [, id, text] = line.match(/^(-?\d+) \[label="(.*)"(?:,style = filled)?\]?;?$/) ?? []
    if (id !== undefined && text !== undefined) {
      const label = text.replaceAll("\\\\", "\\").replaceAll("\\n", "\n").replaceAll('\\"', '"')
      states.set(id, parseLabel(label))
      continue
    }
    const [, from, to, action] = line.match(/^(-?\d+) -> (-?\d+) \[label="([^"]+)"/) ?? []
    if (from !== undefined && to !== undefined && action !== undefined) edges.push({ from, to, action })
  }
  return { states, edges }
}
