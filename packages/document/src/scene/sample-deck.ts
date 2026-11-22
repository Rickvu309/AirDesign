import { orderKeyBetween, type OrderKey } from "../order-key.js"
import {
  applyEdit,
  emptyScene,
  isRefusal,
  nodeId,
  rev,
  type Hex,
  type Author,
  type NodeId,
  type Refusal,
  type Scene,
  type Text,
  type Theme,
  type Write,
} from "./index.js"

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

export const colorNames = [
  "text",
  "background",
  "text2",
  "background2",
  "accent1",
  "accent2",
  "accent3",
  "accent4",
  "accent5",
  "accent6",
  "link",
] as const

export function theme(): Theme {
  const style = { size: 32, font: "body", weight: 400, lineHeight: 1.2, tracking: 0 } as const
  return {
    colors: Object.fromEntries(
      colorNames.map((name, index) => [name, `#${String(index % 10).repeat(6)}`]),
    ) as Theme["colors"],
    fonts: { heading: "Inter", body: "Inter" },
    textStyles: {
      bigNumber: { ...style, size: 96 },
      title: { ...style, size: 64, font: "heading" },
      heading: { ...style, size: 44, font: "heading" },
      body: style,
      body2: { ...style, size: 28 },
      caption: { ...style, size: 22 },
      label: { ...style, size: 20 },
    },
    effectStyles: {
      soft: [{ kind: "dropShadow", color: hex(0x000000), x: 0, y: 4, blur: 12, spread: 0 }],
      lifted: [{ kind: "dropShadow", color: hex(0x000000), x: 0, y: 12, blur: 32, spread: 0 }],
      glow: [{ kind: "layerBlur", radius: 8 }],
    },
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

export function tryLand(scene: Scene, writes: readonly Write[], by: Author = person): Scene | Refusal {
  return applyEdit(scene, { once: once(), author: by, writes, rev: rev(scene.rev + 1) })
}

export function land(scene: Scene, writes: readonly Write[], by: Author = person): Scene {
  const result = tryLand(scene, writes, by)
  if (isRefusal(result)) throw new Error(`refused ${JSON.stringify(result)}`)
  return result
}

export const create = (node: NodeId, type: string, parent: NodeId | null, ...rest: readonly Write[]): Write[] => [
  { node, prop: "type", value: type },
  ...(parent === null ? [] : [{ node, prop: "parent" as const, value: place(parent) }]),
  ...rest,
]

export function sampleDeck(): Scene {
  let scene = land(emptyScene, [
    ...create(ids.deck, "deck", null),
    { node: ids.deck, prop: "name", value: "Deck" },
    { node: ids.deck, prop: "theme", value: theme() },
    { node: ids.deck, prop: "size", value: { w: 1920, h: 1080 } },
  ])
  scene = land(scene, create(ids.row, "slideRow", ids.deck))
  scene = land(scene, create(ids.slide, "slide", ids.row, { node: ids.slide, prop: "name", value: "Slide 1" }))
  scene = land(scene, [
    ...create(ids.card, "frame", ids.slide, { node: ids.card, prop: "box", value: box(100) }),
    ...create(ids.side, "frame", ids.slide, { node: ids.side, prop: "box", value: box(400) }),
    ...create(ids.title, "shape", ids.card, { node: ids.title, prop: "box", value: box(0) }),
    { node: ids.title, prop: "text", value: textOf("Revenue") },
    ...create(ids.caption, "shape", ids.side, { node: ids.caption, prop: "box", value: box(0) }),
  ])
  return scene
}

export function valuesOf(scene: Scene): Record<string, unknown> {
  return Object.fromEntries(
    [...scene.nodes].map(([id, node]) => [
      id,
      Object.fromEntries(Object.entries(node).filter(([key]) => key !== "rev")),
    ]),
  )
}

export const revOf = (scene: Scene, node: NodeId, prop: string) => scene.revs.get(node)?.get(prop as never)
