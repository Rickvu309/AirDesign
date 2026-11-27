import { type NodeId, type Doom, type Write, nodeId } from "../index.js"
import { type OrderKey, orderKeyBetween } from "../order-key.js"
import { box, ids, land, sampleDeck, textOf } from "../sample-deck.js"
import { parentOf } from "../doom-walk.js"
import { started } from "../agent-fixtures.js"

export const more = {
  slide2: nodeId("t:10"),
  layoutRow: nodeId("t:11"),
  layout: nodeId("t:12"),
  layoutTitle: nodeId("t:13"),
  layoutSubtitle: nodeId("t:14"),
  frame: nodeId("t:15"),
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
  const withLayers = land(base, [
    ...child(more.slide2, "slide", ids.row, on(more.slide2, "name", "Slide 2")),
    ...child(more.titled, "shape", more.slide2, on(more.titled, "box", box(50, 50, 600, 90))),
    on(more.titled, "text", textOf("Old title")),
    on(more.titled, "role", "title"),
    ...child(more.frame, "frame", ids.slide, on(more.frame, "box", box(100, 300, 800, 500))),
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
  return started(
    land(withLayers, [
      ...child(more.layoutRow, "slideRow", ids.deck, on(more.layoutRow, "hidden", true)),
      ...child(more.layout, "slide", more.layoutRow, on(more.layout, "name", "Title")),
      on(more.layout, "fills", [{ kind: "solid", color: { var: "background2" } }]),
      ...child(more.layoutTitle, "shape", more.layout, on(more.layoutTitle, "box", box(100, 400, 1200, 160))),
      on(more.layoutTitle, "role", "title"),
      on(more.layoutTitle, "text", textOf("Title")),
      ...child(more.layoutSubtitle, "shape", more.layout, on(more.layoutSubtitle, "box", box(100, 600, 1200, 80))),
      on(more.layoutSubtitle, "role", "subtitle"),
      on(more.layoutSubtitle, "text", textOf("Subtitle")),
    ]),
  )
}
