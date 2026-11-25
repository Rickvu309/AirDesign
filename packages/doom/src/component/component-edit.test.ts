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
