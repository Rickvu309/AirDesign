import { describe, expect, it } from "vitest"
import { addressOf, addressRead } from "./deck-address"

describe("addressRead", () => {
  it("reads the layout and the query from the search part of the address", () => {
    expect(addressRead("?view=list&q=atlas")).toEqual({ list: true, query: "atlas" })
    expect(addressRead("")).toEqual({ list: false, query: "" })
    expect(addressRead("?view=grid")).toEqual({ list: false, query: "" })
  })

  it("reads an encoded query back the way it was typed", () => {
    expect(addressRead("?q=Q3%20%26%20Q4%20%E2%80%94%20plan").query).toBe("Q3 & Q4 — plan")
  })
})

describe("addressOf", () => {
  it("leaves the path bare when there is nothing to keep", () => {
    expect(addressOf("/all", { list: false, query: "" })).toBe("/all")
  })

  it("keeps the layout before the query", () => {
    expect(addressOf("/", { list: true, query: "another" })).toBe("/?view=list&q=another")
  })

  it("encodes what was typed so a reload reads it back", () => {
    const query = "Q3 & Q4 — plan"
    expect(addressRead(addressOf("/", { list: false, query }).slice(1)).query).toBe(query)
  })
})
