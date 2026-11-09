import {paragraphNumbers} from "../../../deck/src/text/numbering.ts"
import type {CSSProperties} from "react"
import type {TextBody, TextStyle, NumberFormat, ParagraphSpace} from "../../../deck/src/text/body.ts"
import {fontFamily} from "../fonts.ts"

function style(value: TextStyle, scale: number, inline = true): CSSProperties {
  return {fontFamily: fontFamily(value.font), fontSize: value.size * scale, fontWeight: value.bold ? 600 : 400, fontStyle: value.italic ? "italic" : "normal", textDecoration: [value.underline ? "underline" : "", value.strike ? "line-through" : ""].filter(Boolean).join(" ") || "none", letterSpacing: (value.letterSpacing ?? 0) * scale, position: inline && value.baseline ? "relative" : undefined, top: inline ? -(value.baseline ?? 0) * value.size * scale : undefined, fontVariantCaps: value.capitalization === "small" ? "small-caps" : "normal", textTransform: value.capitalization === "all" ? "uppercase" : "none", fontKerning: value.kerning === undefined ? "auto" : value.size >= value.kerning ? "normal" : "none", backgroundColor: value.highlight, color: value.color, opacity: inline ? value.opacity : undefined}
}
function numeral(value: number, format: NumberFormat): string {
  if (format === "decimal") return String(value)
  if (format === "alphaLower" || format === "alphaUpper") {
    let text = "", remaining = value
    while (remaining > 0) { remaining--; text = String.fromCharCode(97 + remaining % 26) + text; remaining = Math.floor(remaining / 26) }
    return format === "alphaUpper" ? text.toUpperCase() : text
  }
  if (value > 3999) return String(value)
  let remaining = value, text = ""
  for (const [amount, letters] of [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]] satisfies [number,string][]) {
    const count = Math.floor(remaining / amount)
    text += letters.repeat(count); remaining %= amount
  }
  return format === "romanLower" ? text.toLowerCase() : text
}
function paragraphSpace(value: ParagraphSpace, line: number): number { return typeof value === "number" ? value : value.value * line }
export function Body({body}: {body: TextBody}) {
  const frame = body.frame, scale = frame.autofit.kind === "shrink" ? frame.autofit.fontScale : 1
  const reduction = frame.autofit.kind === "shrink" ? 1 - frame.autofit.lineReduction : 1
  const numbers = paragraphNumbers(body.paragraphs)
  return <div data-text-frame={frame.id} style={{writingMode: frame.verticalFlow === "vertical270" ? "sideways-lr" : "horizontal-tb", display: "flex", flexDirection: "column", justifyContent: frame.anchor === "top" ? "flex-start" : frame.anchor === "middle" ? "center" : "flex-end", boxSizing: "border-box", width: "100%", height: "100%", padding: `${frame.insets.top}px ${frame.insets.right}px ${frame.insets.bottom}px ${frame.insets.left}px`}}>
    <div data-text="" style={{flex: "0 0 auto", minWidth: 0, whiteSpace: frame.wrap === "none" ? "pre" : "pre-wrap", overflowWrap: "break-word"}}>{body.paragraphs.map((paragraph, index) => {
      const marker = paragraph.marker
      const maximumSize = Math.max(paragraph.endStyle.size, ...paragraph.runs.map(run => run.style.size)) * scale
      const line = paragraph.spacing.line.kind === "multiple" ? paragraph.spacing.line.value * maximumSize * reduction : paragraph.spacing.line.value * scale * reduction
      const glyphAlignment = paragraph.glyphAlignment === "top" ? "text-top" : paragraph.glyphAlignment === "center" ? "middle" : paragraph.glyphAlignment === "bottom" ? "text-bottom" : "baseline"
      let label = ""
      if (marker.kind === "bullet") label = marker.character
      if (marker.kind === "number") {
        label = `${numeral(numbers[index]!, marker.format)}.`
      }
      return <div key={paragraph.id} data-paragraph={paragraph.id} data-level={paragraph.level} style={{...style(paragraph.endStyle, scale, false), position: "relative", textAlign: paragraph.alignment, tabSize: `${(paragraph.tabSize ?? 96) * scale}px`, marginTop: index === 0 && !frame.spacingAtEdges ? 0 : paragraphSpace(paragraph.spacing.before, line), marginBottom: index === body.paragraphs.length - 1 && !frame.spacingAtEdges ? 0 : paragraphSpace(paragraph.spacing.after, line), paddingLeft: paragraph.indentation.left, paddingRight: paragraph.indentation.right, textIndent: paragraph.indentation.firstLine, lineHeight: paragraph.spacing.line.kind === "multiple" ? frame.compatibilityLineSpacing ? `${line}px` : paragraph.spacing.line.value * reduction : `${paragraph.spacing.line.value * scale * reduction}px`, minHeight: `${paragraph.endStyle.size * scale}px`}}>
        {label && <span data-marker="" aria-hidden="true" style={{display: "inline-block", textIndent: 0, marginRight: "0.3em", color: marker.kind === "none" ? undefined : marker.color, fontSize: marker.kind === "none" || !marker.size ? undefined : marker.size.kind === "multiple" ? `${marker.size.value}em` : marker.size.value * scale, fontFamily: marker.kind === "bullet" && marker.font ? fontFamily(marker.font) : undefined}}>{label}</span>}
        {paragraph.runs.map((run, index) => run.kind === "break" ? <br key={index}/> : <span key={index} style={{...style(run.style, scale), verticalAlign: glyphAlignment}}>{run.style.symbolFont ? Array.from(run.text).map((character, index) => <span key={index} style={{fontFamily: character.codePointAt(0)! >= 0xf000 && character.codePointAt(0)! <= 0xf0ff ? fontFamily(run.style.symbolFont!) : undefined}}>{character}</span>) : run.text}</span>)}
        {(paragraph.runs.length === 0 || paragraph.runs.at(-1)?.kind === "break") && <br data-paragraph-end=""/>}
      </div>
    })}</div>
  </div>
}
