import type { OverflowFinding } from "@airdesign/catalog"
import {
  elementOverflow,
  readElementId,
  type ElementId,
  type FontWidths,
  type ResolvedElement,
  type ResolvedParagraph,
  type ResolvedText,
} from "@airdesign/document"
import type { PaintElement, PaintParagraph, PaintReader, PaintText } from "@airdesign/pptx"
import { bulletLabel } from "@airdesign/render"

export const pageFont = ""

export type JudgedText = { readonly slide: string; readonly node: ElementId; readonly element: ResolvedElement }

type SlideSource = { readonly slide: string; readonly part: string }

function plain(text: PaintText): boolean {
  if (text.columns > 1 || text.flow !== "horz" || text.vertical) return false
  return text.paragraphs.every((paragraph) =>
    paragraph.runs.every(
      (run) => (run.letterSpacing ?? 0) === 0 && run.baseline === 0 && (run.caps === undefined || run.caps === "none"),
    ),
  )
}

function paragraphOf(paragraph: PaintParagraph): ResolvedParagraph {
  const source = paragraph.runs[0] ?? paragraph.endStyle
  const { bullet } = paragraph
  return {
    align: paragraph.align,
    level: paragraph.level,
    marginLeft: paragraph.marginLeft,
    indent: paragraph.indent,
    lineHeight: paragraph.lineHeight,
    spaceBefore: paragraph.spaceBefore,
    spaceAfter: paragraph.spaceAfter,
    bullet:
      bullet === null
        ? null
        : {
            text: bulletLabel(
              "char" in bullet
                ? { char: bullet.char, font: bullet.font, color: null, size: bullet.size }
                : {
                    autoNumber: bullet.autoNumber,
                    number: bullet.number,
                    font: bullet.font,
                    color: null,
                    size: bullet.size,
                  },
            ),
            font: bullet.font ?? source.font ?? pageFont,
            size: (source.size || paragraph.endStyle.size) * (bullet.size ?? 1),
          },
    runs: paragraph.runs.map((run) => ({
      text: run.text,
      font: run.font ?? pageFont,
      size: run.size,
      bold: run.bold,
      italic: run.italic,
      color: null,
    })),
    end: { font: paragraph.endStyle.font ?? pageFont, size: paragraph.endStyle.size },
  }
}

export function resolvedText(text: PaintText): ResolvedText {
  return {
    paragraphs: text.paragraphs.map(paragraphOf),
    insets: text.insets,
    anchor: text.anchor,
    wrap: text.wrap,
    fit: text.fit,
    fontScale: text.fontScale,
    lineReduction: text.spacingReduction,
    vertical: text.vertical,
    ...(text.edgeSpacing === true ? { edgeSpacing: true } : {}),
  }
}

function judgedOf(row: PaintElement, node: ElementId, text: PaintText): ResolvedElement | null {
  if (row.box === null || row.box.rotation % 360 !== 0 || !plain(text)) return null
  return {
    node,
    kind: "shape",
    from: "slide",
    box: {
      x: Math.round(row.box.x),
      y: Math.round(row.box.y),
      cx: Math.max(0, Math.round(row.box.width)),
      cy: Math.max(0, Math.round(row.box.height)),
    },
    rotation: 0,
    grouped: row.group !== null,
    placeholder: row.placeholder?.type ?? null,
    fill: "unknown",
    text: resolvedText(text),
    cells: null,
  }
}

export function judgedTexts(slides: readonly SlideSource[], reader: PaintReader): readonly JudgedText[] {
  return slides.flatMap((source) => {
    let rows: readonly PaintElement[]
    try {
      rows = reader.slide(source.part).elements
    } catch {
      return []
    }
    return rows.flatMap((row) => {
      const node = row.from === "slide" ? readElementId(`${source.slide}.${row.shape}`) : undefined
      if (node === undefined || row.text === null || row.text.fit !== "none") return []
      const element = judgedOf(row, node, row.text)
      return element === null ? [] : [{ slide: source.part, node, element }]
    })
  })
}

export function overflowFindings(texts: readonly JudgedText[], widths: FontWidths): readonly OverflowFinding[] {
  return texts.flatMap(({ slide, node, element }) => {
    const found = elementOverflow(slide, element, widths)
    if (found === null || typeof found === "string" || found.code !== "overflow") return []
    return [{ node, needed: found.needed, room: found.room, fix: found.fix }]
  })
}
