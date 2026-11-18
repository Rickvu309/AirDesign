import { describe, expect, it } from "vitest"
import { elementId, legacyElement, slideId } from "./element-id.js"
import { format } from "./format.js"
import { conversions, readStoredEdit, readStoredValue } from "./stored.js"

const node = elementId("258.7")
const file = [slideId("256"), slideId("257")]

describe("the table of conversions", () => {
  it("names a format this build already writes for every conversion, and none before the first stamp", () => {
    for (const each of [...conversions.value, ...conversions.edit, ...conversions.register]) {
      expect(each.introduced).toBeGreaterThanOrEqual(2)
      expect(each.introduced).toBeLessThanOrEqual(format)
    }
  })
})

describe("readStoredValue", () => {
  it("keeps a format 1 text or box in its stored form and a stamped row as a row", () => {
    expect(readStoredValue({ value: "Hi" }, "text")).toEqual({ ok: true, value: { value: "Hi" } })
    const box = { x: 1, y: 2, cx: 3, cy: 4 }
    expect(readStoredValue({ property: "box", value: box }, "text")).toEqual({
      ok: true,
      value: { property: "box", value: box },
    })
    const row = { v: format, patch: { text: { value: { set: "Hi" } } } }
    expect(readStoredValue({ kind: "pending", ...row }, "text")).toEqual({ ok: true, value: row })
  })

  it("refuses a row from a newer build as newer and one it cannot read as payload", () => {
    expect(readStoredValue({ v: format + 1, patch: {} }, "text")).toEqual({ ok: false, refusal: "newer" })
    expect(readStoredValue({ v: 1, patch: { text: { value: { set: "Hi" } } } }, "text")).toEqual({
      ok: false,
      refusal: "payload",
    })
    expect(readStoredValue({ property: "box", value: { x: 1 } }, "text")).toEqual({ ok: false, refusal: "payload" })
  })
})

describe("readStoredEdit", () => {
  it("reads a row for a node, with its floor, and slide commands with their file", () => {
    expect(readStoredEdit({ node, floor: "file", value: { value: "Hi" } })).toEqual({
      ok: true,
      value: { node, floor: "file", value: { value: "Hi" } },
    })
    expect(readStoredEdit({ node: legacyElement, value: { value: "Hi" } })).toEqual({
      ok: true,
      value: { node: legacyElement, value: { value: "Hi" } },
    })
    const remove = { slide: "remove", id: "257" }
    expect(readStoredEdit({ format, file, edits: [remove] })).toEqual({ ok: true, value: { file, edits: [remove] } })
  })

  it("turns a slide background command from before fill rows into a fills row on the slide's own node", () => {
    const background = { file, edits: [{ slide: "background", id: "257", color: { scheme: "accent1" } }] }
    const fill = {
      node: elementId("257.slide"),
      floor: "",
      value: { v: 57, patch: { fills: { p0: { set: { solid: { scheme: "accent1" } } } } } },
    }
    expect(readStoredEdit(background)).toEqual({ ok: true, value: fill })
    expect(readStoredEdit({ ...background, format: 27 })).toEqual({ ok: true, value: fill })
    expect(readStoredEdit({ ...background, edits: [{ slide: "background", id: "257", color: null }] })).toEqual({
      ok: true,
      value: { ...fill, value: { v: 57, patch: { fills: { p0: "opening" } } } },
    })
  })

  it("leaves a background command it cannot turn into a fill, or one stamped after fill rows, for the newer check", () => {
    const background = { slide: "background", id: "257", color: { scheme: "accent1" } }
    expect(readStoredEdit({ format: 28, file, edits: [background] })).toEqual({ ok: false, refusal: "newer" })
    expect(readStoredEdit({ file, edits: [{ ...background, color: 7 }] })).toEqual({ ok: false, refusal: "newer" })
    expect(readStoredEdit({ file, edits: [{ ...background, id: "slide" }] })).toEqual({ ok: false, refusal: "newer" })
  })

  it("refuses a newer format, a newer slide command or a newer row as newer before it reads the rest", () => {
    expect(readStoredEdit({ format: format + 1, node: 7 })).toEqual({ ok: false, refusal: "newer" })
    expect(readStoredEdit({ file, edits: [{ slide: "future-grid", grid: 2 }] })).toEqual({
      ok: false,
      refusal: "newer",
    })
    expect(readStoredEdit({ node, value: { v: format + 1, patch: {} } })).toEqual({ ok: false, refusal: "newer" })
  })

  it("refuses what it cannot read as payload", () => {
    for (const raw of [
      null,
      { node: "slide", value: { value: "Hi" } },
      { node, floor: 7, value: { value: "Hi" } },
      { node, value: { property: "fill", value: "x" } },
      { edits: [{ slide: "remove", id: "257" }] },
      { file, edits: "remove" },
      { file, edits: [{ slide: "remove" }] },
    ]) {
      expect(readStoredEdit(raw), JSON.stringify(raw)).toEqual({ ok: false, refusal: "payload" })
    }
  })
})
