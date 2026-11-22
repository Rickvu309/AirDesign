import { describe, expect, it } from "vitest"
import { addChangeSchema, readAddChange, readSetChange, setChangeSchema } from "./set-wire.js"

describe("the agent builds no table", () => {
  it("builds no table: not as a kind to add, not as a trait to set", () => {
    const table = { value: '{"rows":[]}' }
    expect(readAddChange({ op: "add", kind: "table", slide: "258", table })).toEqual({
      ok: false,
      refusal: "field",
      field: "kind",
    })
    expect(readAddChange({ op: "add", kind: "shape", slide: "258", table })).toEqual({
      ok: false,
      refusal: "field",
      field: "table",
    })
    expect(readSetChange({ op: "set", target: "258.2", table })).toMatchObject({ ok: false })
    expect(JSON.stringify(addChangeSchema())).not.toContain("table")
    expect(JSON.stringify(setChangeSchema())).not.toContain("table")
  })
})
