import { format, readRow, writeTableValue } from "@airdesign/document"
import { expect, it } from "vitest"
import { readAgentEdit, readEdit, readSetChange, toolInputSchema } from "./index.js"

const value = writeTableValue({ rows: [{ from: 0, cells: [[{ from: 0, runs: [{ from: 0, text: "Saved" }] }]] }] })

it("refuses new person and agent table edits while reading saved table rows", () => {
  const row = { v: format, patch: { table: { value: { set: value } } } }
  expect(readRow(row, "table").ok).toBe(true)
  expect(readEdit({ ...row, node: "258.7" }).ok).toBe(false)
  expect(readEdit({ node: "258.7", value }).ok).toBe(false)
  expect(readSetChange({ op: "set", target: "258.7", table: { value } }).ok).toBe(false)
  expect(readAgentEdit({ deck: "deck", base: 0, changes: [{ node: "258.7", readAt: 0, value }] }).ok).toBe(false)
  expect(JSON.stringify(toolInputSchema("edit_deck"))).not.toContain('"table"')
})

it("refuses new table insertion but preserves the saved slide command format", async () => {
  const { readSlideState } = await import("@airdesign/document")
  const { readCommit } = await import("./index.js")
  const edit = {
    slide: "element-add",
    id: "258",
    element: {
      node: "258.9",
      kind: "table",
      grouped: false,
      value,
      box: { x: 0, y: 0, cx: 914400, cy: 914400 },
    },
    file: ["258"],
  }
  expect(readSlideState({ file: edit.file, order: [edit] })).toBeDefined()
  expect(readCommit({ deck: "deck", batch: [edit] }).ok).toBe(false)
})
