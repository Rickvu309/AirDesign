import { describe, expect, it } from "vitest"
import { planChange, registerScope, type SetChange } from "./change.js"
import { decide, openRegister, type Register } from "./decide.js"
import type { IndexElement } from "./deck-index.js"
import { elementId, readElementId, slideId, templateStyleNode, templateStylesNode } from "./element-id.js"
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

describe("the deck's template styles", () => {
  it("names one node for every template style and one for each, and reads their old names as them", () => {
    expect(readElementId("deck.templateStyles")).toBe(templateStylesNode)
    expect(readElementId("deck.templateStyle2")).toBe(templateStyleNode(1))
    expect(readElementId("deck.theme")).toBe(templateStylesNode)
    expect(readElementId("deck.template2")).toBe(templateStyleNode(1))
    expect(readElementId("deck.template0")).toBeUndefined()
    expect(readElementId("deck.themes")).toBeUndefined()
    expect(readElementId("deck.slide")).toBeUndefined()
  })

  it("reads a template color as six hex digits and a font as its name", () => {
    expect(readValue(traits.templateStyle.fields.accent1, "C00000")).toBe("C00000")
    expect(readValue(traits.templateStyle.fields.accent1, "c00000")).toBeNull()
    expect(readValue(traits.templateStyle.fields.accent1, "accent2")).toBeNull()
    expect(readValue(traits.templateStyle.fields.major, "Georgia")).toBe("Georgia")
  })

  it("plans colours and fonts as one row on the template styles node, before the index is complete too", () => {
    const change: SetChange = {
      target: { node: templateStylesNode },
      templateStyle: { accent1: "C00000", major: "Georgia" },
    }
    const row = { v: format, patch: { templateStyle: { accent1: { set: "C00000" }, major: { set: "Georgia" } } } }
    expect(plan(change)).toEqual({ ok: true, rows: [{ node: templateStylesNode, row }] })
    expect(plan(change, indexed(2))).toEqual({ ok: true, rows: [{ node: templateStylesNode, row }] })
  })

  it("refuses a template style field on a shape, a slide's choice on a template style, and any other trait there", () => {
    expect(plan({ target: { node: title.node }, templateStyle: { accent1: "C00000" } })).toEqual({
      ok: false,
      refusals: [{ node: title.node, trait: "templateStyle", code: "kind" }],
    })
    expect(plan({ target: { slide: slideId("258") }, templateStyle: { accent1: "C00000" } })).toEqual({
      ok: false,
      refusals: [{ node: "258.slide", trait: "templateStyle", code: "kind" }],
    })
    expect(plan({ target: { node: templateStylesNode }, templateStyle: { id: "ppt/theme/theme1.xml" } })).toEqual({
      ok: false,
      refusals: [{ node: templateStylesNode, trait: "templateStyle", code: "kind" }],
    })
    expect(plan({ target: { node: templateStylesNode }, fills: { paint: { none: true } } })).toEqual({
      ok: false,
      refusals: [{ node: templateStylesNode, trait: "fills", code: "kind" }],
    })
  })

  it("lands a person's template style row on its node and refuses it on a shape", () => {
    const opened = decide(indexed(), { command: "add", node: templateStylesNode, floor: "", route: "deck" })
    if (opened.decision !== "apply") throw new Error("add")
    const patch = { templateStyle: { lt1: { set: "000000" } } }
    expect(decide(opened.register, { command: "person", node: templateStylesNode, v: format, patch }).decision).toBe(
      "apply",
    )
    const shape = decide(opened.register, { command: "add", node: title.node, floor: "", route: "deck" })
    if (shape.decision !== "apply") throw new Error("add")
    expect(decide(shape.register, { command: "person", node: title.node, v: format, patch })).toEqual({
      decision: "refuse",
      code: "kind",
    })
  })
})
