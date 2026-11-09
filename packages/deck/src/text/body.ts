import type {Id} from "../model.ts"

export type TextOuterShadow = {kind: "outer"; blur: number; distance: number; direction: number; scale: {x: number; y: number}; skew: {x: number; y: number}; alignment: "tl" | "t" | "tr" | "l" | "ctr" | "r" | "bl" | "b" | "br"; rotateWithShape: boolean; color: string; opacity: number}
export type TextStyle = {outerShadow?: TextOuterShadow; bold: boolean; italic?: boolean; opacity?: number; highlight?: string; underline?: boolean; letterSpacing?: number; baseline?: number; strike?: boolean; capitalization?: "none" | "small" | "all"; kerning?: number; symbolFont?: string; font: string; size: number; color: string | null}
export type InlineRun = {kind: "text"; text: string; style: TextStyle} | {kind: "break"; style: TextStyle}
export type NumberFormat = "decimal" | "alphaLower" | "alphaUpper" | "romanLower" | "romanUpper"
export type MarkerPresentation = {color?: string; size?: {kind: "multiple" | "points"; value: number}}
export type ParagraphSpace = number | {kind: "multiple"; value: number}
export type NumberPunctuation = "period" | "right-parenthesis" | "parentheses"
export type SupportedNumberPresentation = {format: "decimal"; punctuation?: NumberPunctuation | "plain"} | {format: Exclude<NumberFormat, "decimal">; punctuation?: NumberPunctuation}
export type RetainedNumberScheme = "circleNumDbPlain" | "circleNumWdBlackPlain" | "circleNumWdWhitePlain" | "arabicDbPeriod" | "arabicDbPlain" | "ea1ChsPeriod" | "ea1ChsPlain" | "ea1ChtPeriod" | "ea1ChtPlain" | "ea1JpnChsDbPeriod" | "ea1JpnKorPlain" | "ea1JpnKorPeriod" | "arabic1Minus" | "arabic2Minus" | "hebrew2Minus" | "thaiAlphaPeriod" | "thaiAlphaParenR" | "thaiAlphaParenBoth" | "thaiNumPeriod" | "thaiNumParenR" | "thaiNumParenBoth" | "hindiAlphaPeriod" | "hindiNumPeriod" | "hindiNumParenR" | "hindiAlpha1Period"
export type ParagraphMarker = {kind: "none"} | ({kind: "bullet"; character: string; font?: string} & MarkerPresentation) | ({kind: "number"; start: number | null} & SupportedNumberPresentation & MarkerPresentation) | ({kind: "source-number"; scheme: RetainedNumberScheme; start: number | null} & MarkerPresentation)
export type LineSpacing = {kind: "multiple"; value: number} | {kind: "points"; value: number}
export type Paragraph = {
  id: Id
  kind: "paragraph"
  runs: InlineRun[]
  endStyle: TextStyle
  alignment: "left" | "center" | "right" | "justify"
  tabSize?: number
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
  spacingAtEdges?: boolean
  compatibilityLineSpacing?: boolean
  verticalFlow?: "horizontal" | "vertical270"
  anchor: "top" | "middle" | "bottom"
  insets: {top: number; right: number; bottom: number; left: number}
  autofit: {kind: "none"} | {kind: "shrink"; fontScale: number | null; lineReduction: number | null} | {kind: "resize-shape"}
}
export type TextBody = {frame: TextFrame; paragraphs: [Paragraph, ...Paragraph[]]}
