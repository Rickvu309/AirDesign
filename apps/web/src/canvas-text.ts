import type { PaintParagraph, PaintRunStyle, PaintText } from "@airdesign/pptx"
import type { CanvasParagraph, CanvasRunStyle, CanvasText } from "@airdesign/render"
import { cssColor } from "@/paint-css"

const emuPerPoint = 12_700
const aligned = { left: "left", center: "center", right: "right", justify: "justify", distributed: "justify" } as const

function spacingOf(spacing: PaintText["paragraphs"][number]["lineSpacing"], factor: number) {
  if (spacing === null) return factor === 1 ? null : { percent: factor }
  if ("percent" in spacing) return { percent: spacing.percent * factor }
  return { length: spacing.points * emuPerPoint * factor }
}

function canvasBullet(bullet: PaintParagraph["bullet"]) {
  if (bullet === null) return null
  const look = {
    font: bullet.font,
    color: bullet.color === null ? null : cssColor(bullet.color),
    size: bullet.size,
  }
  return "char" in bullet
    ? { char: bullet.char, ...look }
    : { autoNumber: bullet.autoNumber, number: bullet.number, ...look }
}

function runStyle(run: PaintRunStyle, scale: number): CanvasRunStyle {
  return {
    font: run.font,
    size: run.size * emuPerPoint * scale,
    points: Math.round(run.size * 100),
    bold: run.bold,
    italic: run.italic,
    underline: run.underline,
    strike: run.strike,
    baseline: run.baseline,
    color: run.color === null ? null : cssColor(run.color),
    highlight: run.highlight === null ? null : cssColor(run.highlight),
  }
}

function canvasParagraph(paragraph: PaintParagraph, scale: number, reduction: number): CanvasParagraph {
  return {
    from: paragraph.from,
    align: aligned[paragraph.align],
    marginLeft: paragraph.marginLeft,
    indent: paragraph.indent,
    lineSpacing: spacingOf(paragraph.lineSpacing, 1 - reduction),
    spaceBefore: spacingOf(paragraph.spaceBefore, 1),
    spaceAfter: spacingOf(paragraph.spaceAfter, 1),
    bullet: canvasBullet(paragraph.bullet),
    runs: paragraph.runs.map((run) => ({ from: run.from, text: run.text, ...runStyle(run, scale) })),
    endStyle: runStyle(paragraph.endStyle, scale),
  }
}

export function canvasText(text: PaintText | null): CanvasText | null {
  if (text === null) return null
  return {
    paragraphs: text.paragraphs.map((paragraph) => canvasParagraph(paragraph, text.fontScale, text.spacingReduction)),
    anchor: text.anchor,
    insets: text.insets,
    wrap: text.wrap,
    flow: text.flow,
    columns: text.columns,
    columnGap: text.columnGap,
  }
}
