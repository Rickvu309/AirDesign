import { describe, expect, it } from "vitest"
import { deckAddressOf, replaceDeckAddress, slideAddressOf, slideAddressRead } from "./slide-address"

describe("the slide in the editor address", () => {
  it("reads the slide id from node-id", () => {
    expect(slideAddressRead("?node-id=a:3")).toBe("a:3")
    expect(slideAddressRead("?a=1&node-id=a:3")).toBe("a:3")
  })

  it("reads nothing when node-id is missing or empty", () => {
    expect(slideAddressRead("")).toBeNull()
    expect(slideAddressRead("?node-id=")).toBeNull()
    expect(slideAddressRead("?other=s3")).toBeNull()
  })

  it("keeps node-id and the hash when the deck id arrives", () => {
    expect(deckAddressOf({ search: "?node-id=a%3A3&x=1", hash: "#s" }, "deck")).toBe("/s/deck?node-id=a%3A3&x=1#s")
    expect(deckAddressOf({ search: "", hash: "" }, "deck")).toBe("/s/deck")
  })

  it("replaces the address without dropping history state", () => {
    const history = {
      state: { step: 1 },
      url: "",
      replaceState(state: unknown, _title: string, url: string) {
        this.state = state as { step: number }
        this.url = url
      },
    }
    replaceDeckAddress(history, { search: "?node-id=a%3A3", hash: "" }, "deck")
    expect(history.state).toEqual({ step: 1 })
    expect(history.url).toBe("/s/deck?node-id=a%3A3")
  })

  it("writes node-id and keeps the path, the other parameters and the hash", () => {
    expect(slideAddressOf({ pathname: "/s/abc", search: "", hash: "" }, "a:3")).toBe("/s/abc?node-id=a%3A3")
    expect(slideAddressOf({ pathname: "/s/abc", search: "?a=1&node-id=a:1", hash: "#x" }, "a:3")).toBe(
      "/s/abc?a=1&node-id=a%3A3#x",
    )
  })
})
