import { describe, expect, it } from "vitest"
import { measureWith, type Text } from "./index.js"
import { testTheme } from "./testing/theme.js"

const measure = measureWith({})

function linesOf(chars: string) {
  const text: Text = {
    chars,
    spans: [],
    paras: chars.split("\n").map(() => ({})),
    style: "body",
    resize: "height",
    alignV: "top",
  }
  return measure(text, testTheme, 500).lines.map((line) => [line.start, line.end])
}

describe("the character range of each line", () => {
  it("places an empty paragraph at its own offset, between its neighbours", () => {
    expect(linesOf("a\n\nb")).toEqual([
      [0, 1],
      [2, 2],
      [3, 4],
    ])
  })

  it("places a trailing and a leading empty paragraph", () => {
    expect(linesOf("a\n")).toEqual([
      [0, 1],
      [2, 2],
    ])
    expect(linesOf("\nb")).toEqual([
      [0, 0],
      [1, 2],
    ])
  })

  it("gives empty text one empty line at zero", () => {
    expect(linesOf("")).toEqual([[0, 0]])
  })
})
