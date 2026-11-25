import { expect, it } from "vitest"
import {
  applyEdit,
  defaultTheme,
  doomFromTree,
  invert,
  isRefusal,
  rev,
  type Landed,
  type Write,
  type Refusal,
} from "../index.js"
import { viewOf } from "../view-of.js"
import { onDeck } from "../doom-walk.js"
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
})
