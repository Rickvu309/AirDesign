import type { AgentChange } from "./agent-change.js"
import { compileAgentChange } from "./agent-compile.js"
import type { Reading } from "./agent-draft.js"
import { type NodeId, type Doom, type Write, applyEdit, isRefusal, nodeId, rev } from "./index.js"
import { type OrderKey, orderKeyBetween } from "./order-key.js"
import { agent, box, ids, land, once, sampleDeck, textOf } from "./sample-deck.js"
import { childrenOf, parentOf, propOf, slidesOf } from "./doom-walk.js"

export const runName = "run-1"

export function minter(client = "a"): () => NodeId {
  let counter = 0
  return () => nodeId(`${client}:${(counter += 1)}`)
}

export function started(doom: Doom, run = runName): Doom {
  const result = applyEdit(doom, {
    once: once(),
    author: agent(run),
    writes: [],
    phase: "start",
    rev: rev(doom.rev + 1),
  })
  if (isRefusal(result)) throw new Error(`refused ${JSON.stringify(result)}`)
  return result
}

export function apply(doom: Doom, writes: readonly Write[], run = runName): Doom {
  const result = applyEdit(doom, { once: once(), author: agent(run), writes, rev: rev(doom.rev + 1) })
  if (isRefusal(result)) throw new Error(`refused ${JSON.stringify(result)}`)
  return result
}

export function compiled(doom: Doom, change: AgentChange, mint = minter(), reading: Reading = {}): readonly Write[] {
  const writes = compileAgentChange(doom, change, mint, reading)
  if ("refused" in writes) throw new Error(`refused ${JSON.stringify(writes)}`)
  return writes
}

export const build = (doom: Doom, change: AgentChange, mint = minter()): Doom =>
  apply(doom, compiled(doom, change, mint))

export const agentDeck = (): Doom => started(sampleDeck())

export const firstSlide = (doom: Doom): NodeId => slidesOf(doom)[0]!.id

export const lastChild = (doom: Doom, parent: NodeId) => childrenOf(doom, parent).at(-1)!

export const boxOfNode = (doom: Doom, id: NodeId) => propOf(doom.nodes.get(id)!, "box")!

export const more = {
  slide2: nodeId("t:10"),
  layoutRow: nodeId("t:11"),
  layout: nodeId("t:12"),
  layoutTitle: nodeId("t:13"),
  layoutSubtitle: nodeId("t:14"),
  chart: nodeId("t:15"),
  line: nodeId("t:16"),
  icon: nodeId("t:17"),
  titled: nodeId("t:18"),
}

export function richDeck(): Doom {
  const sampled = sampleDeck()
  const cardKey = parentOf(sampled.nodes.get(ids.card)!)!.at as OrderKey
  const base = land(sampled, [
    { node: ids.side, prop: "parent", value: { id: ids.slide, at: orderKeyBetween(cardKey, null) } },
  ])
  const tails = new Map<NodeId, OrderKey | null>()
  const child = (id: NodeId, type: string, parent: NodeId, ...rest: readonly Write[]): Write[] => {
    const lastId = base.children.get(parent)?.at(-1)
    const last = tails.has(parent)
      ? tails.get(parent)!
      : lastId === undefined
        ? null
        : (parentOf(base.nodes.get(lastId)!)?.at ?? null)
    const key = orderKeyBetween(last as OrderKey | null, null)
    tails.set(parent, key)
    return [
      { node: id, prop: "type", value: type },
      { node: id, prop: "parent", value: { id: parent, at: key } },
      ...rest,
    ]
  }
  const on = (node: NodeId, prop: Write["prop"], value: unknown): Write => ({ node, prop, value })
  let doom = land(base, [
    ...child(more.slide2, "slide", ids.row, on(more.slide2, "name", "Slide 2")),
    ...child(more.titled, "shape", more.slide2, on(more.titled, "box", box(50, 50, 600, 90))),
    on(more.titled, "text", textOf("Old title")),
    on(more.titled, "role", "title"),
    ...child(more.chart, "frame", ids.slide, on(more.chart, "box", box(100, 300, 800, 500))),
    on(more.chart, "chart", {
      kind: "bar",
      categories: ["Q1", "Q2"],
      series: [
        { name: "Plan", values: [3, 4] },
        { name: "Actual", values: [2, 5] },
      ],
    }),
    ...child(more.line, "shape", ids.slide, on(more.line, "box", box(100, 200, 300, 0))),
    on(more.line, "geometry", {
      kind: "line",
      start: { x: 100, y: 200 },
      end: { x: 400, y: 200 },
      route: "straight",
      arrows: ["none", "none"],
    }),
    ...child(more.icon, "shape", ids.slide, on(more.icon, "box", box(900, 200, 96, 96))),
    on(more.icon, "geometry", { kind: "icon", name: "lucide/star" }),
  ])
  doom = land(doom, [
    ...child(more.layoutRow, "slideRow", ids.deck, on(more.layoutRow, "hidden", true)),
    ...child(more.layout, "slide", more.layoutRow, on(more.layout, "name", "Title")),
    on(more.layout, "fills", [{ kind: "solid", color: { var: "background2" } }]),
    ...child(more.layoutTitle, "shape", more.layout, on(more.layoutTitle, "box", box(100, 400, 1200, 160))),
    on(more.layoutTitle, "role", "title"),
    on(more.layoutTitle, "text", textOf("Title")),
    ...child(more.layoutSubtitle, "shape", more.layout, on(more.layoutSubtitle, "box", box(100, 600, 1200, 80))),
    on(more.layoutSubtitle, "role", "subtitle"),
    on(more.layoutSubtitle, "text", textOf("Subtitle")),
  ])
  return started(doom)
}
