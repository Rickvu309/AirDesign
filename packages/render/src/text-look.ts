import { fontFamily } from "@airdesign/fonts"
import {
  colorPaint,
  spacingNames,
  type ParagraphAlign,
  type TextList,
  type ParagraphSpacing,
  type Color,
  type RunFormat,
  type TextFormat,
} from "@airdesign/document"
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

type PaintProp =
  | "--bullet-gap"
  | "--bullet"
  | "--bullet-font"
  | "--bullet-color"
  | "--bullet-size"
  | "--bullet-hang"
  | "--bullet-line"
  | "--bullet-unfocused"
  | "--end-line"

type Look = CSSProperties & Partial<Record<PaintProp, string>>

const paintProps: readonly PaintProp[] = [
  "--bullet-gap",
  "--bullet",
  "--bullet-font",
  "--bullet-color",
  "--bullet-size",
  "--bullet-hang",
  "--bullet-line",
  "--bullet-unfocused",
  "--end-line",
]
const textRule =
  '[data-paragraph]::before{content:var(--bullet);display:inline-block;margin-inline-end:var(--bullet-gap,0);min-width:var(--bullet-hang,auto);text-indent:0;pointer-events:none;user-select:none;white-space:pre;font-family:var(--bullet-font,inherit);color:var(--bullet-color,inherit);font-size:var(--bullet-size,1em);line-height:var(--bullet-line,1)}[data-text-body]:not(:focus-within)>[data-paragraph]::before{content:var(--bullet-unfocused,var(--bullet))}[data-paragraph][data-end-break]::after{content:"\\200b";line-height:var(--end-line)}'

export type RunPaint = RunFormat & {
  readonly size?: number
  readonly color?: Color
  readonly font?: string
  readonly letterSpacing?: number
}
export type ParagraphPaint = {
  readonly align?: ParagraphAlign
  readonly list?: TextList
  readonly number?: number
} & ParagraphSpacing

export type TextLook = {
  readonly body: CSSProperties
  paragraph(from: number, filled: boolean, overlay?: ParagraphPaint): Look
  run(paragraph: number, from: number, format?: RunPaint, overlay?: ParagraphPaint): Look
  file(paragraph: number, from: number, format: TextFormat): boolean
  fileSize(paragraph: number, from: number): number | null
  fileColor(paragraph: number, from: number): Color | null
  fileAlign(paragraph: number): ParagraphAlign | null
  fileList(paragraph: number): TextList
  fileNumber(paragraph: number): number | null
  swatches(): readonly CanvasThemeColor[]
}

export const anchored = { top: "flex-start", middle: "center", bottom: "flex-end" } as const
const pageColor = "black"
const singleLineHeight = 1.2
const shiftedShare = 0.58
const noLine = "0"
const loneRun = -1
const emuPerHundredth = 127
const wholePercent = 100_000

function isElement(node: Node): node is HTMLElement {
  return node.nodeType === node.ELEMENT_NODE
}

export const familyOf = fontFamily

function lineShare(percent: number): string {
  return String(Math.round(percent * singleLineHeight * 10_000) / 10_000)
}

const singleLine = lineShare(1)

function shift(run: CanvasRunStyle): number {
  return run.baseline ?? 0
}

function styleOf(run: CanvasRunStyle, scaled: Scaled): Look {
  return {
    fontFamily: familyOf(run.font),
    fontSize: `${scaled(shift(run) === 0 ? run.size : run.size * shiftedShare)}px`,
    ...(run.letterSpacing === undefined ? {} : { letterSpacing: `${scaled(run.letterSpacing * emuPerHundredth)}px` }),
    fontStyle: run.italic ? "italic" : "normal",
    fontWeight: run.bold ? "700" : "400",
    color: run.color ?? pageColor,
    lineHeight: singleLine,
    textRendering: "geometricPrecision",
    textTransform: run.caps === "all" ? "uppercase" : "none",
    fontVariantCaps: run.caps === "small" ? "small-caps" : "normal",
  }
}

function marks(run: CanvasRunStyle, scaled: Scaled): Look {
  const drawn = [run.underline === true ? "underline" : "", run.strike === true ? "line-through" : ""].filter(
    (mark) => mark !== "",
  )
  return {
    ...(drawn.length === 0 ? {} : { textDecoration: drawn.join(" ") }),
    ...(run.highlight == null ? {} : { backgroundColor: run.highlight }),
    ...(shift(run) === 0 ? {} : { verticalAlign: `${scaled(run.size * shift(run))}px` }),
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

function bulletLine(spacing: CanvasSpacing | null | undefined, scaled: Scaled): Look {
  if (spacing == null) return {}
  if ("length" in spacing) return { "--bullet-line": `min(1em, ${scaled(spacing.length)}px)` }
  return spacing.percent * singleLineHeight < 1 ? { "--bullet-line": lineShare(spacing.percent) } : {}
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
    ...bulletLine(paragraph.lineSpacing, scaled),
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
    "--end-line": lineHeights(paragraph.lineSpacing, scaled, true).run,
    ...(margin === 0 ? {} : { paddingLeft: `${scaled(margin)}px` }),
    ...(indent === 0 ? {} : { textIndent: `${scaled(indent)}px` }),
    ...(before === undefined ? {} : { marginTop: before }),
    ...(after === undefined ? {} : { marginBottom: after }),
    ...(filled ? {} : marks(paragraph.endStyle, scaled)),
    ...bulletVars(paragraph, scaled),
  }
}

export function ensureTextRule(doc: Document): void {
  if (doc.head.querySelector("style[data-text-rule]") !== null) return
  const style = doc.createElement("style")
  style.dataset.textRule = ""
  style.textContent = textRule
  doc.head.append(style)
}

function applyStyle(node: HTMLElement, style: Look): void {
  node.style.removeProperty("letter-spacing")
  node.style.removeProperty("counter-increment")
  node.style.removeProperty("letter-spacing")
  for (const name of paintProps) node.style.removeProperty(name)
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
  const hex = /^#([\da-f]{6})(?:[\da-f]{2})?$/i.exec(color)?.[1]
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
  const slot = (scheme: string) => cssHex(colors.find((swatch) => swatch.scheme === scheme)?.css ?? null)
  const hex = colorPaint(
    { ...color, transforms: (color.transforms ?? []).filter(({ op }) => !op.startsWith("alpha")) },
    slot,
  )?.hex
  if (hex === undefined) return file
  const css = `#${hex}`
  const alpha = file === null ? undefined : /^#[\da-f]{6}([\da-f]{2})$/i.exec(file)?.[1]
  return alpha === undefined || !/^#[\da-f]{6}$/i.test(css) ? css : `${css}${alpha}`
}

function formatted(
  style: CanvasRunStyle,
  format: RunPaint,
  colors: readonly CanvasThemeColor[],
  scale: number,
): CanvasRunStyle {
  return {
    ...style,
    bold: format.bold ?? style.bold,
    italic: format.italic ?? style.italic,
    strike: format.strike ?? style.strike === true,
    ...(format.letterSpacing === undefined ? {} : { letterSpacing: format.letterSpacing * scale }),
    underline: format.underline ?? style.underline === true,
    ...(format.size === undefined ? {} : { size: format.size * emuPerHundredth * scale, points: format.size }),
    ...(format.color === undefined ? {} : { color: paintedColor(format.color, colors, style.color) }),
    ...(format.font === undefined ? {} : { font: format.font }),
  }
}

function spaced(paragraph: CanvasParagraph, overlay: ParagraphPaint | undefined): CanvasParagraph {
  if (overlay === undefined) return paragraph
  const { lineSpacing, spaceBefore, spaceAfter } = overlay
  return {
    ...paragraph,
    ...(lineSpacing === undefined ? {} : { lineSpacing: { percent: lineSpacing / wholePercent } }),
    ...(spaceBefore === undefined ? {} : { spaceBefore: { length: spaceBefore * emuPerHundredth } }),
    ...(spaceAfter === undefined ? {} : { spaceAfter: { length: spaceAfter * emuPerHundredth } }),
  }
}

export function paragraphPaint(dataset: DOMStringMap): ParagraphPaint {
  const { align, list } = dataset
  let paint: ParagraphPaint = {
    ...(align === "left" || align === "center" || align === "right" ? { align } : {}),
    ...(list === "none" || list === "bullets" || list === "numbers" ? { list } : {}),
  }
  for (const name of spacingNames) {
    const kept = dataset[name]
    if (kept !== undefined && /^\d+$/.test(kept)) paint = { ...paint, [name]: Number(kept) }
  }
  return paint
}

function paragraphOverlay(style: Look, paragraph: CanvasParagraph, overlay: ParagraphPaint | undefined): Look {
  const align = overlay?.align === undefined ? style : { ...style, textAlign: overlay.align }
  if (overlay?.list === "none") return { ...align, "--bullet": "none" }
  if (
    overlay?.list === "numbers" ||
    (overlay?.list === undefined &&
      paragraph.bullet != null &&
      "autoNumber" in paragraph.bullet &&
      paragraph.bullet.autoNumber === "arabicPeriod")
  )
    return {
      ...align,
      ...((paragraph.indent ?? 0) < 0 ? {} : { "--bullet-gap": "0.35em" }),
      "--bullet": cssQuote(
        `${overlay?.number ?? (paragraph.bullet != null && "number" in paragraph.bullet ? paragraph.bullet.number : 1)}.`,
      ),
    }
  if (overlay?.list === "bullets") return { ...align, "--bullet": cssQuote("•") }
  return align
}

function bodyLook(text: CanvasText, scaled: Scaled): CSSProperties {
  const whiteSpace = text.wrap ? "pre-wrap" : "pre"
  const columns = text.columns ?? 1
  if (columns > 1) {
    return {
      display: "block",
      flexShrink: 0,
      ...(text.overflow === true ? { columnFill: "balance" } : { maxBlockSize: "100%", columnFill: "auto" }),
      columnCount: columns,
      columnGap: `${scaled(text.columnGap ?? 0)}px`,
      whiteSpace,
    }
  }
  return {
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    justifyContent: anchored[text.anchor],
    ...((text.flow ?? "horz") === "horz" ? { minHeight: "100%" } : { minBlockSize: "100%" }),
    whiteSpace,
  }
}

export const flowModes = {
  horz: {},
  vert: { writingMode: "vertical-rl", textOrientation: "sideways" },
  vert270: { writingMode: "sideways-lr" },
} as const satisfies Readonly<Record<NonNullable<CanvasText["flow"]>, CSSProperties>>

function edged(style: Look, edges: { readonly first: number; readonly last: number } | null, from: number): Look {
  if (edges === null || (from !== edges.first && from !== edges.last)) return style
  const { marginTop, marginBottom, ...rest } = style
  return {
    ...rest,
    ...(from === edges.first || marginTop === undefined ? {} : { marginTop }),
    ...(from === edges.last || marginBottom === undefined ? {} : { marginBottom }),
  }
}

export function textLook(text: CanvasText, scaled: Scaled): TextLook {
  const paragraphs = new Map(text.paragraphs.map((paragraph) => [paragraph.from, paragraph]))
  const edges = {
    first: text.paragraphs[0]?.from ?? 0,
    last: text.paragraphs[text.paragraphs.length - 1]?.from ?? 0,
  }
  const colors = text.colors ?? []
  const scale = text.fit?.kind === "shrink" ? text.fit.scale : 1
  const styleAt = (from: number, run: number) => {
    const paragraph = paragraphs.get(from)
    return paragraph === undefined ? null : fileStyle(paragraph, run)
  }
  return {
    body: bodyLook(text, scaled),
    paragraph(from, filled, overlay) {
      const paragraph = paragraphs.get(from)
      if (paragraph === undefined) return { lineHeight: filled ? noLine : singleLine, "--bullet": "none" }
      const style = edged(
        paragraphOverlay(paragraphStyle(spaced(paragraph, overlay), filled, scaled), paragraph, overlay),
        text.edgeSpacing === true ? null : edges,
        from,
      )
      return filled || overlay?.list === "bullets" || overlay?.list === "numbers"
        ? style
        : { ...style, "--bullet-unfocused": "none" }
    },
    run(from, run, format = {}, overlay) {
      const found = paragraphs.get(from)
      if (found === undefined) return { lineHeight: singleLine }
      const paragraph = spaced(found, overlay)
      const style = formatted(fileStyle(paragraph, run), format, colors, scale)
      const lineHeight = lineHeights(paragraph.lineSpacing, scaled, true).run
      const drawn = marks(style, scaled)
      const plain =
        (format.underline === undefined && format.strike === undefined) || drawn.textDecoration !== undefined
          ? {}
          : { textDecoration: "none" }
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
    fileList(from) {
      const bullet = paragraphs.get(from)?.bullet
      return bullet == null ? "none" : "char" in bullet ? "bullets" : "numbers"
    },
    fileNumber(from) {
      const bullet = paragraphs.get(from)?.bullet
      return bullet != null && "autoNumber" in bullet && bullet.autoNumber === "arabicPeriod" ? bullet.number : null
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
  return node.dataset.run !== undefined && [...node.children].every((child) => child.tagName === "BR")
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

export function endsInBreak(text: string): boolean {
  return text.endsWith("\n")
}

export function restyle(box: HTMLElement, look: TextLook): void {
  let number: number | null = null
  for (const block of box.children) {
    if (!isElement(block) || block.dataset.paragraph === undefined) continue
    block.toggleAttribute("data-end-break", endsInBreak(block.textContent ?? ""))
    const from = Number(block.dataset.paragraph)
    const paint = paragraphPaint(block.dataset)
    const numbered = paint.list === "numbers" || (paint.list === undefined && look.fileNumber(from) !== null)
    number = numbered ? (number === null ? (look.fileNumber(from) ?? 1) : number + 1) : null
    const overlay = number === null ? paint : { ...paint, number }
    applyStyle(block, look.paragraph(from, isFilled(block), overlay))
    for (const span of runsOf(block)) {
      const [paragraph, run] = (span.dataset.run ?? "").split(".").map(Number)
      const at = paragraph === from && run !== undefined ? run : loneRun
      applyStyle(span, look.run(from, at, readFormat(span), overlay))
    }
  }
}
