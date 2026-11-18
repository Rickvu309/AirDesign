import { colorPaint, readableText, type CellFill, type Color, type Palette } from "@airdesign/document"
import type { ByteEdit, MarkupElement } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { paintAttribute } from "./paint-color.js"
import { paintRunColor } from "./run-color.js"
import { owned, type Grid } from "./table-grid.js"

export type TemplateColor = (scheme: string) => string | null

const following = new Set(["dk1", "lt1", "tx1", "bg1"])
const fillKinds = new Set(["a:noFill", "a:solidFill", "a:gradFill", "a:blipFill", "a:pattFill", "a:grpFill"])
const inlineKinds = new Set(["a:r", "a:fld"])

export function themeSlot(palette: Palette): TemplateColor {
  const slots: Readonly<Record<string, string | undefined>> = palette.slots
  const map: Readonly<Record<string, string | undefined>> = palette.map
  return (scheme) => slots[map[scheme] ?? scheme] ?? null
}

function behind(fill: CellFill, slot: TemplateColor): readonly (string | null)[] {
  const hex = (color: Color) => colorPaint(color, slot)?.hex ?? null
  if ("solid" in fill) return [hex(fill.solid)]
  if ("gradient" in fill) return fill.gradient.stops.map((stop) => hex(stop.color))
  if ("pattern" in fill) return [hex(fill.pattern.fg), hex(fill.pattern.bg)]
  return [slot("bg1") ?? slot("lt1")]
}

function follows(grid: Grid, properties: MarkupElement): boolean {
  const fills = (grid.children[properties.index] ?? []).filter((each) => fillKinds.has(each.kind))
  const solid = fills[0]
  if (solid === undefined) return true
  const colors = grid.children[solid.index] ?? []
  const scheme = colors[0]
  return (
    fills.length === 1 &&
    solid.kind === "a:solidFill" &&
    colors.length === 1 &&
    scheme?.kind === "a:schemeClr" &&
    (grid.children[scheme.index] ?? []).length === 0 &&
    following.has(paintAttribute(scheme, "val") ?? "")
  )
}

function painted(bytes: Uint8Array, element: MarkupElement, color: Color): ByteEdit {
  return {
    start: element.start,
    end: element.end,
    next: paintRunColor(bytes.subarray(element.start, element.end), color),
  }
}

function paragraphEdits(grid: Grid, bytes: Uint8Array, paragraph: MarkupElement, color: Color): ByteEdit[] {
  const fresh = (kind: string) => paintRunColor(encodeUtf8(`<${kind}/>`), color)
  if (paragraph.selfClosing) {
    const next = encodeUtf8(`<a:p>${decodeUtf8(fresh("a:endParaRPr"))}</a:p>`)
    return [{ start: paragraph.start, end: paragraph.end, next }]
  }
  const edits: ByteEdit[] = []
  const parts = grid.children[paragraph.index] ?? []
  for (const inline of parts.filter((each) => inlineKinds.has(each.kind))) {
    const format = owned(grid.children, inline, "a:rPr")[0]
    if (format === undefined) edits.push({ start: inline.openEnd, end: inline.openEnd, next: fresh("a:rPr") })
    else if (follows(grid, format)) edits.push(painted(bytes, format, color))
  }
  const ending = parts.find((each) => each.kind === "a:endParaRPr")
  if (ending === undefined)
    edits.push({ start: paragraph.closeStart, end: paragraph.closeStart, next: fresh("a:endParaRPr") })
  else if (follows(grid, ending)) edits.push(painted(bytes, ending, color))
  return edits
}

export function readableEdits(
  grid: Grid,
  bytes: Uint8Array,
  cell: MarkupElement,
  fill: CellFill,
  slot: TemplateColor,
): ByteEdit[] {
  const colors = behind(fill, slot)
  const dark = slot("dk1")
  const light = slot("lt1")
  if (dark === null || light === null || colors.some((each) => each === null)) return []
  const color = { scheme: readableText(colors as readonly string[], dark, light) }
  const body = owned(grid.children, cell, "a:txBody")[0]
  if (body === undefined || body.selfClosing) return []
  return owned(grid.children, body, "a:p").flatMap((paragraph) => paragraphEdits(grid, bytes, paragraph, color))
}
