import { slideId } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { readAddChange, readSetChange } from "./set-wire.js"

describe("readAddChange reads a styled layer in one change", () => {
  const look = {
    fills: { paint: "accent1" },
    geometry: { shape: { preset: "roundRect", adjust: { adj: 8000 } } },
    border: { width: 1 },
    body: { anchor: "ctr" },
  }

  it("reads fills, geometry, border and body on a text shape exactly as set reads them", () => {
    const set = readSetChange({ op: "set", target: "258.2", ...look })
    if (!set.ok) throw new Error(set.field)
    const { op: _op, target: _target, ...traits } = set.change
    expect(readAddChange({ op: "add", kind: "shape", slide: "258", text: { value: "Revenue" }, ...look })).toEqual({
      ok: true,
      change: { op: "add", kind: "shape", slide: slideId("258"), text: { value: "Revenue" }, ...traits },
    })
  })

  it("reads a border on a line or arrow, and refuses a fill on one and a style on an icon", () => {
    const set = readSetChange({
      op: "set",
      target: "258.2",
      border: { width: 2, tail: { type: "triangle", width: "med", length: "med" } },
    })
    if (!set.ok) throw new Error(set.field)
    const arrow = { op: "add", kind: "arrow", slide: "258", box: { x: 72, y: 72, w: 144, h: 0 } }
    expect(
      readAddChange({ ...arrow, border: { width: 2, tail: { type: "triangle", width: "med", length: "med" } } }),
    ).toMatchObject({
      ok: true,
      change: { border: set.change.border },
    })
    expect(readAddChange({ ...arrow, fills: { paint: "accent1" } })).toEqual({
      ok: false,
      refusal: "field",
      field: "fills",
    })
    expect(
      readAddChange({ op: "add", kind: "shape", slide: "258", icon: "rocket", fills: { paint: "accent1" } }),
    ).toEqual({
      ok: false,
      refusal: "field",
      field: "fills",
    })
  })
})
