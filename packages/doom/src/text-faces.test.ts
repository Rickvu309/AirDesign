import { describe, expect, it } from "vitest"
import { doomFaces } from "./index.js"
import { block, label, plainTheme } from "./testing/doom-fixtures-art.js"
import { doomFromTree } from "./doom-tree.js"

const faces = (nodes: Parameters<typeof doomFromTree>[0]["slides"][number]["children"]) =>
  doomFaces(
    doomFromTree({
      theme: { ...plainTheme, fonts: { heading: "Lora", body: "Inter" } },
      slides: [{ children: nodes }],
    }).doom,
  )

describe("doomFaces", () => {
  it("asks for the regular and bold face of each theme font", () => {
    expect(faces([]).faces).toEqual([
      { font: "Lora", bold: false, italic: false },
      { font: "Lora", bold: true, italic: false },
      { font: "Inter", bold: false, italic: false },
      { font: "Inter", bold: true, italic: false },
    ])
  })

  it("adds a font a span names, and the italic faces only when a span is italic", () => {
    const wanted = faces([
      label(
        "t",
        "ab",
        {},
        {
          spans: [
            { end: 1, font: "Fira Code" },
            { end: 2, italic: true },
          ],
        },
      ),
    ])
    expect(wanted.faces).toContainEqual({ font: "Fira Code", bold: true, italic: false })
    const named = faces([label("n", "M", {}, { spans: [{ end: 1, font: "Source Serif 4 SemiBold" }] })])
    expect(named.faces).toContainEqual({ font: "Source Serif 4", bold: true, italic: false })
    expect(named.faces).toContainEqual({ font: "Source Serif 4 SemiBold", bold: false, italic: false })
    expect(wanted.faces).toContainEqual({ font: "Inter", bold: false, italic: true })
    expect(faces([]).faces.some((face) => face.italic)).toBe(false)
  })

  it("gives the words to measure: every text and the plain alphabet", () => {
    const texts = faces([label("t", "hello", {}), label("u", "Zürich", {}), block("b", 1, 1)]).texts
    expect(texts).toEqual(expect.arrayContaining(["hello", "Zürich"]))
    expect(texts.join("")).toMatch(/0123456789/)
    expect(texts.join("")).toContain("•")
  })
})
