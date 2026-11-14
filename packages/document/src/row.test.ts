import { describe, expect, it } from "vitest"
import {
  beforeOf,
  format,
  netPatch,
  readRow,
  shows,
  writeTableValue,
  openingTable,
  type ElementPatch,
  type Row,
} from "./index.js"
import { fieldsOf, formatOne, rowOf } from "./row.js"

const box = { x: 100, y: -200, cx: 300, cy: 0 }
const boxPatch: ElementPatch = { box: { x: { set: 100 }, y: { set: -200 }, w: { set: 300 }, h: { set: 0 } } }

function row(patch: ElementPatch): Row {
  return { v: 1, patch }
}

describe("readRow reads both format 1 forms as trait fields", () => {
  it("reads a value as the field of the trait that holds it on the node", () => {
    const table = writeTableValue(openingTable(1, 1))
    expect(readRow({ value: "Hi" }, "text")).toEqual({ ok: true, value: row({ text: { value: { set: "Hi" } } }) })
    expect(readRow({ value: "Speak" }, "notes")).toEqual({
      ok: true,
      value: row({ notes: { value: { set: "Speak" } } }),
    })
    expect(readRow({ value: table }, "table")).toEqual({ ok: true, value: row({ table: { value: { set: table } } }) })
  })

  it("reads a box as its four fields", () => {
    expect(readRow({ property: "box", value: box }, "text")).toEqual({ ok: true, value: row(boxPatch) })
  })

  it("reads a landed or queued row by its value, whatever else the row carries", () => {
    expect(readRow({ actor: "agent", visible: false, runId: "r", value: "Hi" }, "text")).toEqual({
      ok: true,
      value: row({ text: { value: { set: "Hi" } } }),
    })
  })

  it("refuses a row from a newer build as newer, and one it cannot read as payload", () => {
    expect(readRow({ v: format + 1, patch: { line: { width: { set: 12_700 } } } }, "text")).toEqual({
      ok: false,
      refusal: "newer",
    })
    for (const raw of [
      null,
      "Hi",
      { value: 7 },
      { v: 1, patch: { text: { value: { set: "Hi" } } } },
      { property: "fill", value: "accent1" },
      { property: "box", value: { ...box, x: 1.5 } },
      { property: "box", value: { ...box, cx: -1 } },
      { property: "box", value: { x: 1, y: 2, cx: 3 } },
      { value: "é".repeat(4_001) },
    ]) {
      expect(readRow(raw, raw !== null && typeof raw === "object" && "value" in raw ? "notes" : "text")).toEqual({
        ok: false,
        refusal: "payload",
      })
    }
  })
})

describe("the fold keeps, per trait field, the last row that names it", () => {
  const rows = [
    rowOf({ property: "box", value: box }, "text"),
    rowOf({ value: "A" }, "text"),
    row({ box: { x: { set: 5 } } }),
    rowOf({ value: "B" }, "text"),
  ]

  it("lets a later row win only the fields it names", () => {
    expect(netPatch(rows)).toEqual({
      box: { x: { set: 5 }, y: { set: -200 }, w: { set: 300 }, h: { set: 0 } },
      text: { value: { set: "B" } },
    })
  })

  it("lets a later opening or inherit win over a set", () => {
    expect(netPatch([...rows, row({ text: { value: "opening" }, box: { w: "inherit" } })])).toEqual({
      box: { x: { set: 5 }, y: { set: -200 }, w: "inherit", h: { set: 0 } },
      text: { value: "opening" },
    })
  })

  it("gives the same patch for the same rows twice", () => {
    expect(netPatch([...rows, ...rows])).toEqual(netPatch(rows))
    expect(netPatch([])).toEqual({})
  })
})

describe("person undo compares and turns back only the fields a step names", () => {
  const net = netPatch([rowOf({ value: "New" }, "text"), row({ box: { x: { set: 9 } } })])

  it("takes the edit the fold held before, or opening where no row named the field", () => {
    expect(beforeOf(net, { text: { value: { set: "Newer" } }, box: { y: { set: 1 }, x: { set: 3 } } })).toEqual({
      text: { value: { set: "New" } },
      box: { y: "opening", x: { set: 9 } },
    })
    expect(beforeOf({}, { notes: { value: { set: "Speak" } } })).toEqual({ notes: { value: "opening" } })
  })

  it("shows a step's fields while the fold holds each of them, whatever other fields hold", () => {
    expect(shows(net, { text: { value: { set: "New" } } })).toBe(true)
    expect(shows(net, { text: { value: { set: "New" } }, box: { y: "opening" } })).toBe(true)
    expect(shows(net, { box: { x: "opening" } })).toBe(false)
    expect(shows(net, { box: { x: { set: 8 } } })).toBe(false)
    expect(shows(net, { table: { value: { set: "New" } } })).toBe(false)
    expect(shows(netPatch([row({ box: { w: "inherit" } })]), { box: { w: "inherit" } })).toBe(true)
    expect(shows(net, {})).toBe(true)
  })

  it("turns the fields a step names back to the rows format 1 can store", () => {
    expect(formatOne({ text: { value: { set: "Hi" } } }, "text")).toEqual([{ value: "Hi" }])
    expect(formatOne(boxPatch, "notes")).toEqual([{ property: "box", value: box }])
    expect(formatOne({ ...boxPatch, table: { value: { set: "t" } } }, "table")).toEqual([
      { value: "t" },
      { property: "box", value: box },
    ])
    expect(formatOne({}, "text")).toEqual([])
  })

  it("writes nothing for a patch format 1 cannot store", () => {
    expect(formatOne({ box: { x: { set: 1 } } }, "text")).toBeNull()
    expect(formatOne({ text: { value: "opening" } }, "text")).toBeNull()
    expect(formatOne({ notes: { value: { set: "Speak" } } }, "text")).toBeNull()
    expect(formatOne({ box: { ...boxPatch.box, w: "inherit" } }, "text")).toBeNull()
  })

  it("lists every field a patch names", () => {
    expect(fieldsOf({ ...boxPatch, text: { value: "opening" } })).toEqual([
      "box.x",
      "box.y",
      "box.w",
      "box.h",
      "text.value",
    ])
  })
})
