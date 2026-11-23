import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { styleWrite } from "./design-text-values"

describe("styleWrite", () => {
  it("makes text the named style whole, dropping the size, font and bold a person set on it", () => {
    const typed: doom.Text = {
      ...doom.textFromMarkdown("Q3 update", "body"),
      spans: [{ end: 9, size: 32, font: "Inter", bold: true, italic: true }],
    }
    const titled = styleWrite(typed, "title")
    expect(titled.style).toBe("title")
    expect(titled.spans).toEqual([{ end: 9, italic: true }])
  })
})
