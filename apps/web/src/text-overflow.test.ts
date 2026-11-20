import { fontFace, type FontWidths } from "@airdesign/document"
import type { PaintBox, PaintElement, PaintParagraph, PaintReader, PaintRunStyle, PaintText } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { judgedTexts, overflowFindings, pageFont } from "./text-overflow"

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

const source = { slide: "256", part }

it("finds the slide's own text taller than its box, with the size and height that fit", () => {
  const texts = judgedTexts([source], reader([row("2"), row("3", { box: { ...box, height: 40 * point } })]))
  expect(texts.map(({ node }) => node)).toEqual(["256.2", "256.3"])
  const found = overflowFindings(texts, widths)
  expect(found).toHaveLength(1)
  expect(found[0]?.node).toBe("256.2")
  expect(found[0]?.needed).toBeCloseTo(36)
  expect(found[0]?.room).toBeCloseTo(20)
  expect(found[0]?.fix).toEqual({ size: 7, height: 36 })
})

it("leaves text it would only guess at, text the box fits by itself, and layers it cannot name", () => {
  const skipped = judgedTexts(
    [source],
    reader([
      row("2", { from: "layout" }),
      row("3", { text: text({ fit: "shrink" }) }),
      row("4", { text: text({ fit: "grow" }) }),
      row("5", { text: text({ columns: 2 }) }),
      row("6", { text: text({}, { letterSpacing: 2 }) }),
      row("7", { text: text({}, { caps: "all" }) }),
      row("8", { box: { ...box, rotation: 90 } }),
      row("9", { text: text({ flow: "vert" }) }),
      row("not a shape"),
    ]),
  )
  expect(skipped).toEqual([])
  const broken: PaintReader = {
    slide: () => {
      throw new Error("part")
    },
  }
  expect(judgedTexts([source], broken)).toEqual([])
})

it("never reports an empty shape, however small its box", () => {
  const empty = text({ paragraphs: [paragraph("")] })
  const tiny = { ...box, height: 2 * point }
  const texts = judgedTexts([source], reader([row("2", { text: empty, box: tiny })]))
  expect(overflowFindings(texts, widths)).toEqual([])
})

it("leaves a face it has no widths for unjudged", () => {
  const texts = judgedTexts([source], reader([row("2", { text: text({}, { font: "Unmeasured" }) })]))
  expect(texts).toHaveLength(1)
  expect(overflowFindings(texts, widths)).toEqual([])
})
