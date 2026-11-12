import { describe, expect, it } from "vitest"
import { fallbackPrompt, placeholderPrompts } from "./placeholder-copy.js"

describe("placeholderCopy", () => {
  it("provides sentence case fallback prompts for standard placeholder types", () => {
    expect(fallbackPrompt("title")).toBe("Add a title")
    expect(fallbackPrompt("ctrTitle")).toBe("Add a title")
    expect(fallbackPrompt("subTitle")).toBe("Add a subtitle")
    expect(fallbackPrompt("body")).toBe("Add text")
    expect(fallbackPrompt("obj")).toBe("Add text")
    expect(fallbackPrompt("secHead")).toBe("Add a title")
    expect(fallbackPrompt("dt")).toBe("Add date")
    expect(fallbackPrompt("ftr")).toBe("Add footer")
    expect(fallbackPrompt("hdr")).toBe("Add header")
    expect(fallbackPrompt("sldNum")).toBe("Add slide number")
    expect(fallbackPrompt(null)).toBe("Add text")
    expect(fallbackPrompt(undefined)).toBe("Add text")
    expect(fallbackPrompt("unknown")).toBe("Add text")
  })

  it("exports table with valid prompt phrases", () => {
    expect(placeholderPrompts.title).toBe("Add a title")
    expect(placeholderPrompts.subTitle).toBe("Add a subtitle")
  })
})
