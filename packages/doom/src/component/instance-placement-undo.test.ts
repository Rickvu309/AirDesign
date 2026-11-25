import { expect, it } from "vitest"
import {
  columnDefinition,
  defaultTheme,
  doomFromTree,
  invert,
  invertRun,
  isRefusal,
  orderKeyBetween,
  placeComponent,
  replacedBy,
  type Write,
} from "../index.js"
import { onDeck, propOf } from "../doom-walk.js"
import { at, box, data, frame, land, measure, mint, person } from "./linked-instance-fixtures.js"

it("keeps the entire placement if removing it would drop a later move of its manual child", () => {
  const { doom: before, slides } = doomFromTree({ theme: defaultTheme, slides: [{ children: [] }] })
  const chart = placeComponent(before, columnDefinition, {
    frame,
    parent: { id: slides[0]!, at },
    box,
    data: data(1, 2),
    measure,
  })
  if (isRefusal(chart)) throw new Error(JSON.stringify(chart))
  const child = mint()
  const writes: Write[] = [
    ...chart,
    { node: child, prop: "type", value: "shape" },
    { node: child, prop: "parent", value: { id: frame, at: orderKeyBetween(at, null) } },
  ]
  const after = land(before, writes, true)
  const current = land(after, [{ node: child, prop: "parent", value: { id: frame, at: orderKeyBetween(null, at) } }])
  expect(invert(before, current, { once: "place", author: person, rev: after.rev, writes })).toEqual([])
})

it("undoes an agent chart placement while keeping another layer and its later connector", () => {
  const { doom: before, slides } = doomFromTree({ theme: defaultTheme, slides: [{ children: [] }] })
  const slide = slides[0]!
  const chart = placeComponent(before, columnDefinition, {
    frame,
    parent: { id: slide, at },
    box,
    data: data(1, 2),
    measure,
  })
  if (isRefusal(chart)) throw new Error(JSON.stringify(chart))
  const shape = mint()
  const line = mint()
  const writes: Write[] = [
    ...chart,
    { node: shape, prop: "type", value: "shape" },
    { node: shape, prop: "parent", value: { id: slide, at: orderKeyBetween(at, null) } },
    { node: shape, prop: "box", value: box },
    { node: shape, prop: "geometry", value: { kind: "rect" } },
  ]
  const after = land(before, writes, true)
  const current = land(after, [
    { node: shape, prop: "name", value: "Keep this shape" },
    { node: line, prop: "type", value: "shape" },
    { node: line, prop: "parent", value: { id: slide, at: orderKeyBetween(null, at) } },
    { node: line, prop: "box", value: box },
    {
      node: line,
      prop: "geometry",
      value: {
        kind: "line",
        start: { node: shape, site: "b" },
        end: { x: 0, y: 0 },
        route: "straight",
        arrows: ["none", "none"],
      },
    },
  ])
  const edit = { once: "place", author: person, rev: after.rev, writes }
  const undo = invertRun(current, [{ ...edit, replaced: replacedBy(before, edit) }])
  expect(undo.kept).toEqual([shape])
  const result = land(current, undo.writes, true)
  expect(onDeck(result.nodes, frame)).toBe(false)
  expect(propOf(result.nodes.get(line), "geometry")).toEqual(propOf(current.nodes.get(line), "geometry"))
})
