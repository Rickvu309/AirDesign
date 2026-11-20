import { format, readRow, writeTableValue } from "@airdesign/document"
import { expect, it } from "vitest"
import { readAddChange, readAgentEdit, readCommit, readEdit, readSetChange, toolInputSchema } from "./index.js"

const value = writeTableValue({ rows: [{ from: 0, cells: [[{ from: 0, runs: [{ from: 0, text: "Region" }] }]] }] })

it("takes a person's and an agent's table value, as a saved row reads it", () => {
  const row = { v: format, patch: { table: { value: { set: value } } } }
  expect(readRow(row, "table").ok).toBe(true)
  expect(readEdit({ ...row, node: "258.7" }).ok).toBe(true)
  expect(readEdit({ node: "258.7", value }).ok).toBe(true)
  expect(readSetChange({ op: "set", target: "258.7", table: { value } }).ok).toBe(true)
  expect(readAgentEdit({ deck: "deck", base: 0, changes: [{ node: "258.7", readAt: 0, value }] }).ok).toBe(true)
  expect(JSON.stringify(toolInputSchema("edit_deck"))).toContain('"table"')
})

it("takes a person's new table and an agent's add of one with its cells", () => {
  const edit = {
    slide: "element-add",
    id: "258",
    element: { node: "258.9", kind: "table", grouped: false, value, box: { x: 0, y: 0, cx: 914400, cy: 914400 } },
    file: ["258"],
  }
  expect(readCommit({ deck: "deck", batch: [edit] }).ok).toBe(true)
  const added = readAddChange({ op: "add", kind: "table", slide: "258", table: { value } })
  expect(added).toEqual({ ok: true, change: { op: "add", kind: "table", slide: "258", table: { value } } })
  expect(readAddChange({ op: "add", kind: "table", slide: "258" }).ok).toBe(false)
  expect(readAddChange({ op: "add", kind: "table", slide: "258", table: { value: "[]" } }).ok).toBe(false)
  expect(readAddChange({ op: "add", kind: "table", slide: "258", table: { value }, text: { value: "A" } }).ok).toBe(
    false,
  )
})
