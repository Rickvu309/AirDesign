import type { PaintParagraph, PaintRunStyle, PaintText } from "@airdesign/pptx"
import type { CanvasParagraph, CanvasRunStyle, CanvasText } from "@airdesign/render"
import { cssColor } from "@/paint-css"

const emuPerPoint = 12_700
const aligned = { left: "left", center: "center", right: "right", justify: "justify", distributed: "justify" } as const

type Spacing = PaintText["paragraphs"][number]["lineSpacing"]

function spacingOf(spacing: Spacing) {
  if (spacing === null) return null
  return "percent" in spacing ? { percent: spacing.percent } : { length: spacing.points * emuPerPoint }
}

function reducedLines(spacing: Spacing, reduction: number) {
  if (spacing === null) return reduction === 0 ? null : { percent: 1 - reduction }
  return "percent" in spacing ? { percent: spacing.percent - reduction } : spacingOf(spacing)
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
    lineSpacing: reducedLines(paragraph.lineSpacing, reduction),
    spaceBefore: spacingOf(paragraph.spaceBefore),
    spaceAfter: spacingOf(paragraph.spaceAfter),
    bullet: canvasBullet(paragraph.bullet),
    runs: paragraph.runs.map((run) => ({ from: run.from, text: run.text, ...runStyle(run, scale) })),
    endStyle: runStyle(paragraph.endStyle, scale),
  }
}

function fitOf(text: PaintText): Pick<CanvasText, "fit"> {
  if (text.fit === "shrink") return { fit: { kind: "shrink", scale: text.fontScale, reduction: text.spacingReduction } }
  return text.fit === "grow" ? { fit: { kind: "grow" } } : {}
}

export function canvasText(text: PaintText | null): CanvasText | null {
  if (text === null) return null
  return {
    ...fitOf(text),
    paragraphs: text.paragraphs.map((paragraph) => canvasParagraph(paragraph, text.fontScale, text.spacingReduction)),
    anchor: text.anchor,
    insets: text.insets,
    wrap: text.wrap,
    flow: text.flow,
    columns: text.columns,
    columnGap: text.columnGap,
    ...(text.edgeSpacing === true ? { edgeSpacing: true } : {}),
  }
}
