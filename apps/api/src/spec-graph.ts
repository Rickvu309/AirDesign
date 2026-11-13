import { spawn } from "node:child_process"
import path from "node:path"

export type Value = boolean | number | string
export type SpecState = Record<string, Value>
export type Graph = {
  readonly states: Map<string, SpecState>
  readonly edges: readonly { readonly from: string; readonly to: string; readonly action: string }[]
}

function parseValue(raw: string): Value {
  if (raw === "TRUE") return true
  if (raw === "FALSE") return false
  if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1)
  const number = Number(raw)
  if (Number.isNaN(number)) throw new Error(`bad value ${raw}`)
  return number
}

function parseDot(dot: string): Graph {
  const states = new Map<string, SpecState>()
  const edges: { from: string; to: string; action: string }[] = []
  for (const line of dot.split("\n")) {
    const node = /^(-?\d+) \[label="(.*)"(?:,style = filled)?\]?;?$/.exec(line)
    if (node?.[1] !== undefined && node[2] !== undefined) {
      const label = node[2].replaceAll("\\\\", "\\").replaceAll("\\n", "\n").replaceAll('\\"', '"')
      const state: SpecState = {}
      for (const part of label.split("\n")) {
        const matched = /^\/\\ (\w+) = (.+)$/.exec(part)
        if (matched?.[1] === undefined || matched[2] === undefined) throw new Error(`bad state line ${part}`)
        state[matched[1]] = parseValue(matched[2])
      }
      states.set(node[1], state)
      continue
    }
    const edge = /^(-?\d+) -> (-?\d+) \[label="([^"]+)"/.exec(line)
    if (edge?.[1] !== undefined && edge[2] !== undefined && edge[3] !== undefined) {
      edges.push({ from: edge[1], to: edge[2], action: edge[3] })
    }
  }
  return { states, edges }
}

export function specGraph(name: string, module: string): Promise<Graph> {
  const specifier = new URL(`file://${path.join(process.cwd(), "scripts/check-specs.mjs")}`).href
  const topic = path.join(process.cwd(), "specs", name)
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module"], { stdio: ["pipe", "pipe", "pipe"] })
    let out = ""
    let err = ""
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk: string) => {
      out += chunk
    })
    child.stderr.on("data", (chunk: string) => {
      err += chunk
    })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(err || out))
      else resolve(parseDot(out))
    })
    child.stdin.end(
      `import { dumpSpec, javaBin, jarPath } from ${JSON.stringify(specifier)}\nprocess.stdout.write(dumpSpec(${JSON.stringify(topic)}, javaBin(), jarPath(), "${module}.tla", "${module}.cfg").graph)\n`,
    )
  })
}

export type Path = {
  readonly root: string
  readonly steps: readonly { readonly action: string; readonly to: string }[]
}

export function pathsFrom(graph: Graph, root: (state: SpecState) => boolean): Map<string, Path> {
  const paths = new Map<string, Path>()
  for (const [id, state] of graph.states) {
    if (root(state)) paths.set(id, { root: id, steps: [] })
  }
  const order = [...paths.keys()]
  for (let at = 0; at < order.length; at += 1) {
    const from = order[at]
    const path = from === undefined ? undefined : paths.get(from)
    if (path === undefined) continue
    for (const edge of graph.edges) {
      if (edge.from !== from || paths.has(edge.to)) continue
      paths.set(edge.to, { root: path.root, steps: [...path.steps, { action: edge.action, to: edge.to }] })
      order.push(edge.to)
    }
  }
  return paths
}

export function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right))
}

function sorted(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)))
}
