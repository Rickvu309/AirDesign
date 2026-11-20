import { describe, expect, it } from "vitest"
import type { IndexElement } from "./deck-index.js"
import { elementId } from "./element-id.js"
import { iconSideOn, oneInch } from "./icon-size.js"

function text(node: string, size?: number, source?: "master"): IndexElement {
  return {
    node: elementId(node),
    kind: "shape",
    value: "",
    box: null,
    grouped: false,
    ...(size === undefined ? {} : { design: { "text.size": source === undefined ? [size] : [size, source] } }),
  }
}

describe("a new icon is sized from the text on its slide", () => {
  it("is 1.5 times the slide's body text, the lower middle of its text sizes, inherited sizes included", () => {
    const deck = [
      text("256.2", 44),
      text("256.3", 24),
      text("257.2", 36),
      text("257.3", 21),
      text("257.4", 18, "master"),
    ]
    expect(iconSideOn(deck, "256")).toBe(36 * 12_700)
    expect(iconSideOn(deck, "257")).toBe(31.5 * 12_700)
  })

  it("keeps one inch on a slide with no text size", () => {
    expect(iconSideOn([text("256.2"), text("258.2", 18)], "256")).toBe(oneInch)
    expect(iconSideOn([], "256")).toBe(oneInch)
  })
})
