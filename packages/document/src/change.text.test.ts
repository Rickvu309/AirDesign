import { describe, expect, it } from "vitest"
import { planChange, registerScope, type SetChange } from "./change.js"
import { openRegister, type Register } from "./decide.js"
import type { DeckIndex, IndexElement } from "./deck-index.js"
import { elementId } from "./element-id.js"
import { readTextValue, writeTextValue, type TextValue } from "./text-value.js"

const box = { x: 10, y: 20, cx: 300, cy: 400 }
const quarterly: TextValue = [
  {
    from: 0,
    runs: [
      { from: 0, text: "Quarterly" },
      { from: 1, text: " review", bold: true },
    ],
  },
  { from: 1, align: "left", runs: [{ from: 0, text: "Q3", color: { scheme: "tx1" } }] },
]

function shape(node: string, value: string): IndexElement {
  return { node: elementId(node), kind: "shape", value, box, grouped: false }
}

const elements: readonly IndexElement[] = [shape("258.2", writeTextValue(quarterly)), shape("258.3", "Plain words")]

function plan(change: SetChange) {
  const index: DeckIndex = {
    format: 2,
    total: elements.length,
    slides: [{ id: "258", position: 0 }],
    elements,
    pages: [],
  }
  const register: Register = { ...openRegister("", "deck"), index }
  return planChange(change, registerScope(register))
}

function textOf(planned: ReturnType<typeof plan>): TextValue | null {
  if (!planned.ok) return null
  const edit = planned.rows[0]?.row.patch.text?.value
  return edit === undefined || typeof edit !== "object" ? null : readTextValue(edit.set)
}

describe("type and text box layout plan as rows", () => {
  it("sets the font face on every run and line and paragraph spacing on every paragraph", () => {
    const planned = plan({
      target: { node: elementId("258.2") },
      text: { font: "Georgia", lineSpacing: 120_000, spaceBefore: 600, spaceAfter: 1_200 },
    })
    const spacing = { lineSpacing: 120_000, spaceBefore: 600, spaceAfter: 1_200 }
    expect(textOf(planned)).toEqual([
      {
        from: 0,
        ...spacing,
        runs: [
          { from: 0, text: "Quarterly", font: "Georgia" },
          { from: 1, text: " review", bold: true, font: "Georgia" },
        ],
      },
      {
        from: 1,
        align: "left",
        ...spacing,
        runs: [{ from: 0, text: "Q3", color: { scheme: "tx1" }, font: "Georgia" }],
      },
    ])
  })

  it("writes each body field as its own row field, and null as the way back to the layout's", () => {
    const planned = plan({
      target: { node: elementId("258.3") },
      body: { anchor: "ctr", insets: { left: 0, top: 0, right: 0, bottom: 0 }, columns: 2, wrap: null },
    })
    expect(planned.ok && planned.rows[0]?.row.patch).toEqual({
      body: {
        anchor: { set: "ctr" },
        insets: { set: { left: 0, top: 0, right: 0, bottom: 0 } },
        columns: { set: 2 },
        wrap: "inherit",
      },
    })
  })
})

it("sets one letter fill on every run and removes the previous solid colour", () => {
  const fill = { solid: { scheme: "accent1" } } as const
  const text = textOf(plan({ target: { node: elementId("258.2") }, text: { fill } }))
  expect(text?.flatMap((paragraph) => paragraph.runs.map((run) => run.fill))).toEqual([fill, fill, fill])
  expect(text?.flatMap((paragraph) => paragraph.runs.map((run) => run.color))).toEqual([
    undefined,
    undefined,
    undefined,
  ])
})
