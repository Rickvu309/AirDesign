import { describe, expect, it } from "vitest"
import { readAgentChange } from "./agent-change.js"

const hiddenCaption = {
  op: "add",
  kind: "text",
  slide: "m1jx7i64jma5:5",
  textStyle: "caption",
  text: "",
  box: { x: 0, y: 0, w: 10, h: 10 },
  hidden: true,
}

describe("a field refusal names the path, the fault and the accepted form", () => {
  it("refuses the empty hidden caption from the audit as the wrong form of text", () => {
    expect(readAgentChange(hiddenCaption)).toMatchObject({
      refused: "shape",
      field: "text",
      fault: "form",
      form: "A non-empty string.",
    })
  })

  it("names a missing field, an unknown field and a value in the wrong form", () => {
    expect(readAgentChange({ op: "add", kind: "text" })).toMatchObject({
      refused: "shape",
      field: "slide",
      fault: "missing",
    })
    expect(readAgentChange({ op: "set", target: "t:3", nope: true })).toMatchObject({
      refused: "shape",
      field: "nope",
      fault: "unknown",
    })
    expect(readAgentChange({ op: "set", target: "t:3", opacity: 2 })).toMatchObject({
      refused: "shape",
      field: "opacity",
      fault: "form",
      form: "A number from 0 to 1.",
    })
    expect(readAgentChange({ op: "paint" })).toMatchObject({
      refused: "shape",
      field: "op",
      fault: "unknown",
    })
    expect(readAgentChange("add")).toMatchObject({
      refused: "shape",
      field: "op",
      fault: "form",
    })
    const nested = readAgentChange({ op: "set", target: "t:3", box: { x: 0, y: 0, w: "wide", h: 10 } })
    expect(nested).toMatchObject({ refused: "shape", field: "box.w", fault: "form" })
  })
})
