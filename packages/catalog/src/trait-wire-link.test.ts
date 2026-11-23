import { describe, expect, it } from "vitest"
import { readAgent } from "./agent-form.js"
import { readLinkTarget } from "@airdesign/document"
import { traits } from "@airdesign/document"

describe("person and agent link field parity", () => {
  it("accepts the same URL, slide and explicit removal values", () => {
    for (const value of [
      { kind: "url", url: "https://example.com" },
      { kind: "slide", slide: "258" },
      { kind: "none" },
    ]) {
      expect(readAgent(traits.link.fields.target.desc, value)).toEqual({ ok: true, value })
      expect(readLinkTarget(value)).toEqual(value)
    }
  })
  it("refuses authored executable URLs on both paths", () => {
    const value = { kind: "url", url: "javascript:alert(1)" }
    expect(readAgent(traits.link.fields.target.desc, value)).toEqual({ ok: false })
    expect(readLinkTarget(value)).toBeNull()
  })
})
