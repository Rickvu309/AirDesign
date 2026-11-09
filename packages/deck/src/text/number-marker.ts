import type {ParagraphMarker, RetainedNumberScheme, SupportedNumberPresentation} from "./body.ts"

export const supportedNumberSchemes = {
  arabicPlain: {format: "decimal", punctuation: "plain"},
  arabicPeriod: {format: "decimal"},
  arabicParenR: {format: "decimal", punctuation: "right-parenthesis"},
  arabicParenBoth: {format: "decimal", punctuation: "parentheses"},
  alphaLcPeriod: {format: "alphaLower"},
  alphaUcPeriod: {format: "alphaUpper"},
  alphaLcParenR: {format: "alphaLower", punctuation: "right-parenthesis"},
  alphaUcParenR: {format: "alphaUpper", punctuation: "right-parenthesis"},
  alphaLcParenBoth: {format: "alphaLower", punctuation: "parentheses"},
  alphaUcParenBoth: {format: "alphaUpper", punctuation: "parentheses"},
  romanLcPeriod: {format: "romanLower"},
  romanUcPeriod: {format: "romanUpper"},
  romanLcParenR: {format: "romanLower", punctuation: "right-parenthesis"},
  romanUcParenR: {format: "romanUpper", punctuation: "right-parenthesis"},
  romanLcParenBoth: {format: "romanLower", punctuation: "parentheses"},
  romanUcParenBoth: {format: "romanUpper", punctuation: "parentheses"},
} satisfies Record<string, SupportedNumberPresentation>

export const retainedNumberSchemes = [
  "circleNumDbPlain", "circleNumWdBlackPlain", "circleNumWdWhitePlain",
  "arabicDbPeriod", "arabicDbPlain", "ea1ChsPeriod", "ea1ChsPlain", "ea1ChtPeriod",
  "ea1ChtPlain", "ea1JpnChsDbPeriod", "ea1JpnKorPlain", "ea1JpnKorPeriod",
  "arabic1Minus", "arabic2Minus", "hebrew2Minus", "thaiAlphaPeriod",
  "thaiAlphaParenR", "thaiAlphaParenBoth", "thaiNumPeriod", "thaiNumParenR",
  "thaiNumParenBoth", "hindiAlphaPeriod", "hindiNumPeriod", "hindiNumParenR", "hindiAlpha1Period",
] satisfies RetainedNumberScheme[]

export function isRetainedNumberScheme(value: unknown): value is RetainedNumberScheme {
  return retainedNumberSchemes.some(scheme => scheme === value)
}
export function isNumberPresentation(value: {format: unknown; punctuation?: unknown}): boolean {
  return Object.values(supportedNumberSchemes).some(presentation => presentation.format === value.format && ("punctuation" in presentation ? presentation.punctuation : "period") === (value.punctuation === undefined ? "period" : value.punctuation))
}
export function numberMarkerFromScheme(scheme: string, start: number | null): ParagraphMarker {
  const presentation = Object.entries(supportedNumberSchemes).find(([name]) => name === scheme)?.[1]
  if (presentation) return {kind: "number", ...presentation, start}
  if (isRetainedNumberScheme(scheme)) return {kind: "source-number", scheme, start}
  throw new Error("invalid-number-scheme")
}
export function numberMarkerScheme(marker: Extract<ParagraphMarker, {kind: "number" | "source-number"}>): string {
  if (marker.kind === "source-number") return marker.scheme
  const entry = Object.entries(supportedNumberSchemes).find(([, presentation]) => presentation.format === marker.format && ("punctuation" in presentation ? presentation.punctuation : "period") === (marker.punctuation ?? "period"))
  if (!entry) throw new Error("invalid-number-presentation")
  return entry[0]
}
export type NumberMarkerLabel = {kind: "supported"; text: string} | {kind: "unavailable"; reason: "source-scheme" | "counter-range"}
export function numberMarkerLabel(marker: Extract<ParagraphMarker, {kind: "number" | "source-number"}>, value: number): NumberMarkerLabel {
  if (marker.kind === "source-number") return {kind: "unavailable", reason: "source-scheme"}
  if (!Number.isSafeInteger(value) || value < 1 || ((marker.format === "romanLower" || marker.format === "romanUpper") && value > 3999)) return {kind: "unavailable", reason: "counter-range"}
  let text = ""
  switch (marker.format) {
    case "decimal": text = String(value); break
    case "alphaLower": case "alphaUpper": {
      if (value > 26 * 4096) return {kind: "unavailable", reason: "counter-range"}
      text = String.fromCharCode(97 + (value - 1) % 26).repeat(Math.ceil(value / 26))
      if (marker.format === "alphaUpper") text = text.toUpperCase()
      break
    }
    case "romanLower": case "romanUpper": {
      let remaining = value
      for (const [amount, letters] of [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]] satisfies [number,string][]) {
        text += letters.repeat(Math.floor(remaining / amount)); remaining %= amount
      }
      if (marker.format === "romanLower") text = text.toLowerCase()
      break
    }
    default: { const exhaustive: never = marker; return exhaustive }
  }
  const punctuation = marker.punctuation ?? "period"
  switch (punctuation) {
    case "plain": return {kind: "supported", text}
    case "period": return {kind: "supported", text: text + "."}
    case "right-parenthesis": return {kind: "supported", text: text + ")"}
    case "parentheses": return {kind: "supported", text: "(" + text + ")"}
    default: { const exhaustive: never = punctuation; return exhaustive }
  }
}
