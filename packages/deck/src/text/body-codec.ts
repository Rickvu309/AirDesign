import {isId} from "../model.ts"
import type {InlineRun, Paragraph, TextBody, TextFrame, TextStyle} from "./body.ts"

function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value) }
function exact(value: Record<string, unknown>, keys: string[]): boolean { return Object.keys(value).every(key => keys.includes(key)) }
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) }
function nonnegative(value: unknown): value is number { return finite(value) && value >= 0 }
function positive(value: unknown): value is number { return finite(value) && value > 0 }
function style(value: unknown): value is TextStyle {
  return record(value) && exact(value, ["font", "size", "color", "bold", "italic", "underline"]) && typeof value.font === "string" && positive(value.size) && typeof value.color === "string" && typeof value.bold === "boolean" && (value.italic === undefined || typeof value.italic === "boolean") && (value.underline === undefined || typeof value.underline === "boolean")
}
function inline(value: unknown): value is InlineRun {
  if (!record(value) || !style(value.style)) return false
  return value.kind === "text" ? exact(value, ["kind", "text", "style"]) && typeof value.text === "string" && !/[\r\n]/.test(value.text) : value.kind === "break" && exact(value, ["kind", "style"])
}
export function isParagraph(value: unknown): value is Paragraph {
  if (!record(value) || !exact(value, ["id", "kind", "runs", "endStyle", "alignment", "level", "indentation", "marker", "spacing"]) || !isId(value.id) || value.kind !== "paragraph" || !Array.isArray(value.runs) || !value.runs.every(inline) || !style(value.endStyle)) return false
  if (!["left", "center", "right", "justify"].includes(String(value.alignment)) || typeof value.level !== "number" || !Number.isInteger(value.level) || value.level < 0 || value.level > 8) return false
  const indent = value.indentation, marker = value.marker, spacing = value.spacing
  if (!record(indent) || !exact(indent, ["left", "right", "firstLine"]) || !nonnegative(indent.left) || !nonnegative(indent.right) || !finite(indent.firstLine) || !record(marker) || !record(spacing) || !exact(spacing, ["before", "after", "line"]) || !nonnegative(spacing.before) || !nonnegative(spacing.after)) return false
  const line = spacing.line
  if (!record(line) || !exact(line, ["kind", "value"]) || !["multiple", "points"].includes(String(line.kind)) || !positive(line.value)) return false
  switch (marker.kind) {
    case "none": return exact(marker, ["kind"])
    case "bullet": return exact(marker, ["kind", "character"]) && typeof marker.character === "string" && Array.from(marker.character).length === 1 && !/[\r\n]/.test(marker.character)
    case "number": return exact(marker, ["kind", "format", "start"]) && ["decimal", "alphaLower", "alphaUpper", "romanLower", "romanUpper"].includes(String(marker.format)) && (marker.start === null || typeof marker.start === "number" && Number.isSafeInteger(marker.start) && marker.start > 0)
    default: return false
  }
}
export function isTextFrame(value: unknown): value is TextFrame {
  if (!record(value) || !exact(value, ["id", "kind", "anchor", "insets", "autofit"]) || !isId(value.id) || value.kind !== "text-frame" || !["top", "middle", "bottom"].includes(String(value.anchor))) return false
  const insets = value.insets, autofit = value.autofit
  if (!record(insets) || !exact(insets, ["top", "right", "bottom", "left"]) || ![insets.top, insets.right, insets.bottom, insets.left].every(nonnegative) || !record(autofit)) return false
  switch (autofit.kind) {
    case "none": case "resize-shape": return exact(autofit, ["kind"])
    case "shrink": return exact(autofit, ["kind", "fontScale", "lineReduction"]) && positive(autofit.fontScale) && autofit.fontScale <= 1 && nonnegative(autofit.lineReduction) && autofit.lineReduction < 1
    default: return false
  }
}
export function parseTextBody(value: unknown): TextBody {
  if (!record(value) || !exact(value, ["frame", "paragraphs"]) || !isTextFrame(value.frame) || !Array.isArray(value.paragraphs) || value.paragraphs.length === 0 || !value.paragraphs.every(isParagraph)) throw new Error("invalid-text-body")
  const ids = [value.frame.id, ...value.paragraphs.map(paragraph => paragraph.id)]
  if (new Set(ids).size !== ids.length) throw new Error("duplicate-text-node-id")
  const [first, ...rest] = value.paragraphs
  if (!first) throw new Error("invalid-text-body")
  return structuredClone({frame: value.frame, paragraphs: [first, ...rest]})
}
