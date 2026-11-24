import { describe, expect, it } from "vitest"
import { readDeckEdit } from "./deck-edit-wire.js"
import { readNamedDeck } from "./wire.js"

const idForm = "1 to 64 of letters, digits, _ or -."
const changesForm = "1 to 100 changes."
const editForm = "One of deck, base, runId, changes."
const base = { deck: "d", base: 3, changes: [{ op: "add" }] }

describe("edit_deck names the call field that failed", () => {
  it("names an empty batch, a missing batch, an unknown argument, a bad run id and a missing deck", () => {
    expect(readDeckEdit({ ...base, changes: [] })).toEqual({
      ok: false,
      refusal: "batch",
      field: "changes",
      fault: "form",
      form: changesForm,
    })
    expect(readDeckEdit({ deck: "d", base: 3 })).toEqual({
      ok: false,
      refusal: "batch",
      field: "changes",
      fault: "missing",
      form: changesForm,
    })
    expect(readDeckEdit({ ...base, extra: 1 })).toEqual({
      ok: false,
      refusal: "field",
      field: "extra",
      fault: "unknown",
      form: editForm,
    })
    expect(readDeckEdit({ ...base, runId: "bad id!" })).toEqual({
      ok: false,
      refusal: "field",
      field: "runId",
      fault: "form",
      form: idForm,
    })
    expect(readNamedDeck({ base: 3, changes: [] })).toEqual({
      ok: false,
      refusal: "field",
      field: "deck",
      fault: "missing",
      form: idForm,
    })
    expect(readDeckEdit({ base: 3, changes: [{ op: "add" }] })).toEqual({
      ok: false,
      refusal: "field",
      field: "deck",
      fault: "missing",
      form: idForm,
    })
    expect(readNamedDeck({ deck: "a b" })).toEqual({ ok: false, refusal: "deck" })
  })
})
