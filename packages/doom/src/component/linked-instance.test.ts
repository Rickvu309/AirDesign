import { columnDefinition } from "./library.js"
import { expect, it } from "vitest"

import {
  type Write,
  applyEdit,
  compileAgentEdit,
  defaultTheme,
  orderKeyBetween,
  doomFromTree,
  invert,
  invertRun,
  isRefusal,
  replacedBy,
  undoSourceOf,
  rev,
  placeComponent,
  regenerateComponent,
  detachComponent,
  suppressPart,
  suppressKeys,
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
} from "./linked-instance-fixtures.js"

it("joins the same key after reorder, preserves exact overrides and leaves manual siblings in place", () => {
  const first = placed()
  const a = part(first, "bar", "a")
  const manual = mint()
  const fills = [{ kind: "solid", color: { var: "accent2" } }]
  const edited = land(first, [
    { node: a, prop: "fills", value: fills },
    { node: manual, prop: "type", value: "shape" },
    { node: manual, prop: "parent", value: { id: frame, at } },
  ])
  const after = land(
    edited,
    refresh(edited, {
      data: { rows: data(6, 4).rows.reverse() },
      tokens: { accent: { var: "accent3" } },
    }),
    true,
  )
  expect(part(after, "bar", "a")).toBe(a)
  expect(after.nodes.get(a)).toMatchObject({ fills })
  expect(after.nodes.get(a)).not.toMatchObject({ box: propOf(first.nodes.get(a), "box") })
  expect(after.nodes.get(manual)).toBe(edited.nodes.get(manual))
  const reset = land(after, [{ node: a, prop: "fills", value: [{ kind: "solid", color: { var: "accent3" } }] }])
  const refreshed = land(reset, refresh(reset, { tokens: { accent: { var: "accent4" } } }), true)
  expect(refreshed.nodes.get(a)).toMatchObject({ fills: [{ kind: "solid", color: { var: "accent4" } }] })
})

it("discards suppression on row exit and allows detach and exact relink in one inverse", () => {
  const first = placed()
  const a = part(first, "bar", "a")
  const b = part(first, "bar", "b")
  const suppressed = suppressPart(first, frame, a, measure)
  if (isRefusal(suppressed)) throw new Error(JSON.stringify(suppressed))
  const withoutA = land(first, suppressed, true)
  const exit = regenerateComponent(withoutA, frame, { data: { rows: [] } }, measure)
  if (isRefusal(exit)) throw new Error(JSON.stringify(exit))
  expect(exit.findings).toContainEqual({ kind: "discarded-suppression", key: ["bar", "a"] })
  const withoutB = land(withoutA, exit.writes, true)
  expect(instance(withoutB).suppressed).toEqual([])
  expect(onDeck(withoutB.nodes, b)).toBe(false)
  const again = land(withoutB, refresh(withoutB, { data: data(2, 3) }), true)
  expect(part(again, "bar", "a")).toBe(a)
  expect(part(again, "bar", "b")).toBe(b)
  const writes = detachComponent(again, frame)
  if (isRefusal(writes)) throw new Error(JSON.stringify(writes))
  const detached = land(again, writes, true)
  const reverse = invert(again, detached, { author: person, once: "detach", rev: detached.rev, writes })
  const restored = land(detached, reverse, true)
  expect(instance(restored)).toEqual(instance(again))
  expect(restored.children).toEqual(again.children)
})

it("undoes independent generated properties while keeping a later fill", () => {
  const before = placed()
  const a = part(before, "bar", "a")
  const writes = refresh(before, { data: data(7, 4), tokens: { accent: { var: "accent3" } } })
  const after = land(before, writes, true)
  const edit = { once: "regenerate", rev: after.rev, readBase: before.rev, author: person, writes }
  const later = land(after, [{ node: a, prop: "fills", value: [{ kind: "solid", color: { var: "accent2" } }] }])
  const reverse = invert(before, later, edit)
  const undone = land(later, reverse, true)
  expect(instance(undone)).toEqual(instance(before))
  expect(undone.nodes.get(a)).toMatchObject({ fills: [{ kind: "solid", color: { var: "accent2" } }] })
  const inverse = invertRun(later, [{ ...edit, replaced: replacedBy(before, edit) }])
  expect(inverse.left).toEqual([])
  expect(land(later, inverse.writes, true).nodes).toEqual(undone.nodes)
})

it("restores a full generation during run undo and keeps an independent fill override", () => {
  const before = placed()
  const a = part(before, "bar", "a")
  const b = part(before, "bar", "b")
  const writes = refresh(before, { data: data(-5, 5) })
  const after = land(before, writes, true)
  const generation = { once: "refresh", author: person, readBase: before.rev, rev: after.rev, writes }
  const fills = [{ kind: "solid", color: { var: "accent5" } }]
  const later = land(after, [{ node: b, prop: "fills", value: fills }])
  const { writes: reverse, left } = invertRun(later, [{ ...generation, replaced: replacedBy(before, generation) }])
  expect(left).toEqual([])
  const undone = land(later, reverse, true)
  expect(instance(undone)).toEqual(instance(before))
  expect(undone.nodes.get(b)).toMatchObject({ fills })
  expect(propOf(undone.nodes.get(a), "box")).toEqual(propOf(before.nodes.get(a), "box"))
})

it("keeps the linked creation when a later edit adds a manual child", () => {
  const { doom: before, slides } = doomFromTree({ theme: defaultTheme, slides: [{ children: [] }] })
  const writes = placeComponent(before, columnDefinition, {
    frame,
    parent: { id: slides[0]!, at },
    box,
    data: data(1, 2),
    measure,
  })
  if (isRefusal(writes)) throw new Error(JSON.stringify(writes))
  const after = land(before, writes, true)
  const generation = { once: "place", author: person, rev: after.rev, readBase: before.rev, writes }
  const manual = mint()
  const later = land(after, [
    { node: manual, prop: "type", value: "shape" },
    { node: manual, prop: "parent", value: { id: frame, at } },
  ])
  expect(invert(before, later, generation)).toEqual([])
  expect(invertRun(later, [{ ...generation, replaced: replacedBy(before, generation) }])).toMatchObject({
    writes: [],
    kept: [frame],
    left: [],
  })
})

it("measures a category override in its chosen style and stores the new generated style", () => {
  const before = placed()
  const label = part(before, "category", "a")
  const text = propOf(before.nodes.get(label), "text")
  if (text === undefined) throw new Error("Missing label")
  const override = land(before, [{ node: label, prop: "text", value: { ...text, style: "label" } }])
  const measured: string[] = []
  const writes = regenerateComponent(
    override,
    frame,
    {
      data: { rows: [{ id: "a", label: "Alpha", value: 1 }] },
      tokens: { caption: "body2" },
    },
    (text, ...args) => {
      if (text.chars === "Alpha") measured.push(text.style)
      return measure(text, ...args)
    },
  )
  if (isRefusal(writes)) throw new Error(JSON.stringify(writes))
  const refreshed = land(override, writes.writes, true)
  expect(measured).toEqual(["label"])
  expect(refreshed.nodes.get(label)).toMatchObject({ text: { chars: "Alpha", style: "label" } })
  expect(instance(refreshed).parts.find(({ node }) => node === label)?.baseline).toEqual({
    kind: "text",
    style: "body2",
  })
})

it("guards frame size, generated placement and label content while permitting ordinary movement", () => {
  const before = placed()
  const a = part(before, "bar", "a")
  const label = part(before, "category", "a")
  const refused = (write: Write) =>
    applyEdit(before, {
      once: "ordinary",
      author: person,
      writes: [write],
      rev: rev(before.rev + 1),
    })
  expect(refused({ node: frame, prop: "box", value: { ...box, w: 900 } })).toMatchObject({ refused: "shape" })
  expect(refused({ node: a, prop: "parent", value: { id: frame, at } })).toMatchObject({
    refused: "shape",
    form: expect.stringMatching(/linked.*detach/i),
  })
  const text = propOf(before.nodes.get(label), "text")
  expect(refused({ node: label, prop: "text", value: { ...text, chars: "B" } })).toMatchObject({ refused: "shape" })
  expect(isRefusal(refused({ node: frame, prop: "box", value: { ...box, x: 32, rotation: 12 } }))).toBe(false)
})

it("treats a matching generated fill as inherited on the next update", () => {
  const before = placed()
  const bar = part(before, "bar", "a")
  const over = land(before, [{ node: bar, prop: "fills", value: [{ kind: "solid", color: { var: "accent3" } }] }])
  const same = land(over, refresh(over, { tokens: { accent: { var: "accent3" } } }), true)
  const next = land(same, refresh(same, { tokens: { accent: { var: "accent4" } } }), true)
  expect(next.nodes.get(bar)).toMatchObject({ fills: [{ kind: "solid", color: { var: "accent4" } }] })
})

it("deletes a linked part through an ordinary edit and undoes the suppression", () => {
  const before = placed()
  const bar = part(before, "bar", "a")
  const writes = [{ node: bar, prop: "parent", value: null }] satisfies readonly Write[]
  const after = land(before, writes)
  expect(instance(after).suppressed).toEqual([{ key: ["bar", "a"], reason: "delete" }])
  const reverse = invert(before, after, { once: "delete", author: person, rev: after.rev, writes })
  expect(instance(land(after, reverse, true))).toEqual(instance(before))
})

it("keeps a restyled category outside the shared fit when the theme changes", () => {
  const before = placed()
  const alpha = part(before, "category", "a")
  const deck = [...before.nodes.values()].find(({ type }) => type === "deck")!
  const text = propOf(before.nodes.get(alpha), "text")!
  const caption = defaultTheme.textStyles.caption
  const themed = land(before, [
    { node: alpha, prop: "text", value: { ...text, style: "body" } },
    { node: deck.id, prop: "theme.textStyles.caption", value: { ...caption, size: caption.size * 2 } },
  ])
  const after = land(themed, refresh(themed, {}), true)
  expect(propOf(after.nodes.get(alpha), "text")?.style).toBe("body")
  expect(propOf(after.nodes.get(part(after, "category", "b")), "text")?.style).toBe("caption")
})

it("reports discarded overrides and freed connector ends after a label style override", () => {
  const before = placed()
  const bar = part(before, "bar", "a")
  const label = part(before, "category", "a")
  const text = propOf(before.nodes.get(label), "text")!
  const line = mint()
  const parent = propOf(before.nodes.get(frame), "parent")
  if (parent == null) throw new Error("Missing slide")
  const overridden = land(before, [
    { node: bar, prop: "fills", value: [{ kind: "solid", color: { var: "accent3" } }] },
    { node: label, prop: "text", value: { ...text, style: "body" } },
    { node: line, prop: "type", value: "shape" },
    { node: line, prop: "parent", value: parent },
    { node: line, prop: "box", value: box },
    {
      node: line,
      prop: "geometry",
      value: {
        kind: "line",
        start: { node: bar, site: "b" },
        end: { x: 10, y: 20 },
        route: "straight",
        arrows: ["none", "none"],
      },
    },
  ])
  const kept = land(overridden, refresh(overridden, { data: data(5, 6) }), true)
  const update = regenerateComponent(kept, frame, { data: { rows: data(5, 6).rows.slice(1) } }, measure)
  if (isRefusal(update)) throw new Error(JSON.stringify(update))
  expect(update.findings).toContainEqual({ kind: "discarded-override", node: bar, key: ["bar", "a"], prop: "fills" })
  expect(update.findings).toContainEqual({
    kind: "discarded-override",
    node: label,
    key: ["category", "a"],
    prop: "text",
  })
  expect(update.findings).toContainEqual({ kind: "freed-end", line, end: "start", target: bar })
})

it("lets an agent delete a linked bar and explains a refused linked edit", () => {
  const before = placed()
  const bar = part(before, "bar", "a")
  const by = {
    once: "agent",
    author: { kind: "agent", id: "helper", run: "helper-run" },
    phase: "start",
    mint,
  } as const
  const refused = compileAgentEdit(before, [{ op: "set", target: bar, box: { ...box, w: 400 } }], by)
  expect(refused).toMatchObject({ refused: "shape", form: expect.stringMatching(/linked.*detach/i) })
  const deleted = compileAgentEdit(before, [{ op: "delete", nodes: [bar] }], by)
  if (isRefusal(deleted)) throw new Error(JSON.stringify(deleted))
  expect(instance(deleted.after).suppressed).toEqual([{ key: ["bar", "a"], reason: "delete" }])
})

it("can update after deleting all 100 bars from each of two successive data sets", () => {
  const rows = (prefix: string) => ({
    rows: Array.from({ length: 100 }, (_, i) => ({ id: prefix + i, label: String(i), value: i + 1 })),
  })
  let fold = placed()
  for (const prefix of ["first", "second"]) {
    fold = land(fold, refresh(fold, { data: rows(prefix) }), true)
    const bars = instance(fold).parts.filter(({ key }) => key[0] === "bar")
    expect(bars).toHaveLength(100)
    fold = land(
      fold,
      bars.map(({ node }) => ({ node, prop: "parent", value: null })),
    )
  }
  const updated = land(fold, refresh(fold, { data: rows("third") }), true)
  expect(instance(updated).suppressed).toEqual([])
  expect(instance(updated).parts.filter(({ key }) => key[0] === "bar")).toHaveLength(100)
})

it("ignores a stale suppression for a key that no longer exists", () => {
  const before = placed()
  const updated = land(before, refresh(before, { data: { rows: [] } }), true)
  expect(suppressKeys(updated, frame, [["bar", "a"]])).toEqual([])
})

it("reserves a future part ID against ordinary creates even in a guarded edit", () => {
  const before = placed()
  const updated = land(before, refresh(before, { data: { rows: [{ id: "z", label: "Z", value: 5 }] } }), true)
  const reserved = part(updated, "bar", "z")
  expect(
    applyEdit(before, {
      author: person,
      once: "manual",
      rev: rev(before.rev + 1),
      readBase: before.rev,
      writes: [
        { node: reserved, prop: "type", value: "shape" },
        { node: reserved, prop: "parent", value: { id: frame, at } },
      ],
    }),
  ).toMatchObject({ refused: "shape", node: reserved, prop: "type" })
})

it.each(["person", "agent"])("keeps a later re-suppression of the same key when %s undo arrives", (actor) => {
  const before = placed()
  const a = part(before, "bar", "a")
  const writes = [{ node: a, prop: "parent", value: null }] satisfies readonly Write[]
  const deleted = land(before, writes)
  const edit = { once: "first-delete", author: person, rev: deleted.rev, writes }
  const restored = land(deleted, invert(before, deleted, edit), true)
  const deletedAgain = land(restored, writes)
  const inverse =
    actor === "person"
      ? invert(before, deletedAgain, edit)
      : invertRun(deletedAgain, [{ ...edit, replaced: replacedBy(before, edit) }]).writes
  expect(inverse).toEqual([])
  expect(onDeck(deletedAgain.nodes, a)).toBe(false)
})

it("restores the part's existing override and the rest of the step after a data update", () => {
  const first = placed()
  const a = part(first, "bar", "a")
  const b = part(first, "bar", "b")
  const fills = [{ kind: "solid", color: { var: "accent4" } }]
  const before = land(first, [{ node: a, prop: "fills", value: fills }])
  const writes = [
    { node: a, prop: "parent", value: null },
    { node: b, prop: "name", value: "Run edit" },
  ] satisfies readonly Write[]
  const deleted = land(before, writes)
  const edit = { once: "delete", author: person, rev: deleted.rev, writes }
  const later = land(deleted, refresh(deleted, { data: data(9, 2) }), true)
  const byPerson = land(later, invert(before, later, edit), true)
  const byAgent = land(later, invertRun(later, [{ ...edit, replaced: replacedBy(before, edit) }]).writes, true)
  for (const after of [byPerson, byAgent]) {
    expect(onDeck(after.nodes, a)).toBe(true)
    expect(propOf(after.nodes.get(a), "fills")).toEqual(fills)
    expect(propOf(after.nodes.get(b), "name")).toEqual(propOf(before.nodes.get(b), "name"))
    expect(instance(after).data).toEqual(instance(later).data)
  }
})

it("reserves the parent of an exited part until the instance emits its key again", () => {
  const before = placed()
  const b = part(before, "bar", "b")
  const dropped = land(before, refresh(before, { data: { rows: data(1, 2).rows.slice(0, 1) } }), true)
  const slide = propOf(dropped.nodes.get(frame), "parent")!.id
  expect(
    applyEdit(dropped, {
      once: "resurrect",
      author: person,
      rev: rev(dropped.rev + 1),
      writes: [{ node: b, prop: "parent", value: { id: slide, at } }],
    }),
  ).toMatchObject({ refused: "shape", node: b, prop: "parent", form: expect.stringContaining("linked") })
  expect(part(land(dropped, refresh(dropped, { data: data(1, 2) }), true), "bar", "b")).toBe(b)
})

it("does not report generated parts as kept when undoing the run that added their row", () => {
  const before = placed()
  const data = { rows: [...instance(before).data.rows!, { id: "c", label: "C", value: 3 }] }
  const writes = refresh(before, { data })
  const after = land(before, writes, true)
  const c = part(after, "bar", "c")
  const recoloured = land(after, [{ node: c, prop: "fills", value: [{ kind: "solid", color: { var: "accent4" } }] }])
  const edit = { once: "add-row", author: person, rev: after.rev, readBase: before.rev, writes }
  const undone = invertRun(recoloured, [{ ...edit, replaced: replacedBy(before, edit) }])
  expect(undone).toMatchObject({ kept: [], left: [], waiting: [] })
  expect(instance(land(recoloured, undone.writes, true))).toEqual(instance(before))
})

it("restores an explicit fill when a run changes the inherited fill and resets the override", () => {
  const before = placed()
  const bar = part(before, "bar", "a")
  const red = [{ kind: "solid", color: { var: "accent2" } }]
  const blue = [{ kind: "solid", color: { var: "accent3" } }]
  const overridden = land(before, [{ node: bar, prop: "fills", value: red }])
  const writes = [
    ...refresh(overridden, { tokens: { accent: { var: "accent3" } } }),
    { node: bar, prop: "fills" as const, value: blue },
  ]
  const after = land(overridden, writes, true)
  const edit = { once: "reset-fill", author: person, rev: after.rev, readBase: overridden.rev, writes }
  const undone = invertRun(after, [undoSourceOf(overridden, edit)])
  expect(propOf(land(after, undone.writes, true).nodes.get(bar), "fills")).toEqual(red)
})

it("keeps a placed chart whose parent was written by another writer", () => {
  const { doom: before, slides } = doomFromTree({ theme: defaultTheme, slides: [{ children: [] }] })
  const slide = slides[0]!
  const writes = placeComponent(before, columnDefinition, {
    frame,
    parent: { id: slide, at },
    box,
    data: data(1, 2),
    measure,
  })
  if (isRefusal(writes)) throw new Error(JSON.stringify(writes))
  const after = land(before, writes, true)
  const later = land(after, [{ node: frame, prop: "parent", value: { id: slide, at: orderKeyBetween(at, null) } }])
  const placement = { once: "place", author: person, rev: after.rev, readBase: before.rev, writes }
  expect(invert(before, later, placement)).toEqual([])
  expect(invert(before, later, placement, new Set([later.rev]))).toContainEqual({
    node: frame,
    prop: "parent",
    value: null,
    base: later.rev,
  })
})
