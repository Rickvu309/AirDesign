import { expect, it } from "vitest"
import { readAgentEdit } from "./index.js"
import { readAddChange, readSetChange } from "./set-wire.js"

const target = "258.7"

it("reads an accepted name of a field as the field the tools advertise, in a set and in an add", () => {
  const canonical = readSetChange({ op: "set", target, text: { lineSpacing: 150 } })
  expect(readSetChange({ op: "set", target, text: { lineHeight: 150 } })).toEqual(canonical)
  expect(canonical).toMatchObject({ ok: true, change: { text: { lineSpacing: expect.any(Number) } } })
  const added = { op: "add", kind: "shape", slide: "258", box: { x: 0, y: 0, w: 10, h: 10 } }
  const addedCanonical = readAddChange({ ...added, text: { value: "Hi", lineSpacing: 150 } })
  expect(addedCanonical).toMatchObject({ ok: true })
  expect(readAddChange({ ...added, text: { value: "Hi", lineHeight: 150 } })).toEqual(addedCanonical)
})

it("refuses both spellings of one field in one change and names the field the tools advertise", () => {
  expect(readSetChange({ op: "set", target, text: { lineHeight: 150, lineSpacing: 120 } })).toEqual({
    ok: false,
    refusal: "field",
    field: "text.lineSpacing",
  })
  const edit = { deck: "deck", base: 0, changes: [{ op: "set", target, text: { lineHeight: 150, lineSpacing: 120 } }] }
  expect(readAgentEdit(edit)).toEqual({ ok: false, refusal: "field" })
  expect(readAgentEdit({ ...edit, changes: [{ op: "set", target, text: { lineHeight: 150 } }] })).toMatchObject({
    ok: true,
    changes: [{ op: "set", text: { lineSpacing: expect.any(Number) } }],
  })
})
