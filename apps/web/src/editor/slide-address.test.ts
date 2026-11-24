import { describe, expect, it } from "vitest"
import { slideAddressOf, slideAddressRead } from "./slide-address"

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

  it("writes node-id and keeps the path, the other parameters and the hash", () => {
    expect(slideAddressOf({ pathname: "/s/abc", search: "", hash: "" }, "a:3")).toBe("/s/abc?node-id=a%3A3")
    expect(slideAddressOf({ pathname: "/s/abc", search: "?a=1&node-id=a:1", hash: "#x" }, "a:3")).toBe(
      "/s/abc?a=1&node-id=a%3A3#x",
    )
  })
})
