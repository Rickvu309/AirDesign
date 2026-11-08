import type {Id, Run} from "../model.ts"

export type TextStyle = Omit<Run, "text">
export type InlineRun = {kind: "text"; text: string; style: TextStyle} | {kind: "break"; style: TextStyle}
export type NumberFormat = "decimal" | "alphaLower" | "alphaUpper" | "romanLower" | "romanUpper"
export type ParagraphMarker = {kind: "none"} | {kind: "bullet"; character: string} | {kind: "number"; format: NumberFormat; start: number | null}
export type LineSpacing = {kind: "multiple"; value: number} | {kind: "points"; value: number}
export type Paragraph = {
  id: Id
  kind: "paragraph"
  runs: InlineRun[]
  endStyle: TextStyle
  alignment: "left" | "center" | "right" | "justify"
  level: number
  indentation: {left: number; right: number; firstLine: number}
  marker: ParagraphMarker
  spacing: {before: number; after: number; line: LineSpacing}
}
export type TextFrame = {
  id: Id
  kind: "text-frame"
  anchor: "top" | "middle" | "bottom"
  insets: {top: number; right: number; bottom: number; left: number}
  autofit: {kind: "none"} | {kind: "shrink"; fontScale: number; lineReduction: number} | {kind: "resize-shape"}
}
export type TextBody = {frame: TextFrame; paragraphs: [Paragraph, ...Paragraph[]]}
