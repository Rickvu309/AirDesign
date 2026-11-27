import { bytesOf } from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { intentsSchema } from "./intent-schema.js"

describe("the change schema copy", () => {
  it("describes a move as the parser accepts it", () => {
    const described = JSON.stringify(intentsSchema.$defs.change.properties.op)
    expect(described).toContain("into is required with nodes or box")
    expect(described).toContain("names a slide")
    expect(described).toContain("x, y or both")
    expect(described).toContain("w, h do not resize")
  })

  it("fits the budget for the one tool that carries it", () => {
    const tokens = Math.ceil(bytesOf(JSON.stringify(intentsSchema)) / 4)
    expect(tokens).toBeLessThan(4_500)
  })
})
