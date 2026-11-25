import { expect, it } from "vitest"
import {
  deckOf,
  invertStep,
  invertRun,
  isRefusal,
  propOf,
  styleWrite,
  themeLibrary,
  undoSourceOf,
  type Write,
} from "../index.js"
import {
  box,
  data,
  frame,
  instance,
  land,
  measure,
  part,
  person,
  placed,
  refresh,
} from "./testing/linked-instance-fixtures.js"
import { prepareComponentEdit } from "./component-edit.js"
import { columnDefinition } from "./library.js"

it.each(["resize", "theme", "font", "label style"])(
  "refreshes a linked chart through %s with one exact inverse",
  (change) => {
    const before = placed()
    const deck = [...before.nodes.values()].find(({ type }) => type === "deck")!
    const label = part(before, "category", "a")
    const chart = instance(before)
    const text = propOf(before.nodes.get(label), "text")!
    const asked: Write =
      change === "resize"
        ? { node: frame, prop: "box", value: { ...box, w: 800 } }
        : change === "theme"
          ? { node: deck.id, prop: "theme", value: themeLibrary.editorial!.theme }
          : change === "font"
            ? { node: deck.id, prop: "theme.fonts.body", value: "Lora" }
            : { node: label, prop: "text", value: styleWrite(text, "title") }
    const probes = new Set<string>()
    const writes = prepareComponentEdit(before, [asked], (text, theme, width, fit) => {
      probes.add(theme.fonts[theme.textStyles[text.style].font])
      return measure(text, theme, width, fit)
    })
    if (isRefusal(writes)) throw new Error(JSON.stringify(writes))
    expect(writes).toContainEqual(expect.objectContaining({ node: frame, prop: "instance" }))
    expect(probes.size).toBeGreaterThan(0)
    const after = land(before, writes, true)
    if (change === "resize") expect(propOf(after.nodes.get(chart.generated), "box")?.w).toBe(800)
    if (change === "font") expect(probes.has("Lora")).toBe(true)
    if (change === "label style") expect(propOf(after.nodes.get(label), "text")?.style).toBe("title")
    const reverse = invertStep(before, after, { author: person, once: "refresh", rev: after.rev, writes })
    if (isRefusal(reverse)) throw new Error(JSON.stringify(reverse))
    const restored = land(after, reverse, true)
    expect(deckOf(restored)).toEqual(deckOf(before))
    expect(instance(restored)).toEqual(chart)
    for (const node of [frame, chart.generated, ...chart.parts.map(({ node }) => node)]) {
      expect(propOf(restored.nodes.get(node), "box")).toEqual(propOf(before.nodes.get(node), "box"))
      expect(propOf(restored.nodes.get(node), "text")).toEqual(propOf(before.nodes.get(node), "text"))
    }
  },
)

it("undoes a batch that changes linked data and a label's style", () => {
  const before = placed()
  const label = part(before, "category", "a")
  const changedData = refresh(before, { data: data(5, 7) })
  const wide = land(before, changedData, true)
  const text = propOf(wide.nodes.get(label), "text")!
  const style = prepareComponentEdit(wide, [{ node: label, prop: "text", value: styleWrite(text, "body") }], measure)
  if (isRefusal(style)) throw new Error(JSON.stringify(style))
  const writes = [...changedData, ...style]
  const after = land(before, writes, true)
  expect(propOf(after.nodes.get(label), "text")?.style).toBe("body")
  const edit = { once: "refresh-and-style", rev: after.rev, author: person, writes }
  const undone = invertRun(after, [undoSourceOf(before, edit)])
  const restored = land(after, undone.writes, true)
  expect(instance(restored)).toEqual(instance(before))
  expect(propOf(restored.nodes.get(label), "text")).toEqual(propOf(before.nodes.get(label), "text"))
})

it("keeps a measured resize and its generated geometry together when another tab updates the data", () => {
  const before = placed()
  const writes = prepareComponentEdit(before, [{ node: frame, prop: "box", value: { ...box, w: 800 } }], measure)
  if (isRefusal(writes)) throw new Error(JSON.stringify(writes))
  const resized = land(before, writes, true)
  const current = land(resized, refresh(resized, { data: data(4, 6) }), true)
  const edit = { once: "resize", rev: resized.rev, writes, author: person }
  expect(invertStep(before, current, edit)).toMatchObject({ refused: "stale" })
  expect(invertRun(current, [undoSourceOf(before, edit)])).toMatchObject({ writes: [], kept: [frame] })
})

const resized = (before: ReturnType<typeof placed>, size: { readonly w: number; readonly h: number }) => {
  const writes = prepareComponentEdit(before, [{ node: frame, prop: "box", value: { ...box, ...size } }], measure)
  if (isRefusal(writes)) throw new Error(JSON.stringify(writes))
  return land(before, writes, true)
}

it("keeps a deleted bar and a restyled label through a shrink to the minimum and back", () => {
  const first = placed()
  const minimum = columnDefinition.spec.minFrame!
  const bar = part(first, "bar", "a")
  const label = part(first, "category", "b")
  const text = propOf(first.nodes.get(label), "text")!
  const edited = land(land(first, [{ node: bar, prop: "parent", value: null }]), [
    { node: label, prop: "text", value: styleWrite(text, "body") },
  ])
  const small = resized(edited, minimum)
  const back = resized(small, box)
  for (const fold of [small, back]) {
    expect(instance(fold).suppressed).toEqual([{ key: ["bar", "a"], reason: "delete" }])
    expect(instance(fold).parts.some(({ key }) => key[0] === "bar" && key[1] === "a")).toBe(false)
    expect(propOf(fold.nodes.get(part(fold, "category", "b")), "text")?.style).toBe("body")
  }
})

const eight = {
  rows: Array.from({ length: 8 }, (_, i) => ({ id: String(i), label: `Region ${String(i)}`, value: i + 1 })),
}

function eightEdited() {
  const first = land(placed(), refresh(placed(), { data: eight }), true)
  const label = part(first, "category", "3")
  const text = propOf(first.nodes.get(label), "text")!
  const edited = land(land(first, [{ node: part(first, "category", "4"), prop: "parent", value: null }]), [
    { node: label, prop: "text", value: styleWrite(text, "body") },
  ])
  return { edited, label }
}

it.each([columnDefinition.spec.minFrame!, { w: 332, h: 160 }])(
  "keeps a deleted label and a restyled label that a resize to $w × $h thins away",
  (size) => {
    const { edited, label } = eightEdited()
    const small = resized(edited, size)
    expect(instance(small).parts.some(({ node }) => node === label)).toBe(false)
    expect(instance(small).suppressed).toEqual([{ key: ["category", "4"], reason: "delete" }])
    const back = resized(small, box)
    expect(instance(back).suppressed).toEqual([{ key: ["category", "4"], reason: "delete" }])
    expect(instance(back).parts.some(({ key }) => key[0] === "category" && key[1] === "4")).toBe(false)
    expect(propOf(back.nodes.get(part(back, "category", "3")), "text")?.style).toBe("body")
    expect(instance(back).parts).toEqual(instance(edited).parts)
  },
)

it("undoes a shrink that thinned an edited label back to the edited chart", () => {
  const { edited } = eightEdited()
  const writes = prepareComponentEdit(
    edited,
    [{ node: frame, prop: "box", value: { ...box, ...columnDefinition.spec.minFrame! } }],
    measure,
  )
  if (isRefusal(writes)) throw new Error(JSON.stringify(writes))
  const small = land(edited, writes, true)
  const reverse = invertStep(edited, small, { author: person, once: "shrink", rev: small.rev, writes })
  if (isRefusal(reverse)) throw new Error(JSON.stringify(reverse))
  const restored = land(small, reverse, true)
  expect(instance(restored)).toEqual(instance(edited))
  for (const { node } of instance(edited).parts)
    expect(propOf(restored.nodes.get(node), "text")).toEqual(propOf(edited.nodes.get(node), "text"))
})

it("drops a thinned label's edits once its row leaves the data", () => {
  const { edited } = eightEdited()
  const small = resized(edited, columnDefinition.spec.minFrame!)
  const fewer = land(
    small,
    refresh(small, { data: { rows: eight.rows.filter(({ id }) => id !== "3" && id !== "4") } }),
    true,
  )
  const again = land(fewer, refresh(fewer, { data: eight }), true)
  const back = resized(again, box)
  expect(instance(back).suppressed).toEqual([])
  expect(propOf(back.nodes.get(part(back, "category", "3")), "text")?.style).toBe("caption")
})

it("brings a thinned label's edits back when a data change that dropped its row is undone", () => {
  const { edited } = eightEdited()
  const small = resized(edited, columnDefinition.spec.minFrame!)
  const writes = refresh(small, { data: { rows: eight.rows.filter(({ id }) => id !== "3") } })
  const fewer = land(small, writes, true)
  const reverse = invertStep(small, fewer, { author: person, once: "fewer", rev: fewer.rev, writes })
  if (isRefusal(reverse)) throw new Error(JSON.stringify(reverse))
  const back = resized(land(fewer, reverse, true), box)
  expect(propOf(back.nodes.get(part(back, "category", "3")), "text")?.style).toBe("body")
  expect(instance(back).suppressed).toEqual([{ key: ["category", "4"], reason: "delete" }])
})

it.each([
  { w: 600, h: 159 },
  { w: 47, h: 400 },
])("refuses a resize to $w × $h below the chart's minimum and names the minimum", (size) => {
  const before = placed()
  const { w, h } = columnDefinition.spec.minFrame!
  const writes = prepareComponentEdit(before, [{ node: frame, prop: "box", value: { ...box, ...size } }], measure)
  expect(writes).toEqual({
    refused: "shape",
    node: frame,
    prop: "box",
    fault: "needs",
    needs: `a size of at least ${w} × ${h} px`,
  })
})
