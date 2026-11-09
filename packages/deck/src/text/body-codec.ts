import {isNumberPresentation, isRetainedNumberScheme} from "./number-marker.ts"
import {isId} from "../model.ts"
import type {InlineRun, Paragraph, TextBody, TextFrame, TextStyle} from "./body.ts"

function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value) }
function exact(value: Record<string, unknown>, keys: string[]): boolean { return Object.keys(value).every(key => keys.includes(key)) }
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) }
function nonnegative(value: unknown): value is number { return finite(value) && value >= 0 }
function positive(value: unknown): value is number { return finite(value) && value > 0 }
function shadow(value: unknown): boolean {
  return record(value) && exact(value, ["kind", "blur", "distance", "direction", "scale", "skew", "alignment", "rotateWithShape", "color", "opacity"]) && value.kind === "outer" && nonnegative(value.blur) && nonnegative(value.distance) && nonnegative(value.direction) && value.direction < 360 && record(value.scale) && exact(value.scale, ["x", "y"]) && finite(value.scale.x) && finite(value.scale.y) && record(value.skew) && exact(value.skew, ["x", "y"]) && finite(value.skew.x) && Math.abs(value.skew.x) < 90 && finite(value.skew.y) && Math.abs(value.skew.y) < 90 && ["tl", "t", "tr", "l", "ctr", "r", "bl", "b", "br"].includes(String(value.alignment)) && typeof value.rotateWithShape === "boolean" && typeof value.color === "string" && /^#[a-f0-9]{6}$/i.test(value.color) && nonnegative(value.opacity) && value.opacity <= 1
}
function style(value: unknown): value is TextStyle {
  return record(value) && exact(value, ["font", "size", "color", "bold", "italic", "underline", "letterSpacing", "baseline", "strike", "capitalization", "kerning", "opacity", "highlight", "symbolFont", "outerShadow"]) && (value.outerShadow === undefined || shadow(value.outerShadow)) && (value.symbolFont === undefined || typeof value.symbolFont === "string" && value.symbolFont.length > 0) && typeof value.font === "string" && positive(value.size) && (value.color === null || typeof value.color === "string") && typeof value.bold === "boolean" && (value.italic === undefined || typeof value.italic === "boolean") && (value.underline === undefined || typeof value.underline === "boolean") && (value.letterSpacing === undefined || finite(value.letterSpacing)) && (value.baseline === undefined || finite(value.baseline)) && (value.strike === undefined || typeof value.strike === "boolean") && (value.capitalization === undefined || ["none", "small", "all"].includes(String(value.capitalization))) && (value.highlight === undefined || typeof value.highlight === "string" && /^#[a-f0-9]{6}$/i.test(value.highlight)) && (value.opacity === undefined || nonnegative(value.opacity) && value.opacity <= 1) && (value.kerning === undefined || nonnegative(value.kerning))
}
function space(value: unknown): boolean { return nonnegative(value) || record(value) && exact(value, ["kind", "value"]) && value.kind === "multiple" && nonnegative(value.value) }
function presentation(value: Record<string, unknown>): boolean { return (value.color === undefined || typeof value.color === "string" && /^#[a-f0-9]{6}$/i.test(value.color)) && (value.size === undefined || record(value.size) && exact(value.size, ["kind", "value"]) && ["multiple", "points"].includes(String(value.size.kind)) && positive(value.size.value)) }
function inline(value: unknown): value is InlineRun {
  if (!record(value) || !style(value.style)) return false
  return value.kind === "text" ? exact(value, ["kind", "text", "style"]) && typeof value.text === "string" && !/[\r\n]/.test(value.text) : value.kind === "break" && exact(value, ["kind", "style"])
}
export function isParagraph(value: unknown): value is Paragraph {
  if (!record(value) || !exact(value, ["id", "kind", "runs", "endStyle", "alignment", "level", "indentation", "marker", "spacing", "glyphAlignment", "tabSize"]) || !isId(value.id) || value.kind !== "paragraph" || !Array.isArray(value.runs) || !value.runs.every(inline) || !style(value.endStyle)) return false
  if (value.tabSize !== undefined && !positive(value.tabSize)) return false
  if (value.glyphAlignment !== undefined && !["baseline", "top", "center", "bottom"].includes(String(value.glyphAlignment))) return false
  if (!["left", "center", "right", "justify"].includes(String(value.alignment)) || typeof value.level !== "number" || !Number.isInteger(value.level) || value.level < 0 || value.level > 8) return false
  const indent = value.indentation, marker = value.marker, spacing = value.spacing
  if (!record(indent) || !exact(indent, ["left", "right", "firstLine"]) || !nonnegative(indent.left) || !nonnegative(indent.right) || !finite(indent.firstLine) || !record(marker) || !record(spacing) || !exact(spacing, ["before", "after", "line"]) || !space(spacing.before) || !space(spacing.after)) return false
  const line = spacing.line
  if (!record(line) || !exact(line, ["kind", "value"]) || !["multiple", "points"].includes(String(line.kind)) || !positive(line.value)) return false
  switch (marker.kind) {
    case "none": return exact(marker, ["kind"])
    case "bullet": return exact(marker, ["kind", "character", "font", "color", "size"]) && presentation(marker) && (marker.font === undefined || typeof marker.font === "string" && marker.font.length > 0) && typeof marker.character === "string" && Array.from(marker.character).length === 1 && !/[\r\n]/.test(marker.character)
    case "number": return exact(marker, ["kind", "format", "punctuation", "start", "color", "size"]) && presentation(marker) && isNumberPresentation({format: marker.format, punctuation: marker.punctuation}) && (marker.start === null || typeof marker.start === "number" && Number.isSafeInteger(marker.start) && marker.start > 0)
    case "source-number": return exact(marker, ["kind", "scheme", "start", "color", "size"]) && presentation(marker) && isRetainedNumberScheme(marker.scheme) && (marker.start === null || typeof marker.start === "number" && Number.isInteger(marker.start) && marker.start > 0 && marker.start <= 32767)
    default: return false
  }
}
export function isTextFrame(value: unknown): value is TextFrame {
  if (!record(value) || !exact(value, ["id", "kind", "anchor", "insets", "autofit", "compatibilityLineSpacing", "verticalFlow", "wrap", "spacingAtEdges"]) || !isId(value.id) || value.kind !== "text-frame" || !["top", "middle", "bottom"].includes(String(value.anchor))) return false
  if (value.spacingAtEdges !== undefined && typeof value.spacingAtEdges !== "boolean") return false
  if (value.wrap !== undefined && value.wrap !== "square" && value.wrap !== "none") return false
  if (value.compatibilityLineSpacing !== undefined && typeof value.compatibilityLineSpacing !== "boolean" || value.verticalFlow !== undefined && !["horizontal", "vertical270"].includes(String(value.verticalFlow))) return false
  const insets = value.insets, autofit = value.autofit
  if (!record(insets) || !exact(insets, ["top", "right", "bottom", "left"]) || ![insets.top, insets.right, insets.bottom, insets.left].every(nonnegative) || !record(autofit)) return false
  switch (autofit.kind) {
    case "none": case "resize-shape": return exact(autofit, ["kind"])
    case "shrink": return exact(autofit, ["kind", "fontScale", "lineReduction"]) && positive(autofit.fontScale) && autofit.fontScale <= 1 && nonnegative(autofit.lineReduction) && autofit.lineReduction < 1
    default: return false
  }
}
function textBodyShape(value: unknown): value is TextBody {
  return record(value) && exact(value, ["frame", "paragraphs"]) && isTextFrame(value.frame) && Array.isArray(value.paragraphs) && value.paragraphs.length > 0 && value.paragraphs.every(isParagraph)
}
export function isTextBody(value: unknown): value is TextBody {
  if (!textBodyShape(value)) return false
  const ids = [value.frame.id, ...value.paragraphs.map(paragraph => paragraph.id)]
  return new Set(ids).size === ids.length
}
export function parseTextBody(value: unknown): TextBody {
  if (!textBodyShape(value)) throw new Error("invalid-text-body")
  const ids = [value.frame.id, ...value.paragraphs.map(paragraph => paragraph.id)]
  if (new Set(ids).size !== ids.length) throw new Error("duplicate-text-node-id")
  const [first, ...rest] = value.paragraphs
  if (!first) throw new Error("invalid-text-body")
  return structuredClone({frame: value.frame, paragraphs: [first, ...rest]})
}
