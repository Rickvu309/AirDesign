import { describe, expect, it } from "vitest"
import { readLinkTarget } from "./link-target.js"

describe("whole-element link destinations", () => {
  it("accepts safe URLs and stable slide IDs, and distinguishes explicit removal", () => {
    expect(readLinkTarget({ kind: "url", url: "https://example.com" })).toEqual({
      kind: "url",
      url: "https://example.com",
    })
    expect(readLinkTarget({ kind: "slide", slide: "258" })).toEqual({ kind: "slide", slide: "258" })
    expect(readLinkTarget({ kind: "none" })).toEqual({ kind: "none" })
  })
  it("refuses executable URLs, controls and malformed destinations", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,hi",
      "file:///tmp/a",
      "https://exa\nmple.com",
      "example.com",
    ])
      expect(readLinkTarget({ kind: "url", url })).toBeNull()
    expect(readLinkTarget({ kind: "slide", slide: "258.7" })).toBeNull()
    expect(readLinkTarget({ kind: "none", url: "https://example.com" })).toBeNull()
  })
})
