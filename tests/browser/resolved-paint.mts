import type {
  Fill,
  ResolvedElement,
  ResolvedParagraph,
  ResolvedSlide,
  ResolvedText,
} from "../../packages/document/src/index.ts"
import type { Kind } from "../../packages/document/src/index.ts"
import {
  paintKind,
  type PaintElement,
  type PaintFill,
  type PaintParagraph,
  type PaintText,
  type SlidePaint,
} from "../../packages/pptx/dist/index.js"
import { bulletLabel } from "../../packages/render/dist/bullet-label.js"

export const pageFont = "Geist Variable"

function colorOf(color: { readonly hex: string; readonly alpha: number } | null): { readonly rgb: string } | null {
  return color === null || color.alpha < 1 || !/^[\da-f]{6}$/i.test(color.hex) ? null : { rgb: color.hex.toUpperCase() }
}

export function fillOf(fill: PaintFill | null): Fill {
  if (fill === null || fill.type === "none") return "none"
  if (fill.type !== "solid") return "unknown"
  return colorOf(fill.color) ?? "unknown"
}

function paragraphOf(paragraph: PaintParagraph): ResolvedParagraph {
  const source = paragraph.runs[0] ?? paragraph.endStyle
  const bullet = paragraph.bullet
  const font = (name: string | null) => name ?? pageFont
  return {
    align: paragraph.align,
    level: paragraph.level,
    marginLeft: paragraph.marginLeft,
    indent: paragraph.indent,
    lineSpacing: paragraph.lineSpacing,
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
            font: font(bullet.font ?? source.font),
            size: (source.size || paragraph.endStyle.size) * (bullet.size ?? 1),
          },
    runs: paragraph.runs.map((run) => ({
      text: run.text,
      font: font(run.font),
      size: run.size,
      bold: run.bold,
      italic: run.italic,
      color: colorOf(run.color),
    })),
    end: { font: font(paragraph.endStyle.font), size: paragraph.endStyle.size },
  }
}

export function textOf(text: PaintText): ResolvedText {
  return {
    paragraphs: text.paragraphs.map(paragraphOf),
    insets: text.insets,
    anchor: text.anchor,
    wrap: text.wrap,
    fit: text.fit,
    fontScale: text.fontScale,
    lineReduction: text.spacingReduction,
    vertical: text.vertical,
  }
}

function kindOf(row: PaintElement): Kind {
  if (row.table !== undefined) return "table"
  if (row.diagram !== undefined) return "kept"
  return paintKind(row.kind)
}

function elementOf(row: PaintElement): ResolvedElement {
  return {
    node: `${row.part}#${row.shape}`,
    kind: kindOf(row),
    from: row.from === "slide" ? "slide" : "layout",
    box:
      row.box === null
        ? null
        : {
            x: Math.round(row.box.x),
            y: Math.round(row.box.y),
            cx: Math.max(0, Math.round(row.box.width)),
            cy: Math.max(0, Math.round(row.box.height)),
          },
    rotation: row.box?.rotation ?? 0,
    grouped: row.group !== null,
    placeholder: row.placeholder?.type ?? null,
    fill: row.kind === "p:pic" ? "unknown" : fillOf(row.fill),
    text: row.text === null ? null : textOf(row.text),
    cells:
      row.table === undefined
        ? null
        : row.table.rows.map((tableRow) =>
            tableRow.cells.map(
              (cell) =>
                cell.text?.paragraphs.map((paragraph) => paragraph.runs.map((run) => run.text).join("")).join("\n") ??
                "",
            ),
          ),
  }
}

export function resolvedSlide(slide: string, paint: SlidePaint): ResolvedSlide {
  return {
    slide,
    size: { width: paint.width, height: paint.height },
    background: paint.background === null ? { rgb: "FFFFFF" } : fillOf(paint.background),
    elements: paint.elements.map(elementOf),
  }
}
