import { placeComponent, regenerateComponent } from "./join-instance.js"
import { expect, it } from "vitest"

import { defaultTheme, doomFromTree, isRefusal } from "../index.js"
import { propOf } from "../doom-walk.js"
import { componentLibrary } from "./library.js"
import type { Part } from "./spec.js"
import { expand } from "./testing/diagram-tree.js"
import { at, box, frame, instance, land, measure, mint, part } from "./testing/linked-instance-fixtures.js"

const ungrouped = (parts: readonly Part[]): readonly Part[] =>
  parts.map((each) => {
    if (!("children" in each)) return each
    const { group: _, ...rest } = each
    return { ...rest, children: ungrouped(each.children) }
  })

function placedBeforeGroups(id: string, data: unknown, variant?: Record<string, string>) {
  const definition = componentLibrary.get(id)!
  const older = { ...definition, spec: { ...definition.spec, parts: ungrouped(definition.spec.parts) } }
  const { doom, slides } = doomFromTree({ theme: defaultTheme, slides: [{ children: [] }] })
  const writes = placeComponent(doom, older, {
    frame,
    parent: { id: slides[0]!, at },
    box,
    data,
    measure,
    ...(variant === undefined ? {} : { variant }),
  })
  if (isRefusal(writes)) throw new Error(JSON.stringify(writes))
  return { doom: land(doom, writes, true), parent: slides[0]! }
}

function regenerated(fold: ReturnType<typeof land>, data: unknown) {
  const update = regenerateComponent(fold, frame, { data }, measure)
  if (isRefusal(update)) throw new Error(JSON.stringify(update))
  return { findings: update.findings, after: land(fold, update.writes, true) }
}

it("keeps the part keys that placed diagrams already hold", () => {
  const roles = (id: string, data: unknown, variant?: Record<string, string>) => {
    const tree = expand(componentLibrary.get(id)!.spec, { frame: { x: 0, y: 0, w: 1600, h: 700 }, data, variant })
    return [...new Set(tree.children.map(({ key }) => key[0]))].sort()
  }
  const steps = [
    { id: "s0", label: "Discover", note: "2 weeks" },
    { id: "s1", label: "Define" },
  ]
  expect(roles("process", { steps }, { direction: "column" })).toEqual(["connector", "duration", "step"])
  expect(roles("matrix", componentLibrary.get("matrix")!.spec.sample!.data)).toEqual([
    "axis",
    "axis-title",
    "dot",
    "item",
    "quadrant",
    "tile",
  ])
})

it("regenerates an older linked process with its restyled card, deleted duration and attached connector", () => {
  const steps = ["Discover", "Define", "Design"].map((label, i) => ({ id: `s${i}`, label, note: "2 weeks" }))
  const placed = placedBeforeGroups("process", { steps }, { direction: "column" })
  const card = part(placed.doom, "step", "s0")
  const line = mint()
  const text = { ...propOf(placed.doom.nodes.get(card), "text")!, style: "body2" } as const
  const edited = land(placed.doom, [
    { node: card, prop: "text", value: text },
    { node: card, prop: "name", value: "My discovery card" },
    { node: part(placed.doom, "duration", "s1"), prop: "parent", value: null },
    { node: line, prop: "type", value: "shape" },
    { node: line, prop: "parent", value: { id: placed.parent, at } },
    { node: line, prop: "box", value: box },
    {
      node: line,
      prop: "geometry",
      value: {
        kind: "line",
        start: { node: card, site: "b" },
        end: { x: 10, y: 20 },
        route: "straight",
        arrows: ["none", "none"],
      },
    },
  ])

  const { findings, after } = regenerated(edited, {
    steps: steps.map((step, i) => (i === 2 ? { ...step, label: "Prototype" } : step)),
  })

  expect(findings).toEqual([])
  expect(part(after, "step", "s0")).toBe(card)
  expect(after.nodes.get(card)).toMatchObject({ name: "My discovery card", text: { style: "body2" } })
  expect(instance(after).suppressed).toEqual([{ key: ["duration", "s1"], reason: "delete" }])
  expect(propOf(after.nodes.get(line), "geometry")).toMatchObject({ start: { node: card, site: "b" } })
  expect(propOf(after.nodes.get(part(after, "connector", "s0")), "geometry")).toMatchObject({
    start: { node: card },
    end: { node: part(after, "step", "s1") },
  })
})

it("regenerates an older linked matrix with its edited labels and deleted item", () => {
  const data = componentLibrary.get("matrix")!.spec.sample!.data as { readonly items: readonly object[] }
  const placed = placedBeforeGroups("matrix", data)
  const quadrant = part(placed.doom, "quadrant", "upper-left")
  const item = part(placed.doom, "item", "item1")
  const edited = land(placed.doom, [
    { node: quadrant, prop: "name", value: "Our quadrant label" },
    { node: item, prop: "name", value: "Our marketplace" },
    { node: part(placed.doom, "item", "item2"), prop: "parent", value: null },
  ])

  const { findings, after } = regenerated(edited, {
    ...data,
    items: data.items.map((each, i) => (i === 2 ? { ...each, label: "Services" } : each)),
  })

  expect(findings).toEqual([])
  expect(part(after, "quadrant", "upper-left")).toBe(quadrant)
  expect(part(after, "item", "item1")).toBe(item)
  expect(after.nodes.get(quadrant)).toMatchObject({ name: "Our quadrant label" })
  expect(after.nodes.get(item)).toMatchObject({ name: "Our marketplace" })
  expect(instance(after).suppressed).toEqual([{ key: ["item", "item2"], reason: "delete" }])
})
