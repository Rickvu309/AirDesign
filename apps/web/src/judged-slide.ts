import type { WireFinding } from "@airdesign/catalog"
import {
  contrast,
  readElementId,
  slideFindings,
  type Fill,
  type Finding,
  type FontWidths,
  type ResolvedElement,
  type ResolvedParagraph,
  type ResolvedSlide,
  type ResolvedText,
  type TextStyle,
} from "@airdesign/document"
import {
  paintKind,
  type PaintElement,
  type PaintFill,
  type PaintParagraph,
  type PaintReader,
  type PaintText,
} from "@airdesign/pptx"
import { bulletLabel, presetTextArea } from "@airdesign/render"

export const pageFont = ""

type SlideSource = { readonly slide: string; readonly part: string }

const emuPerPoint = 12_700

function plain(text: PaintText): boolean {
  if (text.columns > 1 || text.flow !== "horz" || text.vertical) return false
  return text.paragraphs.every((paragraph) =>
    paragraph.runs.every(
      (run) => (run.letterSpacing ?? 0) === 0 && run.baseline === 0 && (run.caps === undefined || run.caps === "none"),
    ),
  )
}

function colorOf(color: { readonly hex: string; readonly alpha: number } | null): { readonly rgb: string } | null {
  return color === null || color.alpha < 1 || !/^[\da-f]{6}$/i.test(color.hex) ? null : { rgb: color.hex.toUpperCase() }
}

function fillOf(fill: PaintFill | null): Fill {
  if (fill === null || fill.type === "none") return "none"
  if (fill.type !== "solid") return "unknown"
  return colorOf(fill.color) ?? "unknown"
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
      color: colorOf(run.color),
    })),
    end: { font: paragraph.endStyle.font ?? pageFont, size: paragraph.endStyle.size },
  }
}

function areaInsets(row: PaintElement, text: PaintText): ResolvedText["insets"] {
  const { box } = row
  const area =
    box === null || row.geometry === null
      ? null
      : presetTextArea(row.geometry, box.width, box.height, row.adjusts ?? {})
  if (box === null || area === null) return text.insets
  const mirrored = box.flipH !== box.flipV
  return {
    left: text.insets.left + (mirrored ? area.right : area.left),
    top: text.insets.top + area.top,
    right: text.insets.right + (mirrored ? area.left : area.right),
    bottom: text.insets.bottom + area.bottom,
  }
}

export function resolvedText(text: PaintText, row?: PaintElement): ResolvedText {
  return {
    paragraphs: text.paragraphs.map(paragraphOf),
    insets: row === undefined ? text.insets : areaInsets(row, text),
    anchor: text.anchor,
    wrap: text.wrap,
    fit: text.fit,
    fontScale: text.fontScale,
    lineReduction: text.spacingReduction,
    vertical: text.vertical,
    ...(plain(text) ? {} : { unmeasured: true as const }),
    ...(text.edgeSpacing === true ? { edgeSpacing: true } : {}),
  }
}

function elementOf(source: SlideSource, row: PaintElement): ResolvedElement {
  const node = row.from === "slide" ? readElementId(`${source.slide}.${row.shape}`) : undefined
  const picture = row.kind === "p:pic" || row.image !== null
  return {
    node: node ?? `${row.part}#${row.shape}`,
    kind: row.table !== undefined ? "table" : row.diagram !== undefined ? "kept" : paintKind(row.kind),
    from: node === undefined ? "layout" : "slide",
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
    fill: picture ? "image" : fillOf(row.fill),
    text: row.text === null ? null : resolvedText(row.text, row),
    cells: null,
  }
}

export function resolvedSlide(
  source: SlideSource,
  reader: PaintReader,
  styles: readonly TextStyle[] = [],
): ResolvedSlide | null {
  try {
    const paint = reader.slide(source.part)
    return {
      slide: source.slide,
      size: { width: paint.width, height: paint.height },
      background: paint.background === null ? { rgb: "FFFFFF" } : fillOf(paint.background),
      scale: styles.flatMap(({ name, fields }) =>
        fields.size === undefined ? [] : [{ name, size: fields.size / 100 }],
      ),
      elements: paint.elements.map((row) => elementOf(source, row)),
    }
  } catch {
    return null
  }
}

function written(text: ResolvedText): readonly ResolvedParagraph["runs"][number][] {
  return text.paragraphs.flatMap((paragraph) => paragraph.runs.filter((run) => run.text.trim() !== ""))
}

function uniform(text: ResolvedText | null | undefined): boolean {
  return text != null && new Set(written(text).map((run) => run.size)).size === 1
}

function oneColor(text: ResolvedText | null | undefined): boolean {
  const colors = text == null ? [] : written(text).map((run) => run.color?.rgb ?? null)
  return colors.length > 0 && colors.every((color) => color !== null && color === colors[0])
}

function hex(channels: readonly number[]): string {
  return channels
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()
}

function channelsOf(color: string): readonly number[] {
  return [0, 2, 4].map((at) => Number.parseInt(color.slice(at, at + 2), 16))
}

const contrastMargin = 1.03

export function readableShade(text: string, behind: string, needs: number): string | null {
  const toward = contrast("000000", behind) >= contrast("FFFFFF", behind) ? [0, 0, 0] : [255, 255, 255]
  const from = channelsOf(text)
  const mixed = (share: number) => hex(from.map((channel, at) => channel + ((toward[at] ?? 0) - channel) * share))
  if (contrast(mixed(1), behind) < needs) return null
  const aim = contrast(mixed(1), behind) >= needs * contrastMargin ? needs * contrastMargin : needs
  let low = 0
  let high = 1
  for (let step = 0; step < 16; step += 1) {
    const middle = (low + high) / 2
    if (contrast(mixed(middle), behind) >= aim) high = middle
    else low = middle
  }
  return mixed(high)
}

function placeOf(slide: ResolvedSlide, node: string): { readonly x: number; readonly y: number } | null {
  const box = slide.elements.find((element) => element.node === node)?.box
  return box == null ? null : { x: box.x / emuPerPoint, y: box.y / emuPerPoint }
}

function wireOf(slide: ResolvedSlide, finding: Finding): WireFinding | null {
  const node = readElementId(finding.node)
  if (node === undefined) return null
  const text = slide.elements.find((element) => element.node === finding.node)?.text
  switch (finding.code) {
    case "overflow":
      return {
        code: "overflow",
        node,
        needed: finding.needed,
        room: finding.room,
        size: uniform(text) ? finding.fix.size : null,
        height: finding.fix.height,
      }
    case "off-slide":
      return {
        code: "off-slide",
        node,
        past: finding.past,
        whole: finding.level === "note",
        x: finding.fix?.x ?? null,
        y: finding.fix?.y ?? null,
      }
    case "overlap": {
      const other = readElementId(finding.other)
      const at = placeOf(slide, finding.other)
      if (other === undefined || at === null) return null
      return { code: "overlap", node, other, by: finding.by, x: at.x + finding.fix.dx, y: at.y + finding.fix.dy }
    }
    case "misaligned": {
      const other = readElementId(finding.other)
      if (other === undefined) return null
      const x = "x" in finding.fix ? finding.fix.x : null
      const y = "y" in finding.fix ? finding.fix.y : null
      return { code: "misaligned", node, other, edge: finding.edge, by: finding.by, x, y }
    }
    case "small-text":
      return { code: "small-text", node, size: finding.size, min: finding.fix.size, uniform: uniform(text) }
    case "off-scale":
      return finding.style.length > 64
        ? null
        : {
            code: "off-scale",
            node,
            size: finding.size,
            to: finding.fix.size,
            style: finding.style,
            uniform: uniform(text),
          }
    case "low-contrast":
      return {
        code: "low-contrast",
        node,
        ratio: finding.ratio,
        needs: finding.needs,
        color: oneColor(text) ? readableShade(finding.text, finding.behind, finding.needs) : null,
      }
    case "empty-placeholder":
      return /^[A-Za-z]{1,32}$/.test(finding.placeholder)
        ? { code: "empty-placeholder", node, placeholder: finding.placeholder }
        : null
  }
}

export function slideTexts(slides: readonly ResolvedSlide[]): readonly ResolvedText[] {
  return slides.flatMap((slide) => slide.elements.flatMap((element) => (element.text === null ? [] : [element.text])))
}

export function wireFindings(slide: ResolvedSlide, widths: FontWidths): readonly WireFinding[] {
  try {
    return slideFindings(slide, widths).findings.flatMap((finding) => wireOf(slide, finding) ?? [])
  } catch {
    return []
  }
}
