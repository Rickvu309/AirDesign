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
    const matched = part.match(/^\/\\ (\w+) = (.+)$/)
    if (!matched) throw new Error(`bad state line ${part}`)
    spec[matched[1]] = parseValue(matched[2])
  }
  return spec
}

export function parseDot(dot: string): Graph {
  const states = new Map<string, Spec>()
  const edges: Graph["edges"] = []
  for (const line of dot.split("\n")) {
    const node = line.match(/^(-?\d+) \[label="(.*)"(?:,style = filled)?\]?;?$/)
    if (node) {
      const label = node[2].replaceAll("\\\\", "\\").replaceAll("\\n", "\n").replaceAll('\\"', '"')
      states.set(node[1], parseLabel(label))
      continue
    }
    const edge = line.match(/^(-?\d+) -> (-?\d+) \[label="([^"]+)"/)
    if (edge) edges.push({ from: edge[1], to: edge[2], action: edge[3] })
  }
  return { states, edges }
}
