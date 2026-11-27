import { defaultTheme } from "./theme.js"
import { orderKeyBetween, type OrderKey } from "./order-key.js"
import {
  applyEdit,
  emptyDoom,
  isRefusal,
  nodeId,
  rev,
  type Hex,
  type Author,
  type NodeId,
  type Refusal,
  type Doom,
  type Text,
  type Theme,
  type Write,
} from "./index.js"
import { colorVars } from "./paint.js"

export const ids = {
  deck: nodeId("t:1"),
  row: nodeId("t:2"),
  slide: nodeId("t:3"),
  card: nodeId("t:4"),
  side: nodeId("t:5"),
  title: nodeId("t:6"),
  caption: nodeId("t:7"),
}

export const hex = (seed: number): Hex => `#${seed.toString(16).padStart(6, "0")}`

export const person: Author = { kind: "person", id: "quan" }
export const agent = (run: string): Author => ({ kind: "agent", id: "aira", run })

export function theme(): Theme {
  const style = { size: 32, font: "body", weight: 400, lineHeight: 1.2, tracking: 0 } as const
  return {
    colors: Object.fromEntries(
      colorVars.map((name, index) => [name, `#${String(index % 10).repeat(6)}`]),
    ) as Theme["colors"],
    fonts: { heading: "Inter", body: "Inter" },
    textStyles: {
      display: { ...style, size: 112, font: "heading" },
      bigNumber: { ...style, size: 96 },
      title: { ...style, size: 64, font: "heading" },
      heading: { ...style, size: 44, font: "heading" },
      body: style,
      body2: { ...style, size: 28 },
      caption: { ...style, size: 22 },
      label: { ...style, size: 20 },
    },
    effectStyles: defaultTheme.effectStyles,
  }
}

export function textOf(chars: string): Text {
  return {
    chars,
    spans: [],
    paras: chars.split("\n").map(() => ({})),
    style: "body",
    resize: "height",
    alignV: "top",
  }
}

export const box = (x: number, y = 0, w = 200, h = 100) => ({ x, y, w, h, rotation: 0, flipH: false, flipV: false })

export const place = (parent: NodeId, after: OrderKey | null = null) => ({
  id: parent,
  at: orderKeyBetween(after, null),
})

let counter = 0

export const once = () => `once-${(counter += 1)}`

export function tryLand(doom: Doom, writes: readonly Write[], by: Author = person): Doom | Refusal {
  return applyEdit(doom, { once: once(), author: by, writes, rev: rev(doom.rev + 1) })
}

export function land(doom: Doom, writes: readonly Write[], by: Author = person): Doom {
  const result = tryLand(doom, writes, by)
  if (isRefusal(result)) throw new Error(`refused ${JSON.stringify(result)}`)
  return result
}

export const create = (node: NodeId, type: string, parent: NodeId | null, ...rest: readonly Write[]): Write[] => [
  { node, prop: "type", value: type },
  ...(parent === null ? [] : [{ node, prop: "parent" as const, value: place(parent) }]),
  ...rest,
]

export function sampleDeck(): Doom {
  let doom = land(emptyDoom, [
    ...create(ids.deck, "deck", null),
    { node: ids.deck, prop: "name", value: "Deck" },
    { node: ids.deck, prop: "theme", value: theme() },
    { node: ids.deck, prop: "size", value: { w: 1920, h: 1080 } },
  ])
  doom = land(doom, create(ids.row, "slideRow", ids.deck))
  doom = land(doom, create(ids.slide, "slide", ids.row, { node: ids.slide, prop: "name", value: "Slide 1" }))
  doom = land(doom, [
    ...create(ids.card, "frame", ids.slide, { node: ids.card, prop: "box", value: box(100) }),
    ...create(ids.side, "frame", ids.slide, { node: ids.side, prop: "box", value: box(400) }),
    ...create(ids.title, "shape", ids.card, { node: ids.title, prop: "box", value: box(0) }),
    { node: ids.title, prop: "text", value: textOf("Revenue") },
    ...create(ids.caption, "shape", ids.side, { node: ids.caption, prop: "box", value: box(0) }),
  ])
  return doom
}

export const revOf = (doom: Doom, node: NodeId, prop: string) => doom.revs.get(node)?.get(prop as never)
