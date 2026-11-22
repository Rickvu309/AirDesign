import { describe, expect, it } from "vitest"
import { addChangeSchema, readAddChange, readSetChange, setChangeSchema } from "./set-wire.js"

describe("the agent builds no chart", () => {
  it("builds no chart: not as a kind to add, not as a trait to set", () => {
    const chart = { value: '{"kind":"bar","categories":["A"],"series":[{"name":"S","values":[1]}]}' }
    expect(readAddChange({ op: "add", kind: "chart", slide: "258", chart })).toEqual({
      ok: false,
      refusal: "field",
      field: "kind",
    })
    expect(readAddChange({ op: "add", kind: "shape", slide: "258", chart })).toEqual({
      ok: false,
      refusal: "field",
      field: "chart",
    })
    expect(readSetChange({ op: "set", target: "258.2", chart })).toMatchObject({ ok: false })
    expect(JSON.stringify(addChangeSchema())).not.toContain('"chart"')
    expect(JSON.stringify(setChangeSchema())).not.toContain('"chart"')
  })
})
