import { describe, expect, it } from "vitest"
import { textKeyOf } from "./text-formatting.js"

const plain = { code: "", metaKey: false, ctrlKey: false, altKey: false, shiftKey: false }

describe("the text keys", () => {
  it("toggles bold, italic, underline and strikethrough", () => {
    expect(textKeyOf({ ...plain, key: "b", ctrlKey: true })).toEqual({ toggle: "bold" })
    expect(textKeyOf({ ...plain, key: "X", code: "KeyX", metaKey: true, shiftKey: true })).toEqual({ toggle: "strike" })
  })

  it("aligns paragraphs with Option or Alt and Command or Control and L, T or R, wherever the letter sits", () => {
    const align = (code: string) => textKeyOf({ ...plain, key: "¬", code, metaKey: true, altKey: true })
    expect(["KeyL", "KeyT", "KeyR"].map(align)).toEqual([{ place: "left" }, { place: "center" }, { place: "right" }])
  })

  it("turns a bulleted list on or off with Shift and Command or Control and 8", () => {
    expect(textKeyOf({ ...plain, key: "*", code: "Digit8", ctrlKey: true, shiftKey: true })).toEqual({ bullets: true })
    expect(textKeyOf({ ...plain, key: "8", code: "Digit8", ctrlKey: true })).toBeNull()
  })
})
