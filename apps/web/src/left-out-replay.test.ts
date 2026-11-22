import {
  decide,
  elementId,
  format,
  openRegister,
  writeTextValue,
  type Command,
  type Register,
} from "@airdesign/document"
import { readPackage } from "@airdesign/pptx"
import { beforeAll, expect, it } from "vitest"
import { exportedDeck } from "./editing/exported-parts"

type Value = boolean | number | string
type Spec = Record<string, Value>
type Graph = {
  readonly states: Map<string, Spec>
  readonly edges: readonly { readonly from: string; readonly to: string; readonly action: string }[]
}
type Parts = ReadonlyMap<string, Uint8Array>

const node = elementId("256.2")
let file: Parts = new Map()
let graph: Graph = { states: new Map(), edges: [] }

beforeAll(async () => {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  const read = await readPackage(
    await fs.readFile(new URL("../../../scripts/pptx-fixtures/clean.pptx", import.meta.url)),
  )
  if (!read.ok) throw new Error(read.reason)
  file = read.parts
  graph = await specGraph("left-out", "LeftOut")
}, 60_000)

async function specGraph(name: string, module: string): Promise<Graph> {
  const checks: string = new URL("../../../scripts/check-specs.mjs", import.meta.url).href
  const graphs: string = new URL("../../../tests/spec-graph.ts", import.meta.url).href
  const specs = (await import(checks)) as {
    dumpSpec: (topic: string, java: string, jar: string, spec: string, config: string) => { graph: string }
    javaBin: () => string
    jarPath: () => string
  }
  const { parseDot } = (await import(graphs)) as { parseDot: (dot: string) => Graph }
  const topic = decodeURIComponent(new URL(`../../../specs/${name}`, import.meta.url).pathname)
  return parseDot(specs.dumpSpec(topic, specs.javaBin(), specs.jarPath(), `${module}.tla`, `${module}.cfg`).graph)
}

const bit = (mask: number, edit: number) => Math.floor(mask / 2 ** (edit - 1)) % 2 === 1

function edited(count: number, bad: number): Register {
  const commands: Command[] = [{ command: "add", node, floor: "", route: "" }]
  for (let edit = 1; edit <= count; edit += 1)
    commands.push(
      bit(bad, edit)
        ? { command: "person", node, value: writeTextValue([{ from: 9, runs: [{ from: 0, text: "Nowhere" }] }]) }
        : { command: "person", node, v: format, patch: { border: { width: { set: edit * 12_700 } } } },
    )
  return commands.reduce(
    (register, command) => {
      const decision = decide(register, command)
      if (decision.decision === "refuse") throw new Error(decision.code)
      return decision.register
    },
    openRegister("", ""),
  )
}

function opened(parts: Parts, v: Spec) {
  const count = Number(v.count)
  const bad = Number(v.bad)
  const painted = exportedDeck(parts, edited(count, bad))
  const left = painted.leftOut.reduce(
    (mask, edit) => mask + ("slide" in edit || edit.row === null ? 0 : 2 ** edit.row),
    0,
  )
  const lastShown = [...Array.from({ length: count }, (_, at) => at + 1)].filter((edit) => !bit(bad, edit)).at(-1)
  const slide = new TextDecoder().decode(painted.parts.get("ppt/slides/slide1.xml"))
  const width = /<a:ln w="(\d+)"/.exec(slide)?.[1]
  return {
    left,
    told: painted.leftOut.length > 0,
    width: width === undefined ? undefined : Number(width),
    expected: lastShown === undefined ? undefined : lastShown * 12_700,
  }
}

it("replays every state of the left-out spec through the tab's writer: each writable edit written, the rest left out and named", () => {
  const original = /<a:ln w="(\d+)"/.exec(new TextDecoder().decode(file.get("ppt/slides/slide1.xml")))?.[1]
  let checked = 0
  for (const edge of graph.edges) {
    const to = graph.states.get(edge.to)
    if (to === undefined || to.phase !== "open" || Number(to.count) === 0) continue
    const parts = edge.action === "Reload" ? new Map(file) : file
    const seen = opened(parts, to)
    const named = `${edge.action} -> count ${String(to.count)}, bad ${String(to.bad)}`
    expect(seen.left, named).toBe(Number(to.bad))
    expect(seen.left, named).toBe(Number(to.left))
    expect(seen.told, named).toBe(to.told)
    expect(seen.width, named).toBe(seen.expected ?? (original === undefined ? undefined : Number(original)))
    checked += 1
  }
  expect(checked).toBeGreaterThan(0)
})
