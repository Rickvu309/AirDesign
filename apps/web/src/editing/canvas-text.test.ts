import type { PaintParagraph, PaintText } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { canvasText } from "@/editing/canvas-text"

const style = {
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
const dot = { char: "•", font: "Arial", color: null, size: null }
const dash = { char: "–", font: "Arial", color: null, size: null }

function paragraph(overrides: Partial<PaintParagraph> = {}): PaintParagraph {
  return {
    from: 0,
    align: "left",
    level: 0,
    marginLeft: 0,
    indent: 0,
    lineHeight: null,
    spaceBefore: null,
    spaceAfter: null,
    bullet: dot,
    runs: [],
    endStyle: style,
    ...overrides,
  }
}

function text(paragraphs: readonly PaintParagraph[], extra: Partial<PaintText> = {}): PaintText {
  return {
    paragraphs,
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
    ...extra,
  }
}

it("carries a placeholder's template bullets and which paragraphs hold their own", () => {
  const shown = canvasText(
    text([paragraph(), paragraph({ from: 1, ownBullet: true })], { templateBullets: [dot, dash, null] }),
  )
  expect(shown?.templateBullets).toEqual([dot, dash, null])
  expect(shown?.paragraphs.map((item) => item.ownBullet)).toEqual([undefined, true])
})

it("leaves a text box without template bullets", () => {
  expect(canvasText(text([paragraph()]))).not.toHaveProperty("templateBullets")
})
