import { describe, expect, it } from "vitest"
import { fallbackPrompt, placeholderPrompts } from "./placeholder-copy.js"

describe("placeholderCopy", () => {
  it("gives PowerPoint's own prompts for standard placeholder types", () => {
    expect(fallbackPrompt("title")).toBe("Click to add title")
    expect(fallbackPrompt("ctrTitle")).toBe("Click to add title")
    expect(fallbackPrompt("subTitle")).toBe("Click to add subtitle")
    expect(fallbackPrompt("body")).toBe("Click to add text")
    expect(fallbackPrompt("obj")).toBe("Click to add text")
    expect(fallbackPrompt("secHead")).toBe("Click to add title")
    expect(fallbackPrompt("dt")).toBe("Add date")
    expect(fallbackPrompt("ftr")).toBe("Add footer")
    expect(fallbackPrompt("hdr")).toBe("Add header")
    expect(fallbackPrompt("sldNum")).toBe("Add slide number")
    expect(fallbackPrompt(null)).toBe("Click to add text")
    expect(fallbackPrompt(undefined)).toBe("Click to add text")
  })

  it("has no prompt for a placeholder that is not typed text", () => {
    for (const type of ["pic", "chart", "tbl", "media", "dgm", "clipArt", "unknown"]) {
      expect(fallbackPrompt(type)).toBeNull()
    }
  })

  it("exports table with valid prompt phrases", () => {
    expect(placeholderPrompts.title).toBe("Click to add title")
    expect(placeholderPrompts.subTitle).toBe("Click to add subtitle")
  })
})
