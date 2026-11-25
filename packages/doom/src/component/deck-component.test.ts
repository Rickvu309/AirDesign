import { expect, it } from "vitest"
import {
  applyEdit,
  defaultTheme,
  doomFromTree,
  invert,
  isRefusal,
  rev,
  type Doom,
  type Landed,
  type NodeId,
  type Write,
  type Refusal,
} from "../index.js"
import { invertStep } from "../invert.js"
import { invertRun, undoSourceOf } from "../invert-run.js"
import { viewOf } from "../view-of.js"
import { onDeck, propOf } from "../doom-walk.js"
import { at, box, frame, instance, measure, mint, person } from "./testing/linked-instance-fixtures.js"
import { placeComponent } from "./join-instance.js"
import { prepareComponentEdit } from "./component-edit.js"
import { foldToJson, readFold, readLanded } from "../fold-json.js"

function accepted<T>(value: T | Refusal): T {
  if (isRefusal(value)) throw new Error(JSON.stringify(value))
  return value
}

const setup = () => {
  const { doom, slides } = doomFromTree({ theme: defaultTheme, slides: [{ children: [] }] })
  const deck = [...doom.nodes.values()].find(({ type }) => type === "deck")!.id
  const node = mint()
  return { doom, deck, node, slide: slides[0]! }
}

const spec = (width: number) => ({
  version: 1,
  name: "Tile",
  collections: {},
  parts: [{ emit: { kind: "rect", key: ["list", "tile"], x: 0, y: 0, w: width, h: 100, fill: { var: "accent1" } } }],
  sample: { w: 300, h: 100, data: {} },
})

function create(deck: ReturnType<typeof mint>, node: ReturnType<typeof mint>, raw: unknown): Write[] {
  return [
    { node, prop: "type", value: "component" },
    { node, prop: "parent", value: { id: deck, at } },
    { node, prop: "name", value: "Tile" },
    { node, prop: "spec", value: raw },
    { node, prop: "revision", value: 1 },
  ]
}

it("places, rebuilds and detaches a deck component, with replay and undo", () => {
  const { doom, deck, node, slide } = setup()
  const edit = (base: typeof doom, writes: readonly Write[]): Landed => ({
    once: `component-${base.rev + 1}`,
    rev: rev(base.rev + 1),
    readBase: base.rev,
    author: person,
    writes,
  })
  const undo = (before: typeof doom, after: typeof doom, landed: Landed) =>
    accepted(applyEdit(after, edit(after, invert(before, after, landed))))
  const created = edit(doom, create(deck, node, spec(100)))
  const authored = accepted(applyEdit(doom, created))
  expect(onDeck(undo(doom, authored, created).nodes, node)).toBe(false)

  const placed = edit(
    authored,
    accepted(
      placeComponent(
        authored,
        { node, revision: 1 },
        {
          frame,
          parent: { id: slide, at },
          box,
          data: {},
          measure,
        },
      ),
    ),
  )
  const linked = accepted(applyEdit(authored, placed))
  expect(onDeck(undo(authored, linked, placed).nodes, frame)).toBe(false)
  const part = instance(linked).parts[0]!.node

  const updated = edit(
    linked,
    accepted(
      prepareComponentEdit(
        linked,
        [
          { node, prop: "spec", value: spec(200), base: authored.rev },
          { node, prop: "revision", value: 2, base: authored.rev },
        ],
        measure,
      ),
    ),
  )
  const rebuilt = accepted(applyEdit(linked, updated))
  expect(instance(rebuilt).component).toEqual({ node, revision: 2 })
  expect(rebuilt.nodes.get(part)).toMatchObject({ box: { w: 200 } })
  const restored = undo(linked, rebuilt, updated)
  expect(instance(restored)).toEqual(instance(linked))
  expect(restored.nodes.get(part)).toMatchObject({ box: { w: 100 } })

  const reopened = readFold(JSON.parse(JSON.stringify(foldToJson(linked))))!
  const queued = accepted(readLanded(JSON.parse(JSON.stringify(updated)), reopened))
  expect(accepted(applyEdit(reopened, queued))).toEqual(rebuilt)
  expect(viewOf(reopened, [queued])).toEqual(rebuilt)
  const movedHead = accepted(applyEdit(reopened, edit(reopened, [{ node: deck, prop: "name", value: "Later" }])))
  expect(viewOf(movedHead, [queued])).toEqual(movedHead)

  const deleted = edit(rebuilt, [{ node, prop: "parent", value: null }])
  const detached = accepted(applyEdit(rebuilt, deleted))
  expect(detached.nodes.get(frame)).not.toHaveProperty("instance")
  expect(detached.nodes.get(part)).toEqual(rebuilt.nodes.get(part))
  expect(instance(undo(rebuilt, detached, deleted))).toEqual(instance(rebuilt))
})

it("scopes component byte and count refusals to the offending fields", () => {
  const { doom, deck, node } = setup()
  const apply = (writes: readonly Write[]) =>
    applyEdit(doom, {
      once: "limited",
      rev: rev(doom.rev + 1),
      author: person,
      writes,
    })
  const wideSpec = (tokens: number) => ({
    ...spec(100),
    defaults: Object.fromEntries(Array.from({ length: tokens }, (_, i) => [`token${i}`, "é".repeat(250)])),
  })
  expect(isRefusal(apply(create(deck, node, wideSpec(62))))).toBe(false)
  expect(apply(create(deck, node, wideSpec(64)))).toMatchObject({
    refused: "limit",
    node,
    prop: "spec",
  })
  const nodes = Array.from({ length: 33 }, mint)
  expect(isRefusal(apply(nodes.slice(0, 32).flatMap((id) => create(deck, id, spec(100)))))).toBe(false)
  expect(apply(nodes.flatMap((id) => create(deck, id, spec(100))))).toMatchObject({
    refused: "limit",
    node: nodes[32],
    prop: "parent",
  })
  const full = accepted(apply(nodes.slice(0, 32).flatMap((id) => create(deck, id, spec(100)))))
  const removed = accepted(applyEdit(full, step(full, [{ node: nodes[5]!, prop: "parent", value: null }])))
  const refilled = accepted(applyEdit(removed, step(removed, create(deck, nodes[32]!, spec(100)))))
  expect(
    applyEdit(refilled, step(refilled, [{ node: nodes[5]!, prop: "parent", value: { id: deck, at } }])),
  ).toMatchObject({ refused: "limit", node: nodes[5], prop: "parent" })
})

function onSlideTwo() {
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

function step(base: Doom, writes: readonly Write[]): Landed {
  return { once: `step-${base.rev + 1}`, rev: rev(base.rev + 1), readBase: base.rev, author: person, writes }
}

function updating(fold: Doom, node: NodeId, width: number, revision: number): Landed {
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

const updated = (fold: Doom, node: NodeId, width: number, revision: number) =>
  accepted(applyEdit(fold, updating(fold, node, width, revision)))

function undone(before: Doom, landed: Landed, now: Doom): Doom {
  const writes = invertStep(before, now, landed, new Set(), measure)
  return accepted(applyEdit(now, step(now, accepted(writes))))
}

it("rebuilds an instance at the current spec when a slide delete is undone after its component changed", () => {
  const { linked, node, slide, part } = onSlideTwo()
  const deleting = step(linked, [{ node: slide, prop: "parent", value: null }])
  const gone = accepted(applyEdit(linked, deleting))
  const changed = updated(gone, node, 200, 2)
  const back = undone(linked, deleting, changed)
  expect(onDeck(back.nodes, frame)).toBe(true)
  expect(instance(back).component).toEqual({ node, revision: 2 })
  expect(back.nodes.get(part)).toMatchObject({ box: { w: 200 } })
})

it("brings an instance back detached when a slide delete is undone after its component was deleted", () => {
  const { linked, node, slide, part } = onSlideTwo()
  const deleting = step(linked, [{ node: slide, prop: "parent", value: null }])
  const gone = accepted(applyEdit(linked, deleting))
  const removed = accepted(applyEdit(gone, step(gone, [{ node, prop: "parent", value: null }])))
  const back = undone(linked, deleting, removed)
  expect(onDeck(back.nodes, frame)).toBe(true)
  expect(back.nodes.get(frame)).not.toHaveProperty("instance")
  expect(onDeck(back.nodes, part)).toBe(true)
  expect(back.nodes.get(part)).toEqual(linked.nodes.get(part))
})

it("rebuilds an instance at the current spec when its own delete is undone after its component changed", () => {
  const { linked, node, part } = onSlideTwo()
  const deleting = step(linked, [{ node: frame, prop: "parent", value: null }])
  const gone = accepted(applyEdit(linked, deleting))
  const changed = updated(gone, node, 200, 2)
  const back = undone(linked, deleting, changed)
  expect(onDeck(back.nodes, frame)).toBe(true)
  expect(instance(back).component).toEqual({ node, revision: 2 })
  expect(back.nodes.get(part)).toMatchObject({ box: { w: 200 } })
})

it("undoes the rest of a spec update when one of its instances was deleted since, and rebuilds that one when it returns", () => {
  const { linked: one, node, slide } = onSlideTwo()
  const other = mint()
  const placing = placeComponent(
    one,
    { node, revision: 1 },
    { frame: other, parent: { id: slide, at }, box, data: {}, measure },
  )
  const linked = accepted(applyEdit(one, step(one, accepted(placing))))
  const update = updating(linked, node, 200, 2)
  const rebuilt = accepted(applyEdit(linked, update))
  const deleting = step(rebuilt, [{ node: other, prop: "parent", value: null }])
  const deleted = accepted(applyEdit(rebuilt, deleting))
  const kept = propOf(deleted.nodes.get(other), "instance")

  const reverted = undone(linked, update, deleted)
  expect(propOf(reverted.nodes.get(node), "revision")).toBe(1)
  expect(instance(reverted)).toEqual(instance(linked))
  expect(propOf(reverted.nodes.get(other), "instance")).toEqual(kept)

  const run = invertRun(deleted, [undoSourceOf(linked, update)], new Set(), undefined, measure)
  expect(run.kept).toEqual([other])
  expect(accepted(applyEdit(deleted, step(deleted, run.writes))).nodes.get(node)).toEqual(reverted.nodes.get(node))

  const back = undone(rebuilt, deleting, reverted)
  expect(propOf(back.nodes.get(other), "instance")?.component).toEqual({ node, revision: 1 })
  const part = propOf(back.nodes.get(other), "instance")!.parts[0]!.node
  expect(back.nodes.get(part)).toMatchObject({ box: { w: 100 } })
})
