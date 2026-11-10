import { describe, expect, it } from "vitest"
import { newValidatorErrors } from "./validator-error.js"

describe("newValidatorErrors", () => {
  it("keeps an error the original already had", () => {
    expect(newValidatorErrors(["schema-a", "schema-b"], ["schema-b"])).toEqual([])
  })

  it("returns an error the original did not have", () => {
    expect(newValidatorErrors(["schema-a"], ["schema-a", "schema-c"])).toEqual(["schema-c"])
  })
})
