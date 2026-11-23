import { describe, expect, it } from "vitest"
import { mediaTypes } from "./index.js"
import { limits } from "@airdesign/doom"

describe("picture order", () => {
  it("accepts PNG, JPEG and GIF and keeps one picture under its own limit", () => {
    expect(mediaTypes).toEqual(["image/png", "image/jpeg", "image/gif"])
    expect(limits.media).toBe(10_000_000)
    expect(limits.media).toBeLessThan(limits.bytes)
  })
})
