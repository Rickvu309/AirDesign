import { expect, it } from "vitest"
import type { CanvasRunStyle, CanvasText } from "./record.js"
import { accentPaint, inkPaint } from "./run-format-look-art.js"
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

it("paints a chosen size and scheme colour over the file", () => {
  const look = textLook({ ...text, colors: [{ scheme: "accent2", css: accentPaint }] }, scaled)
  expect(look.run(0, 0, { size: 2400, color: { scheme: "accent2" } })).toMatchObject({
    fontSize: `${scaled(2400 * 127)}px`,
    color: accentPaint,
  })
  expect(look.fileSize(0, 0)).toBe(2000)
})

it("paints alignment and bullets over the paragraph", () => {
  const look = textLook(text, scaled)
  expect(look.paragraph(0, true, { align: "center", list: "bullets" })).toMatchObject({
    textAlign: "center",
    "--bullet": '"•"',
  })
  expect(look.paragraph(0, true, { list: "none" })["--bullet"]).toBe("none")
  expect(look.fileAlign(0)).toBe("left")
  expect(look.fileList(0)).toBe("none")
})

it("reads a scheme colour when one theme swatch matches the painted colour", () => {
  const colored: CanvasText = {
    ...text,
    colors: [{ scheme: "dk1", css: inkPaint }],
    paragraphs: [
      {
        from: 0,
        align: "left",
        runs: [
          { from: 0, text: "a", ...plain, color: inkPaint },
          { from: 1, text: "b", ...marked, color: inkPaint },
        ],
        endStyle: { ...plain, color: inkPaint },
      },
    ],
  }
  expect(textLook(colored, scaled).fileColor(0, 0)).toEqual({ scheme: "dk1" })
})

it("reads the file's format of a run, and of a new run from the paragraph's end", () => {
  const look = textLook(text, scaled)
  expect(look.file(0, 1, "bold")).toBe(true)
  expect(look.file(0, 1, "underline")).toBe(true)
  expect(look.file(0, 0, "bold")).toBe(false)
  expect(look.file(0, -1, "italic")).toBe(false)
  expect(look.file(5, 0, "bold")).toBe(false)
})

it("paints a chosen colour with the alpha the exported file paints on that run, so faded text stays faded", () => {
  const faded = `${inkPaint}99`
  const look = textLook(
    {
      ...text,
      colors: [
        { scheme: "accent2", css: accentPaint },
        { scheme: "dk1", css: inkPaint },
      ],
      paragraphs: [{ from: 0, align: "left", runs: [{ from: 0, text: "a", ...plain, color: faded }], endStyle: plain }],
    },
    scaled,
  )
  expect(look.run(0, 0, { color: { scheme: "dk1" } })).toMatchObject({ color: faded })
  expect(look.run(0, 0, { color: { scheme: "accent2" } })).toMatchObject({ color: `${accentPaint}99` })
  const rgb = accentPaint.slice(1)
  expect(look.run(0, 0, { color: { rgb } })).toMatchObject({ color: `${accentPaint}99` })
  expect(textLook(text, scaled).run(0, 0, { color: { rgb } })).toMatchObject({ color: accentPaint })
})

it("paints a chosen font face, line spacing and paragraph spacing over the file", () => {
  const look = textLook({ ...text, edgeSpacing: true }, scaled)
  expect(look.run(0, 0, { font: "Georgia" }).fontFamily).toMatch(/^"Georgia", /)
  const overlay = { lineSpacing: 150_000, spaceBefore: 1_200, spaceAfter: 600 }
  expect(look.paragraph(0, true, overlay)).toMatchObject({ marginTop: "12px", marginBottom: "6px" })
  expect(look.run(0, 0, {}, overlay).lineHeight).toBe("1.8")
  expect(look.run(0, 0, {}).lineHeight).toBe("1.2")
})

it("lays a text box's columns and direction out from the export", () => {
  expect(textLook({ ...text, columns: 2, columnGap: 127_000 }, scaled).body).toMatchObject({
    columnCount: 2,
    columnGap: "10px",
    columnFill: "auto",
  })
  expect(textLook({ ...text, flow: "vert" }, scaled).body).toMatchObject({ minBlockSize: "100%" })
})

it("lets text in columns sit at the body's anchor until it fills the first column, as PowerPoint does", () => {
  const body = textLook({ ...text, anchor: "bottom", columns: 2 }, scaled).body
  expect(body).toMatchObject({ maxBlockSize: "100%", columnFill: "auto" })
  expect(body.blockSize).toBeUndefined()
})

it("balances text its columns cannot hold below the box instead of adding columns", () => {
  const body = textLook({ ...text, columns: 2, overflow: true }, scaled).body
  expect(body).toMatchObject({ columnCount: 2, columnFill: "balance" })
  expect(body.maxBlockSize).toBeUndefined()
})

it("paints set strikethrough and native letter spacing", () => {
  const look = textLook(text, scaled)
  expect(look.run(0, 0, { strike: true, letterSpacing: -64 })).toMatchObject({
    textDecoration: "line-through",
    letterSpacing: "-0.64px",
  })
})

it("paints a numbered paragraph's label", () => {
  expect(textLook(text, scaled).paragraph(0, true, { list: "numbers" })).toMatchObject({ "--bullet": '"1."' })
})
