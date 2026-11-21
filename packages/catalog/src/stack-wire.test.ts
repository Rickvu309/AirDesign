import { elementId } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { readSetChange } from "./set-wire.js"

describe("readSetChange reads a layer's paint order", () => {
  it("reads front, back, and above or below a layer of the same slide, alone or with fields", () => {
    expect(readSetChange({ op: "set", target: "258.2", stack: "front" })).toEqual({
      ok: true,
      change: { op: "set", target: { node: elementId("258.2") }, stack: "front" },
    })
    expect(readSetChange({ op: "set", target: "258.2", stack: "below 258.4", opacity: 50 })).toMatchObject({
      ok: true,
      change: { stack: { below: elementId("258.4") } },
    })
    expect(readSetChange({ op: "set", target: "258.2", stack: "above 258.3" })).toMatchObject({ ok: true })
  })

  it("refuses an order on a role or slide target, on another slide's layer, on itself, or in another form", () => {
    const refused = { ok: false, refusal: "field", field: "stack" }
    expect(readSetChange({ op: "set", target: "258.title", stack: "back" })).toEqual(refused)
    expect(readSetChange({ op: "set", target: "258", stack: "back" })).toEqual(refused)
    expect(readSetChange({ op: "set", target: "258.2", stack: "above 259.3" })).toEqual(refused)
    expect(readSetChange({ op: "set", target: "258.2", stack: "above 258.2" })).toEqual(refused)
    expect(readSetChange({ op: "set", target: "258.2", stack: { above: "258.3" } })).toEqual(refused)
    expect(readSetChange({ op: "set", target: "258.2", stack: "top" })).toEqual(refused)
  })
})
