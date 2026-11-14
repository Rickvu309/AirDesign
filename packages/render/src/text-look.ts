import type { ParagraphAlign, Color, RunFormat, TextFormat } from "@airdesign/document"
import type { CSSProperties } from "react"
import { bulletLabel } from "./bullet-label.js"
import { readFormat } from "./run-format-node.js"
import type {
  CanvasBullet,
  CanvasParagraph,
  CanvasRunStyle,
  CanvasSpacing,
  CanvasText,
  CanvasThemeColor,
} from "./record.js"

export type Scaled = (emu: number) => number

type Look = CSSProperties &
  Partial<Record<"--bullet" | "--bullet-font" | "--bullet-color" | "--bullet-size" | "--bullet-hang", string>>

const bulletProps = ["--bullet", "--bullet-font", "--bullet-color", "--bullet-size", "--bullet-hang"]
const bulletRule =
  "[data-paragraph]::before{content:var(--bullet);display:inline-block;min-width:var(--bullet-hang,auto);text-indent:0;pointer-events:none;user-select:none;white-space:pre;font-family:var(--bullet-font,inherit);color:var(--bullet-color,inherit);font-size:var(--bullet-size,1em);line-height:1}"

export type RunPaint = RunFormat & { readonly size?: number; readonly color?: Color }
export type ParagraphPaint = { readonly align?: ParagraphAlign; readonly bullet?: boolean }

export type TextLook = {
  readonly body: CSSProperties
  paragraph(from: number, filled: boolean, overlay?: ParagraphPaint): Look
  run(paragraph: number, from: number, format?: RunPaint): Look
  file(paragraph: number, from: number, format: TextFormat): boolean
  fileSize(paragraph: number, from: number): number | null
  fileColor(paragraph: number, from: number): Color | null
  fileAlign(paragraph: number): ParagraphAlign | null
  fileBullet(paragraph: number): boolean
  swatches(): readonly CanvasThemeColor[]
}

export const anchored = { top: "flex-start", middle: "center", bottom: "flex-end" } as const
const pageFont = "var(--font-sans)"
const pageColor = "black"
const singleLineHeight = 1.2
const noLine = "0"
const openTwins = new Map([
  ["calibri", "Carlito"],
  ["calibri light", "Carlito"],
  ["cambria", "Caladea"],
  ["arial", "Arimo"],
  ["helvetica", "Arimo"],
  ["times new roman", "Tinos"],
])
const loneRun = -1

function isElement(node: Node): node is HTMLElement {
  return node.nodeType === node.ELEMENT_NODE
}

function quotedFamily(font: string): string {
  return `"${font.replace(/["\\]/g, "\\$&")}"`
}

export function familyOf(font: string | null): string {
  if (font === null) return pageFont
  const twin = openTwins.get(font.toLowerCase())
  return [quotedFamily(font), ...(twin === undefined ? [] : [quotedFamily(twin)]), pageFont].join(", ")
}

function lineShare(percent: number): string {
  return String(Math.round(percent * singleLineHeight * 10_000) / 10_000)
}

const singleLine = lineShare(1)

function styleOf(run: CanvasRunStyle, scaled: Scaled): Look {
  return {
    fontFamily: familyOf(run.font),
    fontSize: `${scaled(run.size)}px`,
    fontStyle: run.italic ? "italic" : "normal",
    fontWeight: run.bold ? "700" : "400",
    color: run.color ?? pageColor,
    lineHeight: singleLine,
    textRendering: "geometricPrecision",
  }
}

function marks(run: CanvasRunStyle): Look {
  const drawn = [run.underline === true ? "underline" : "", run.strike === true ? "line-through" : ""].filter(
    (mark) => mark !== "",
  )
  return {
    ...(drawn.length === 0 ? {} : { textDecoration: drawn.join(" ") }),
    ...(run.highlight == null ? {} : { backgroundColor: run.highlight }),
    ...(run.baseline == null || run.baseline === 0 ? {} : { verticalAlign: `${run.baseline}em` }),
  }
}

function fontSize(paragraph: CanvasParagraph): number {
  let size = paragraph.endStyle.size
  for (const run of paragraph.runs) if (run.size > size) size = run.size
  return size
}

function lineHeights(
  spacing: CanvasSpacing | null | undefined,
  scaled: Scaled,
  filled: boolean,
): { readonly paragraph: string; readonly run: string } {
  if (spacing == null) return { paragraph: filled ? noLine : singleLine, run: singleLine }
  if ("percent" in spacing) {
    const height = lineShare(spacing.percent)
    return { paragraph: filled ? noLine : height, run: height }
  }
  const height = `${scaled(spacing.length)}px`
  return { paragraph: filled ? noLine : height, run: height }
}

function gap(
  spacing: CanvasSpacing | null | undefined,
  paragraph: CanvasParagraph,
  scaled: Scaled,
): string | undefined {
  if (spacing == null) return undefined
  const length = "percent" in spacing ? fontSize(paragraph) * spacing.percent : spacing.length
  return `${scaled(length)}px`
}

function cssQuote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

function bulletVars(paragraph: CanvasParagraph, scaled: Scaled): Look {
  const bullet: CanvasBullet | null | undefined = paragraph.bullet
  if (bullet == null) return { "--bullet": "none" }
  const source = paragraph.runs[0] ?? paragraph.endStyle
  const font = bullet.font ?? source.font
  const color = bullet.color ?? source.color
  const indent = paragraph.indent ?? 0
  return {
    "--bullet": cssQuote(bulletLabel(bullet)),
    "--bullet-size": `${scaled((source.size || paragraph.endStyle.size) * (bullet.size ?? 1))}px`,
    ...(font === null ? {} : { "--bullet-font": familyOf(font) }),
    ...(color === null ? {} : { "--bullet-color": color }),
    ...(indent < 0 ? { "--bullet-hang": `${scaled(-indent)}px` } : {}),
  }
}

function paragraphStyle(paragraph: CanvasParagraph, filled: boolean, scaled: Scaled): Look {
  const margin = paragraph.marginLeft ?? 0
  const indent = paragraph.indent ?? 0
  const before = gap(paragraph.spaceBefore, paragraph, scaled)
  const after = gap(paragraph.spaceAfter, paragraph, scaled)
  return {
    ...styleOf(paragraph.endStyle, scaled),
    textAlign: paragraph.align,
    lineHeight: lineHeights(paragraph.lineSpacing, scaled, filled).paragraph,
    ...(margin === 0 ? {} : { paddingLeft: `${scaled(margin)}px` }),
    ...(indent === 0 ? {} : { textIndent: `${scaled(indent)}px` }),
    ...(before === undefined ? {} : { marginTop: before }),
    ...(after === undefined ? {} : { marginBottom: after }),
    ...(filled ? {} : marks(paragraph.endStyle)),
    ...bulletVars(paragraph, scaled),
  }
}

export function ensureBulletRule(doc: Document): void {
  if (doc.head.querySelector("style[data-bullet-rule]") !== null) return
  const style = doc.createElement("style")
  style.dataset.bulletRule = ""
  style.textContent = bulletRule
  doc.head.append(style)
}

function applyStyle(node: HTMLElement, style: Look): void {
  for (const name of bulletProps) node.style.removeProperty(name)
  const plain: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(style)) {
    if (value === undefined || value === null) continue
    if (key.startsWith("--")) node.style.setProperty(key, String(value))
    else plain[key] = value
  }
  Object.assign(node.style, plain)
}

function fileStyle(paragraph: CanvasParagraph, run: number): CanvasRunStyle {
  return paragraph.runs.find((each) => each.from === run) ?? paragraph.endStyle
}

function hundredths(style: CanvasRunStyle): number | null {
  if (style.points !== undefined) return style.points
  if (style.size % 127 !== 0) return null
  const derived = style.size / 127
  return derived >= 100 && derived <= 400_000 ? derived : null
}

function cssHex(color: string | null): string | null {
  if (color === null) return null
  const hex = /^#([\da-f]{6})$/i.exec(color)?.[1]
  if (hex !== undefined) return hex.toUpperCase()
  const rgb = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(color)
  if (rgb === null) return null
  return [rgb[1], rgb[2], rgb[3]]
    .map((channel) => Number(channel).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()
}

function schemeOf(style: CanvasRunStyle, colors: readonly CanvasThemeColor[]): Color | null {
  const hex = cssHex(style.color)
  if (hex === null) return null
  const matches = colors.filter((swatch) => cssHex(swatch.css) === hex)
  const found = matches.length === 1 ? matches[0] : undefined
  return found === undefined ? null : { scheme: found.scheme }
}

function paintedColor(color: Color, colors: readonly CanvasThemeColor[], file: string | null): string | null {
  if ((color.transforms?.length ?? 0) > 0) return file
  if ("rgb" in color) return `#${color.rgb}`
  if ("scheme" in color) return colors.find((swatch) => swatch.scheme === color.scheme)?.css ?? file
  return file
}

function formatted(style: CanvasRunStyle, format: RunPaint, colors: readonly CanvasThemeColor[]): CanvasRunStyle {
  return {
    ...style,
    bold: format.bold ?? style.bold,
    italic: format.italic ?? style.italic,
    underline: format.underline ?? style.underline === true,
    ...(format.size === undefined ? {} : { size: format.size * 127, points: format.size }),
    ...(format.color === undefined ? {} : { color: paintedColor(format.color, colors, style.color) }),
  }
}

function paragraphOverlay(style: Look, paragraph: CanvasParagraph, overlay: ParagraphPaint | undefined): Look {
  const align = overlay?.align === undefined ? style : { ...style, textAlign: overlay.align }
  if (overlay?.bullet === false) return { ...align, "--bullet": "none" }
  if (overlay?.bullet === true && paragraph.bullet == null) return { ...align, "--bullet": cssQuote("•") }
  return align
}

export function textLook(text: CanvasText, scaled: Scaled): TextLook {
  const paragraphs = new Map(text.paragraphs.map((paragraph) => [paragraph.from, paragraph]))
  const colors = text.colors ?? []
  const styleAt = (from: number, run: number) => {
    const paragraph = paragraphs.get(from)
    return paragraph === undefined ? null : fileStyle(paragraph, run)
  }
  return {
    body: {
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      justifyContent: anchored[text.anchor],
      minHeight: "100%",
      whiteSpace: text.wrap ? "pre-wrap" : "pre",
    },
    paragraph(from, filled, overlay) {
      const paragraph = paragraphs.get(from)
      if (paragraph === undefined) return { lineHeight: filled ? noLine : singleLine, "--bullet": "none" }
      return paragraphOverlay(paragraphStyle(paragraph, filled, scaled), paragraph, overlay)
    },
    run(from, run, format = {}) {
      const paragraph = paragraphs.get(from)
      if (paragraph === undefined) return { lineHeight: singleLine }
      const style = formatted(fileStyle(paragraph, run), format, colors)
      const lineHeight = lineHeights(paragraph.lineSpacing, scaled, true).run
      const drawn = marks(style)
      const plain =
        format.underline === undefined || drawn.textDecoration !== undefined ? {} : { textDecoration: "none" }
      return { ...styleOf(style, scaled), ...drawn, ...plain, lineHeight }
    },
    file(from, run, format) {
      const paragraph = paragraphs.get(from)
      return paragraph === undefined ? false : fileStyle(paragraph, run)[format] === true
    },
    fileSize(from, run) {
      const style = styleAt(from, run)
      return style === null ? null : hundredths(style)
    },
    fileColor(from, run) {
      const style = styleAt(from, run)
      return style === null ? null : schemeOf(style, colors)
    },
    fileAlign(from) {
      const align = paragraphs.get(from)?.align
      return align === "left" || align === "center" || align === "right" ? align : null
    },
    fileBullet(from) {
      return paragraphs.get(from)?.bullet != null
    },
    swatches: () => colors,
  }
}

function runsOf(block: HTMLElement): readonly HTMLElement[] {
  return [...block.children].filter(
    (child): child is HTMLElement => isElement(child) && child.dataset.run !== undefined,
  )
}

function isOnlyRun(node: Node): boolean {
  if (!isElement(node)) return node.nodeType === node.TEXT_NODE
  if (node.tagName === "BR") return true
  return node.dataset.run !== undefined && node.children.length === 0
}

export function holdsOnlyRuns(box: HTMLElement): boolean {
  return [...box.childNodes].every(
    (block) => isElement(block) && block.dataset.paragraph !== undefined && [...block.childNodes].every(isOnlyRun),
  )
}

function isFilled(block: HTMLElement): boolean {
  const looseText = [...block.childNodes].some((node) => node.nodeType === node.TEXT_NODE && node.textContent !== "")
  return !looseText && runsOf(block).some((run) => run.textContent !== "")
}

export function restyle(box: HTMLElement, look: TextLook): void {
  for (const block of box.children) {
    if (!isElement(block) || block.dataset.paragraph === undefined) continue
    const from = Number(block.dataset.paragraph)
    const align = block.dataset.align
    const bullet = block.dataset.bullet
    applyStyle(
      block,
      look.paragraph(from, isFilled(block), {
        ...(align === "left" || align === "center" || align === "right" ? { align } : {}),
        ...(bullet === "true" || bullet === "false" ? { bullet: bullet === "true" } : {}),
      }),
    )
    for (const span of runsOf(block)) {
      const [paragraph, run] = (span.dataset.run ?? "").split(".").map(Number)
      applyStyle(span, look.run(from, paragraph === from && run !== undefined ? run : loneRun, readFormat(span)))
    }
  }
}
