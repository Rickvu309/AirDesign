import { fontFace, type FontWidths } from "@airdesign/document"
import type { PaintBox, PaintElement, PaintParagraph, PaintReader, PaintRunStyle, PaintText } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { pageFont, readableShade, resolvedSlide, wireFindings } from "./judged-slide"

const part = "ppt/slides/slide1.xml"
const point = 12_700
const box: PaintBox = {
  x: 10 * point,
  y: 10 * point,
  width: 50 * point,
  height: 20 * point,
  rotation: 0,
  flipH: false,
  flipV: false,
}
const even = Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((char) => [char, 0.5]))
const widths: FontWidths = {
  [fontFace("Plain", false, false)]: { ascent: 0.8, descent: 0.2, advances: { ...even, " ": 0.25, x: 0.5 } },
  [fontFace(pageFont, false, false)]: { ascent: 0.8, descent: 0.2, advances: { ...even, " ": 0.25 } },
}

const look: PaintRunStyle = {
  font: "Plain",
  size: 10,
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  baseline: 0,
  color: null,
  highlight: null,
}

function paragraph(line: string, more: Partial<PaintRunStyle> = {}): PaintParagraph {
  return {
    from: 0,
    align: "left",
    level: 0,
    marginLeft: 0,
    indent: 0,
    lineHeight: null,
    spaceBefore: null,
    spaceAfter: null,
    bullet: null,
    runs: [{ ...look, ...more, from: 0, kind: "text", text: line }],
    endStyle: look,
  }
}

function text(more: Partial<PaintText> = {}, run: Partial<PaintRunStyle> = {}): PaintText {
  return {
    paragraphs: [paragraph("aaaa bbbb cccc dddd eeee ffff", run)],
    anchor: "top",
    insets: { left: 0, top: 0, right: 0, bottom: 0 },
    wrap: true,
    fit: "none",
    vertical: false,
    flow: "horz",
    columns: 1,
    columnGap: 0,
    fontScale: 1,
    spacingReduction: 0,
    ...more,
  }
}

function row(shape: string, more: Partial<PaintElement> = {}): PaintElement {
  return {
    part,
    shape,
    from: "slide",
    kind: "p:sp",
    box,
    group: null,
    placeholder: null,
    text: text(),
    fill: null,
    line: null,
    geometry: null,
    image: null,
    ...more,
  }
}

function reader(elements: readonly PaintElement[]): PaintReader {
  return { slide: () => ({ width: 960 * point, height: 540 * point, elements, background: null }) }
}

function found(elements: readonly PaintElement[]) {
  const slide = resolvedSlide(source, reader(elements))
  if (slide === null) throw new Error("no slide")
  return wireFindings(slide, widths)
}

const solid = (hex: string) => ({ type: "solid", color: { hex, alpha: 1 } }) as const
const black = { hex: "000000", alpha: 1 }

const source = { slide: "256", part }

it("finds the slide's own text taller than its box, with the size and height that fit", () => {
  expect(found([row("2"), row("3", { box: { ...box, y: 100 * point, height: 40 * point } })])).toEqual([
    { code: "overflow", node: "256.2", needed: 36, room: 20, size: 7, height: 36 },
  ])
})

it("offers a taller box, not one size, for text whose runs differ in size", () => {
  const mixed = text({
    paragraphs: [paragraph("aaaa bbbb cccc"), paragraph("dddd eeee ffff", { size: 14 })],
  })
  const [overflow] = found([row("2", { text: mixed })])
  expect(overflow).toMatchObject({ code: "overflow", node: "256.2", size: null })
})

it("measures text in a preset's text area, as PowerPoint lays it out", () => {
  const fits = { ...box, width: 120 * point, height: 24 * point }
  expect(found([row("2", { box: fits })])).toEqual([])
  expect(found([row("2", { box: fits, geometry: "ellipse" })])).toMatchObject([{ code: "overflow", node: "256.2" }])
})

it("leaves text it would only guess at, and layers it cannot name", () => {
  expect(
    found(
      [
        row("2", { from: "layout" }),
        row("3", { text: text({ fit: "shrink" }) }),
        row("4", { text: text({ fit: "grow" }) }),
        row("5", { text: text({ columns: 2 }) }),
        row("6", { text: text({}, { letterSpacing: 2 }) }),
        row("7", { text: text({}, { caps: "all" }) }),
        row("9", { text: text({ flow: "vert" }) }),
        row("not a shape"),
      ].map((each, at) => ({ ...each, box: { ...box, y: (10 + at * 60) * point } })),
    ),
  ).toEqual([])
  const broken: PaintReader = {
    slide: () => {
      throw new Error("part")
    },
  }
  expect(resolvedSlide(source, broken)).toBeNull()
})

it("never reports an empty shape, however small its box, nor a face it has no widths for", () => {
  const empty = text({ paragraphs: [paragraph("")] })
  expect(found([row("2", { text: empty, box: { ...box, height: 2 * point } })])).toEqual([])
  expect(found([row("2", { text: text({}, { font: "Unmeasured" }) })])).toEqual([])
})

it("counts a filled shape over words as hiding them, but not a picture, which may be clear around its art", () => {
  const words = row("2", { box: { ...box, height: 40 * point } })
  const card = row("3", { text: null, fill: solid("FFFFFF"), box: { ...box, y: 15 * point } })
  expect(found([words, card])).toEqual([{ code: "overlap", node: "256.2", other: "256.3", by: "cover", x: 10, y: 45 }])
  const logo = row("3", { text: null, kind: "p:pic", box: { ...box, y: 15 * point } })
  expect(found([words, logo])).toEqual([])
})

it("moves words that run past the slide's edge back onto it", () => {
  const past = row("2", { box: { ...box, x: 930 * point, height: 40 * point } })
  expect(found([past])).toEqual([{ code: "off-slide", node: "256.2", past: 12.5, whole: false, x: 910, y: 10 }])
})

it("keeps the hue of text too pale to read, and offers no color for words in several colors", () => {
  const green = { hex: "00B050", alpha: 1 }
  const pale = row("2", {
    box: { ...box, width: 400 * point, height: 80 * point },
    text: text({}, { color: green, size: 24 }),
  })
  const [finding] = found([pale])
  expect(finding).toMatchObject({ code: "low-contrast", node: "256.2", needs: 3 })
  const color = finding?.code === "low-contrast" ? finding.color : null
  expect(color).toMatch(/^00[0-9A-F]{4}$/)
  const twoColors = text({
    paragraphs: [paragraph("aaaa", { color: green, size: 24 }), paragraph("bbbb", { color: black, size: 24 })],
  })
  expect(found([row("2", { box: { ...box, width: 400 * point, height: 80 * point }, text: twoColors })])).toMatchObject(
    [{ code: "low-contrast", color: null }],
  )
  expect(readableShade("00B050", "FFFFFF", 4.5)).toBe("00893E")
})

it("names small type with the size to set, and an empty placeholder to delete", () => {
  const tiny = row("2", { box: { ...box, height: 40 * point }, text: text({}, { size: 8 }) })
  const prompt = row("3", { text: text({ paragraphs: [paragraph("")] }), placeholder: { type: "subTitle", index: 1 } })
  expect(found([tiny, prompt])).toEqual([
    { code: "small-text", node: "256.2", size: 8, min: 10, uniform: true },
    { code: "empty-placeholder", node: "256.3", placeholder: "subTitle" },
  ])
})

it("moves a card a point or two out of its column back into line", () => {
  const card = (shape: string, x: number, y: number) =>
    row(shape, { text: null, fill: solid("DDDDDD"), box: { ...box, x: x * point, y: y * point, height: 60 * point } })
  expect(found([card("2", 72, 100), card("3", 72, 200), card("4", 73.5, 300)])).toEqual([
    { code: "misaligned", node: "256.4", other: "256.3", edge: "left", by: 1.5, x: 72, y: null },
  ])
})
