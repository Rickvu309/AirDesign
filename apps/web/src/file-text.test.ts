import type { PaintElement, PaintRunStyle, PaintText, SlidePaint } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { fileTexts } from "./file-text"

const style: PaintRunStyle = {
  font: "Arial",
  size: 18,
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  baseline: 0,
  color: null,
  highlight: null,
}

function text(bold: boolean): PaintText {
  return {
    paragraphs: [
      {
        from: 0,
        align: "left",
        level: 0,
        marginLeft: 0,
        indent: 0,
        lineSpacing: null,
        spaceBefore: null,
        spaceAfter: null,
        bullet: null,
        runs: [{ ...style, bold, from: 0, kind: "text", text: "Hello" }],
        endStyle: style,
      },
    ],
    anchor: "top",
    insets: { left: 0, top: 0, right: 0, bottom: 0 },
    wrap: true,
    fontScale: 1,
    spacingReduction: 0,
  }
}

function row(shape: string, painted: PaintText | null, from: PaintElement["from"] = "slide"): PaintElement {
  return {
    part: "ppt/slides/slide1.xml",
    shape,
    from,
    kind: "p:sp",
    box: null,
    group: null,
    placeholder: null,
    text: painted,
    fill: null,
    line: null,
    geometry: null,
    image: null,
  }
}

function file(elements: readonly PaintElement[]): SlidePaint {
  return { width: 1, height: 1, background: null, elements }
}

it("paints a slide element's text with the style its file runs have, not the edited runs", () => {
  const edited = [row("2", text(true)), row("3", text(true))]
  const painted = fileTexts(edited, file([row("2", text(false))]))
  expect(painted[0]?.text).toEqual(text(false))
  expect(painted[1]?.text).toEqual(text(true))
})

it("keeps the edited text of a row the file has twice, has no text for, or that comes from the layout", () => {
  const edited = [row("2", text(true)), row("4", text(true)), row("5", text(true), "layout")]
  const twice = file([row("2", text(false)), row("2", text(false)), row("4", null), row("5", text(false), "layout")])
  expect(fileTexts(edited, twice)).toEqual(edited)
})

it("keeps every row when there is no file paint", () => {
  const edited = [row("2", text(true))]
  expect(fileTexts(edited, null)).toBe(edited)
})
