import { expect, it } from "vitest"
import type { CanvasRunStyle, CanvasText } from "./record.js"
import { textLook } from "./text-look.js"

const scaled = (emu: number) => emu / 12_700

const plain: CanvasRunStyle = { font: "Arial", size: 254_000, bold: false, italic: false, color: null }
const marked: CanvasRunStyle = { ...plain, bold: true, underline: true, strike: true }

const text: CanvasText = {
  paragraphs: [
    {
      from: 0,
      align: "left",
      runs: [
        { from: 0, text: "a", ...plain },
        { from: 1, text: "b", ...marked },
      ],
      endStyle: plain,
    },
  ],
  anchor: "top",
  insets: { left: 0, top: 0, right: 0, bottom: 0 },
  wrap: true,
}

it("paints a run's set format over the file's style", () => {
  const look = textLook(text, scaled)
  expect(look.run(0, 0, { bold: true, italic: true, underline: true })).toMatchObject({
    fontWeight: "700",
    fontStyle: "italic",
    textDecoration: "underline",
  })
  expect(look.run(0, 1, { bold: false, underline: false })).toMatchObject({
    fontWeight: "400",
    textDecoration: "line-through",
  })
})

it("paints a run with no set format as the file has it", () => {
  const look = textLook(text, scaled)
  expect(look.run(0, 1, {})).toEqual(look.run(0, 1))
})

it("reads the file's format of a run, and of a new run from the paragraph's end", () => {
  const look = textLook(text, scaled)
  expect(look.file(0, 1, "bold")).toBe(true)
  expect(look.file(0, 1, "underline")).toBe(true)
  expect(look.file(0, 0, "bold")).toBe(false)
  expect(look.file(0, -1, "italic")).toBe(false)
  expect(look.file(5, 0, "bold")).toBe(false)
})
