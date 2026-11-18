import { describe, expect, it } from "vitest"
import { planChange, registerScope, type SetChange } from "./change.js"
import { decide, openRegister, type Register } from "./decide.js"
import type { IndexElement } from "./deck-index.js"
import { elementId, readElementId, themeNode } from "./element-id.js"
import { format } from "./format.js"
import { readValue } from "./value-kind.js"
import { traits } from "./traits.js"

const title: IndexElement = {
  node: elementId("258.2"),
  kind: "shape",
  value: "Quarterly review",
  box: { x: 0, y: 0, cx: 100, cy: 100 },
  grouped: false,
}

function indexed(total = 1): Register {
  return {
    ...openRegister("", "deck"),
    index: { format: 2, total, slides: [{ id: "258", position: 0 }], elements: [title], pages: [] },
  }
}

function plan(change: SetChange, register = indexed()) {
  return planChange(change, registerScope(register))
}

describe("the deck's theme", () => {
  it("names one theme node for the whole deck", () => {
    expect(readElementId("deck.theme")).toBe(themeNode)
    expect(readElementId("deck.slide")).toBeUndefined()
  })

  it("reads a theme colour as six hex digits and a font as its name", () => {
    expect(readValue(traits.theme.fields.accent1, "C00000")).toBe("C00000")
    expect(readValue(traits.theme.fields.accent1, "c00000")).toBeNull()
    expect(readValue(traits.theme.fields.accent1, "accent2")).toBeNull()
    expect(readValue(traits.theme.fields.major, "Georgia")).toBe("Georgia")
  })

  it("plans colours and fonts as one row on the theme node, before the index is complete too", () => {
    const change: SetChange = { target: { node: themeNode }, theme: { accent1: "C00000", major: "Georgia" } }
    const row = { v: format, patch: { theme: { accent1: { set: "C00000" }, major: { set: "Georgia" } } } }
    expect(plan(change)).toEqual({ ok: true, rows: [{ node: themeNode, row }] })
    expect(plan(change, indexed(2))).toEqual({ ok: true, rows: [{ node: themeNode, row }] })
  })

  it("refuses a theme field on a shape, and any other trait on the theme", () => {
    expect(plan({ target: { node: title.node }, theme: { accent1: "C00000" } })).toEqual({
      ok: false,
      refusals: [{ node: title.node, trait: "theme", code: "kind" }],
    })
    expect(plan({ target: { node: themeNode }, fills: { paint: { none: true } } })).toEqual({
      ok: false,
      refusals: [{ node: themeNode, trait: "fills", code: "kind" }],
    })
  })

  it("lands a person's theme row on the theme node and refuses it on a shape", () => {
    const opened = decide(indexed(), { command: "add", node: themeNode, floor: "", route: "deck" })
    if (opened.decision !== "apply") throw new Error("add")
    const patch = { theme: { lt1: { set: "000000" } } }
    expect(decide(opened.register, { command: "person", node: themeNode, v: format, patch }).decision).toBe("apply")
    const shape = decide(opened.register, { command: "add", node: title.node, floor: "", route: "deck" })
    if (shape.decision !== "apply") throw new Error("add")
    expect(decide(shape.register, { command: "person", node: title.node, v: format, patch })).toEqual({
      decision: "refuse",
      code: "kind",
    })
  })
})
