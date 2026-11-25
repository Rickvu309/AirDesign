import {
  applyEdit,
  defaultTheme,
  doomFromTree,
  isRefusal,
  rev,
  type Doom,
  type Landed,
  type NodeId,
  type Write,
  type Refusal,
} from "../../index.js"
import { invertStep } from "../../invert.js"
import { onDeck, propOf } from "../../doom-walk.js"
import { at, box, frame, instance, measure, mint, person } from "./linked-instance-fixtures.js"
import { placeComponent } from "../join-instance.js"
import { prepareComponentEdit } from "../component-edit.js"

export function accepted<T>(value: T | Refusal): T {
  if (isRefusal(value)) throw new Error(JSON.stringify(value))
  return value
}

export const setup = () => {
  const { doom, slides } = doomFromTree({ theme: defaultTheme, slides: [{ children: [] }] })
  const deck = [...doom.nodes.values()].find(({ type }) => type === "deck")!.id
  const node = mint()
  return { doom, deck, node, slide: slides[0]! }
}

export const spec = (width: number) => ({
  version: 1,
  name: "Tile",
  collections: {},
  parts: [{ emit: { kind: "rect", key: ["list", "tile"], x: 0, y: 0, w: width, h: 100, fill: { var: "accent1" } } }],
  sample: { w: 300, h: 100, data: {} },
})

export function create(deck: ReturnType<typeof mint>, node: ReturnType<typeof mint>, raw: unknown): Write[] {
  return [
    { node, prop: "type", value: "component" },
    { node, prop: "parent", value: { id: deck, at } },
    { node, prop: "name", value: "Tile" },
    { node, prop: "spec", value: raw },
    { node, prop: "revision", value: 1 },
  ]
}

export function onSlideTwo() {
  const { doom, slides } = doomFromTree({ theme: defaultTheme, slides: [{ children: [] }, { children: [] }] })
  const deck = [...doom.nodes.values()].find(({ type }) => type === "deck")!.id
  const node = mint()
  const authored = accepted(applyEdit(doom, step(doom, create(deck, node, spec(100)))))
  const placing = placeComponent(
    authored,
    { node, revision: 1 },
    { frame, parent: { id: slides[1]!, at }, box, data: {}, measure },
  )
  const linked = accepted(applyEdit(authored, step(authored, accepted(placing))))
  return { linked, node, slide: slides[1]!, part: instance(linked).parts[0]!.node }
}

export function step(base: Doom, writes: readonly Write[]): Landed {
  return { once: `step-${base.rev + 1}`, rev: rev(base.rev + 1), readBase: base.rev, author: person, writes }
}

export function updating(fold: Doom, node: NodeId, width: number, revision: number): Landed {
  const base = (prop: "spec" | "revision") => fold.revs.get(node)!.get(prop)!
  const writes = prepareComponentEdit(
    fold,
    [
      { node, prop: "spec", value: spec(width), base: base("spec") },
      { node, prop: "revision", value: revision, base: base("revision") },
    ],
    measure,
  )
  return step(fold, accepted(writes))
}

export const updated = (fold: Doom, node: NodeId, width: number, revision: number) =>
  accepted(applyEdit(fold, updating(fold, node, width, revision)))

export function undone(before: Doom, landed: Landed, now: Doom): Doom {
  const writes = invertStep(before, now, landed, new Set(), measure)
  return accepted(applyEdit(now, step(now, accepted(writes))))
}

export const requiringRows = {
  ...spec(200),
  collections: { rows: { note: "string" } },
  sample: { w: 300, h: 100, data: { rows: [{ id: "a", note: "sample" }] } },
}

export function placedBy(fold: Doom, node: NodeId, slide: NodeId, revision: number, data: object = {}) {
  const other = mint()
  const placing = placeComponent(
    fold,
    { node, revision },
    { frame: other, parent: { id: slide, at }, box, data, measure },
  )
  const writes = accepted(placing)
  return {
    other,
    now: accepted(applyEdit(fold, { ...step(fold, writes), author: { kind: "person", id: "elsewhere" } })),
  }
}

export const tileWidth = (fold: Doom, root: NodeId) =>
  propOf(fold.nodes.get(propOf(fold.nodes.get(root), "instance")!.parts[0]!.node), "box")?.w

export function first(fold: Doom): NodeId {
  return [...fold.nodes.values()].find((node) => node.type === "slide" && onDeck(fold.nodes, node.id))!.id
}
