import type {Id} from "../model.ts"

export type TextStyle = {bold: boolean; italic?: boolean; opacity?: number; highlight?: string; underline?: boolean; letterSpacing?: number; baseline?: number; strike?: boolean; capitalization?: "none" | "small" | "all"; kerning?: number; font: string; size: number; color: string}
export type InlineRun = {kind: "text"; text: string; style: TextStyle} | {kind: "break"; style: TextStyle}
export type NumberFormat = "decimal" | "alphaLower" | "alphaUpper" | "romanLower" | "romanUpper"
export type MarkerPresentation = {color?: string; size?: {kind: "multiple" | "points"; value: number}}
export type ParagraphSpace = number | {kind: "multiple"; value: number}
export type ParagraphMarker = {kind: "none"} | ({kind: "bullet"; character: string; font?: string} & MarkerPresentation) | ({kind: "number"; format: NumberFormat; start: number | null} & MarkerPresentation)
export type LineSpacing = {kind: "multiple"; value: number} | {kind: "points"; value: number}
export type Paragraph = {
  id: Id
  kind: "paragraph"
  runs: InlineRun[]
  endStyle: TextStyle
  alignment: "left" | "center" | "right" | "justify"
  glyphAlignment?: "baseline" | "top" | "center" | "bottom"
  level: number
  indentation: {left: number; right: number; firstLine: number}
  marker: ParagraphMarker
  spacing: {before: ParagraphSpace; after: ParagraphSpace; line: LineSpacing}
}
export type TextFrame = {
  id: Id
  kind: "text-frame"
  wrap?: "square" | "none"
  compatibilityLineSpacing?: boolean
  verticalFlow?: "horizontal" | "vertical270"
  anchor: "top" | "middle" | "bottom"
  insets: {top: number; right: number; bottom: number; left: number}
  autofit: {kind: "none"} | {kind: "shrink"; fontScale: number; lineReduction: number} | {kind: "resize-shape"}
}
export type TextBody = {frame: TextFrame; paragraphs: [Paragraph, ...Paragraph[]]}
