import { columnDefinition } from "./library.js"
import { expect, it } from "vitest"

import {
  compileAgentEdit,
  componentTree,
  defaultTheme,
  doomFromTree,
  invertRun,
  invertStep,
  isRefusal,
  placeComponent,
  replacedBy,
  rev,
  suppressPart,
  undoSourceOf,
  type Landed,
} from "../index.js"
import { onDeck, propOf } from "../doom-walk.js"
import {
  at,
  box,
  data,
  frame,
  instance,
  land,
  measure,
  mint,
  part,
  person,
  placed,
  refresh,
} from "./testing/linked-instance-fixtures.js"

it("inverts chart placement for a person and for a run", () => {
  const { doom: before, slides } = doomFromTree({ theme: defaultTheme, slides: [{ children: [] }] })
  const writes = placeComponent(before, columnDefinition, {
    frame,
    parent: { id: slides[0]!, at },
    box,
    data: data(1, 2),
    measure,
  })
  if (isRefusal(writes)) throw new Error(JSON.stringify(writes))
  const edit: Landed = { once: "place", author: person, writes, readBase: before.rev, rev: rev(before.rev + 1) }
  const after = land(before, writes, true)
  const chart = instance(after)
  for (const [path, inverse] of [
    ["person", invertStep(before, after, edit)],
    ["compact run", invertRun(after, [undoSourceOf(before, edit)]).writes],
    ["full run", invertRun(after, [{ ...edit, replaced: replacedBy(before, edit) }]).writes],
  ] as const) {
    if (isRefusal(inverse)) throw new Error(JSON.stringify(inverse))
    const undone = land(after, inverse, true)
    for (const node of [frame, chart.generated, ...chart.parts.map(({ node }) => node)])
      expect(onDeck(undone.nodes, node), path).toBe(false)
  }
})

it("restores a chart when a run undoes its placement", () => {
  const before = placed()
  const chart = instance(before)
  const writes = [
    { node: frame, prop: "instance", value: null },
    ...[frame, chart.generated, ...chart.parts.map(({ node }) => node)].map((node) => ({
      node,
      prop: "parent" as const,
      value: null,
    })),
  ] as const
  const removal = { once: "remove", author: person, readBase: before.rev, rev: rev(before.rev + 1), writes }
  const removed = land(before, writes, true)
  const turned = invertRun(removed, [undoSourceOf(before, removal)])
  expect(turned.left).toEqual([])
  const restored = land(removed, turned.writes, true)
  expect(onDeck(restored.nodes, frame)).toBe(true)
  expect(instance(restored)).toEqual(chart)
})

it("refuses an entire run undo if the chart cannot be restored", () => {
  const before = placed()
  const suppress = suppressPart(before, frame, part(before, "bar", "a"), measure)
  if (isRefusal(suppress)) throw new Error(JSON.stringify(suppress))
  const edit: Landed = {
    once: "hide",
    author: person,
    writes: suppress,
    readBase: before.rev,
    rev: rev(before.rev + 1),
  }
  const after = land(before, suppress, true)
  const broken = land(
    after,
    [
      { node: frame, prop: "box", value: null },
      { node: frame, prop: "instance", value: instance(after) },
    ],
    true,
  )
  expect(invertRun(broken, [undoSourceOf(before, edit)])).toMatchObject({ writes: [], refused: { prop: "instance" } })
})

it("lets an agent override a fitted chart label and keeps the style on the next data update", () => {
  const before = placed()
  const crowded = {
    rows: Array.from({ length: 12 }, (_, i) => ({ id: `r${i}`, label: `Quarterly revenue ${i}`, value: i + 1 })),
  }
  const joined = land(before, refresh(before, { data: crowded, tokens: { captionSmall: 20 } }), true)
  const label = part(joined, "category", "r0")
  expect(propOf(joined.nodes.get(label), "text")?.spans[0]?.size).toBeDefined()
  const compiled = compileAgentEdit(joined, [{ op: "set", target: label, textStyle: "title" }], {
    once: "style",
    author: { kind: "agent", id: "aira", run: "style" },
    phase: "start",
    mint,
  })
  if (isRefusal(compiled)) throw new Error(JSON.stringify(compiled))
  const styled = land(joined, compiled.edit.writes, true)
  expect(propOf(styled.nodes.get(label), "text")?.style).toBe("title")
  const next = land(
    styled,
    refresh(styled, { data: { rows: crowded.rows.map((row) => ({ ...row, value: row.value + 1 })) } }),
    true,
  )
  expect(propOf(next.nodes.get(label), "text")?.style).toBe("title")
})

it("keeps category focus through a row join and undoes a focus edit", () => {
  const before = placed()
  const bar = part(before, "bar", "b")
  const writes = refresh(before, { focus: ["a"] })
  const edit: Landed = { once: "focus", author: person, writes, readBase: before.rev, rev: rev(before.rev + 1) }
  const focused = land(before, writes, true)
  expect(instance(focused).focus).toEqual(["a"])
  expect(propOf(focused.nodes.get(bar), "fills")).toEqual([
    { kind: "solid", color: { var: "text2", tint: expect.any(Number) } },
  ])
  const refreshed = land(focused, refresh(focused, { data: data(7, 9) }), true)
  expect(part(refreshed, "bar", "b")).toBe(bar)
  expect(instance(refreshed).focus).toEqual(["a"])
  for (const [current, inverse] of [
    [focused, invertStep(before, focused, edit)],
    [refreshed, invertRun(refreshed, [undoSourceOf(before, edit)]).writes],
  ] as const) {
    if (isRefusal(inverse)) throw new Error(JSON.stringify(inverse))
    const restored = land(current, inverse, true)
    expect(instance(restored).focus).toEqual([])
    expect(instance(restored).data).toEqual(instance(current).data)
    expect(propOf(restored.nodes.get(bar), "fills")).toEqual([{ kind: "solid", color: { var: "accent1" } }])
  }
})

it("restores ordinary fills when a data join removes the focused row", () => {
  const before = placed()
  const focused = land(before, refresh(before, { focus: ["b"] }), true)
  const joined = land(focused, refresh(focused, { data: { rows: [{ id: "a", label: "A", value: 5 }] } }), true)
  expect(propOf(joined.nodes.get(part(joined, "bar", "a")), "fills")).toEqual([
    { kind: "solid", color: { var: "accent1" } },
  ])
  const tree = componentTree(joined, frame, measure)
  if (isRefusal(tree)) throw new Error(JSON.stringify(tree))
  expect(tree.findings).toContainEqual(expect.objectContaining({ kind: "focus-missing", unknown: ["b"] }))
})
