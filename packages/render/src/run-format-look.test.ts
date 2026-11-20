import { expect, it } from "vitest"
import type { CanvasRunStyle, CanvasText } from "./record.js"
import { accentPaint, inkPaint } from "./run-format-look-art.js"
import { restyle, textLook } from "./text-look.js"

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

it("reads a scheme colour when one template color matches the painted colour", () => {
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

it("paints a chosen font face, line height and paragraph spacing over the file", () => {
  const look = textLook({ ...text, edgeSpacing: true }, scaled)
  expect(look.run(0, 0, { font: "Georgia" }).fontFamily).toMatch(/^"Georgia", /)
  const overlay = { lineHeight: 150_000, spaceBefore: 1_200, spaceAfter: 600 }
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

it("sizes a new list marker from its first run's current size", () => {
  expect(
    textLook(text, scaled).paragraph(0, true, { list: "numbers", firstRun: { from: 0, size: 3200 } }),
  ).toMatchObject({
    "--bullet-size": "32px",
  })
})

function numberedLabels(
  starts: readonly (number | null)[],
  list?: "numbers",
  levels: readonly number[] = [],
): readonly string[] {
  const paragraphs = starts.map((start, from) => ({
    from,
    level: levels[from] ?? 0,
    align: "left" as const,
    runs: [{ from: 0, text: "Item", ...plain }],
    endStyle: plain,
    bullet: {
      ...(start === null ? { char: "•" } : { autoNumber: "arabicPeriod", number: start, start }),
      font: null,
      color: null,
      size: null,
    },
  }))
  const box = document.createElement("div")
  const blocks = paragraphs.map((paragraph) => {
    const block = document.createElement("div")
    block.dataset.paragraph = String(paragraph.from)
    if (list !== undefined) block.dataset.list = list
    block.textContent = "Item"
    return block
  })
  box.append(...blocks)
  restyle(box, textLook({ ...text, paragraphs }, scaled))
  return blocks.map((block) => block.style.getPropertyValue("--bullet"))
}

it("keeps each imported paragraph's number when no list format was set", () => {
  expect(numberedLabels([1, 7])).toEqual(['"1."', '"7."'])
})

it("starts a chosen decimal list at one, as its native export does", () => {
  expect(numberedLabels([7, 8], "numbers")).toEqual(['"1."', '"2."'])
})

it("continues imported numbering and keeps its levels separate", () => {
  expect(numberedLabels([7, 7])).toEqual(['"7."', '"8."'])
  expect(numberedLabels([1, 1, 1], undefined, [0, 1, 0])).toEqual(['"1."', '"1."', '"2."'])
  expect(numberedLabels([1, null, 1], undefined, [0, 1, 0])).toEqual(['"1."', '"•"', '"2."'])
})

it("paints a native template font token with the current template style's face", () => {
  const styled = { ...text, fonts: { "+mj-lt": "Georgia", "+mn-lt": "Lato" } }
  const look = textLook(styled, scaled)
  expect(look.run(0, 0, { font: "+mj-lt" }).fontFamily).toContain('"Georgia"')
  expect(look.run(0, 0, { font: "+mn-lt" }).fontFamily).toContain('"Lato"')
  expect(look.run(0, 0, { font: "Lato Light" }).fontFamily).toContain('"Lato Light"')
})

it("paints a run filled with an image as the file's picture clipped to the letters", () => {
  const picture = 'url("blob:moon") 0% 0% / 100% 100% no-repeat'
  const look = textLook(
    { ...text, paragraphs: [{ ...text.paragraphs[0]!, runs: [{ from: 0, text: "a", ...plain, picture }] }] },
    scaled,
  )
  expect(look.run(0, 0, { fill: { image: "moon" } })).toMatchObject({
    background: picture,
    backgroundClip: "text",
    color: "transparent",
  })
})

it("paints a run's letter case over the file's caps, keeping the typed letters", () => {
  const look = textLook(text, scaled)
  const shown = (letters: "none" | "upper" | "lower" | "title" | "small") => {
    const css = look.run(0, 0, { case: letters })
    return [css.textTransform, css.fontVariantCaps]
  }
  expect(shown("upper")).toEqual(["uppercase", "normal"])
  expect(shown("lower")).toEqual(["lowercase", "normal"])
  expect(shown("title")).toEqual(["capitalize", "normal"])
  expect(shown("small")).toEqual(["none", "small-caps"])
  const capped = textLook(
    { ...text, paragraphs: [{ ...text.paragraphs[0]!, runs: [{ from: 0, text: "a", ...plain, caps: "all" }] }] },
    scaled,
  )
  expect(capped.run(0, 0, { case: "none" }).textTransform).toBe("none")
  expect(capped.run(0, 0, {}).textTransform).toBe("uppercase")
})
