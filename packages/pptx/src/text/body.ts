import {SaxesParser} from "saxes"
import {id, type Id} from "../../../deck/src/model.ts"
import type {TextBody, TextStyle, Paragraph, ParagraphMarker} from "../../../deck/src/text/body.ts"
import {numberMarkerFromScheme, numberMarkerScheme} from "../../../deck/src/text/number-marker.ts"
import {parseTextBody} from "../../../deck/src/text/body-codec.ts"
import {escapeXml, type XmlNode} from "../xml.ts"

import {children, child, type Document} from "./nodes.ts"
import {selectiveTextBody} from "./selective.ts"
import {type TextContext, type LocatedNode, resolvedStyle, resolvedColor, emptyContext, assertTextSupported, UnsupportedTextFormat} from "./cascade.ts"

const drawing = "http://schemas.openxmlformats.org/drawingml/2006/main"
function text(document: Document, node: XmlNode): string {
  let result = ""
  const parser = new SaxesParser({xmlns: true})
  parser.on("text", value => { result += value }); parser.on("cdata", value => { result += value })
  parser.write(`<root>${document.xml.slice(node.openEnd, node.closeStart)}</root>`).close()
  return result
}
function number(value: string | undefined, fallback: number): number {
  return value === undefined ? fallback : Number(value)
}
function savedPercentage(value: string | undefined): number | null {
  if (value === undefined) return null
  if (!/^-?\d+(?:\.\d+)?%$/.test(value) && !/^[+-]?\d+$/.test(value.trim())) throw new UnsupportedTextFormat("autofit percentage")
  return value.endsWith("%") ? Number(`${value.slice(0, -1)}e-2`) : Number(`${value.trim()}e-5`)
}
function percentage(value: number): string {
  const [mantissa = "", exponent = "0"] = String(value).split("e")
  const [integer = "", fraction = ""] = mantissa.split(".")
  const digits = integer + fraction, point = integer.length + Number(exponent) + 2
  const decimal = point <= 0 ? `0.${"0".repeat(-point)}${digits}` : point >= digits.length ? digits + "0".repeat(point - digits.length) : `${digits.slice(0, point)}.${digits.slice(point)}`
  return `${decimal.replace(/^0+(?=\d)/, "")}%`
}
function markerValue(document: Document, properties: XmlNode | undefined, inherited: ParagraphMarker, context: TextContext): ParagraphMarker {
  if (!properties) return inherited
  if (child(document, properties, "buNone")) return {kind: "none"}
  const bullet = child(document, properties, "buChar"), numeric = child(document, properties, "buAutoNum")
  if (bullet) {
    const typeface = child(document, properties, "buFont")?.attributes.typeface, font = typeface?.startsWith("+") ? context.fonts[typeface] : typeface
    if (typeface && !font) throw new UnsupportedTextFormat("bullet font")
    return {kind: "bullet", character: bullet.attributes.char ?? "•", ...(font ? {font} : inherited.kind === "bullet" && inherited.font && !child(document, properties, "buFontTx") ? {font: inherited.font} : {})}
  }
  if (numeric) {
    const rawStart = numeric.attributes.startAt?.trim(), start = rawStart === undefined ? null : Number(rawStart)
    if (start !== null && (!/^\+?\d+$/.test(rawStart ?? "") || !Number.isInteger(start) || start < 1 || start > 32767)) throw new UnsupportedTextFormat("numbering")
    try { return numberMarkerFromScheme(numeric.attributes.type ?? "", start) }
    catch { throw new UnsupportedTextFormat("numbering") }
  }
  if (inherited.kind === "bullet") {
    const typeface = child(document, properties, "buFont")?.attributes.typeface
    const font = typeface?.startsWith("+") ? context.fonts[typeface] : typeface
    if (typeface && !font) throw new UnsupportedTextFormat("bullet font")
    if (font) return {...inherited, font}
    if (child(document, properties, "buFontTx")) { return {kind: "bullet", character: inherited.character} }
  }
  return inherited
}
function marker(document: Document, properties: XmlNode, inherited: ParagraphMarker, context: TextContext): ParagraphMarker {
  const value = markerValue(document, properties, inherited, context)
  if (value.kind === "none") return value
  const fill = child(document, properties, "buClr"), percent = child(document, properties, "buSzPct"), points = child(document, properties, "buSzPts")
  const color = fill ? resolvedColor(document, fill, context) : child(document, properties, "buClrTx") ? undefined : inherited.kind === "none" ? undefined : inherited.color
  if (fill && document.nodes.some(node => node.local === "alpha" && node.start > fill.start && node.end < fill.end)) throw new UnsupportedTextFormat("bullet alpha")
  const size = percent ? {kind: "multiple", value: Number(percent.attributes.val) / 100000} satisfies NonNullable<typeof value.size> : points ? {kind: "points", value: Number(points.attributes.val) / 75} satisfies NonNullable<typeof value.size> : child(document, properties, "buSzTx") ? undefined : inherited.kind === "none" ? undefined : inherited.size
  const result = {...value}
  delete result.color
  delete result.size
  return {...result, ...(color ? {color} : {}), ...(size ? {size} : {})}
}
export function readTextBody(document: Document, body: XmlNode, identity: Id, context: TextContext = emptyContext()): TextBody {
  assertTextSupported(document, body, false, true)
  const local = child(document, body, "lstStyle"), lists = [...context.lists]
  if (local && !lists.some(value => value.node === local)) lists.push({document, node: local})
  const frames = [...context.frames], ownFrame = child(document, body, "bodyPr")
  if (ownFrame && !frames.some(value => value.node === ownFrame)) frames.push({document, node: ownFrame})
  for (const layer of [...lists, ...frames]) if (layer.document === document || layer.node.local === "bodyPr") assertTextSupported(layer.document, layer.node, false, true)
  const attributes = frames.reduce<Record<string, string>>((value, layer) => ({...value, ...layer.node.attributes}), {})
  const fit = frames.flatMap(({document, node}) => children(document, node).filter(child => ["normAutofit", "noAutofit", "spAutoFit"].includes(child.local)).map(child => ({document, node: child}))).at(-1)
  const normal = fit?.node.local === "normAutofit" ? fit.node : undefined
  const frame: TextBody["frame"] = {id: id(`${identity}f`), kind: "text-frame", ...(attributes.spcFirstLastPara === undefined ? {} : {spacingAtEdges: ["1", "true"].includes(attributes.spcFirstLastPara)}), ...(attributes.wrap === undefined ? {} : {wrap: attributes.wrap === "none" ? "none" : "square"}), ...(attributes.compatLnSpc === undefined ? {} : {compatibilityLineSpacing: ["1", "true"].includes(attributes.compatLnSpc)}), ...(attributes.vert === undefined ? {} : {verticalFlow: attributes.vert === "vert270" ? "vertical270" : "horizontal"}), anchor: attributes.anchor === "ctr" ? "middle" : attributes.anchor === "b" ? "bottom" : "top", insets: {top: number(attributes.tIns, 45720) / 9525, right: number(attributes.rIns, 91440) / 9525, bottom: number(attributes.bIns, 45720) / 9525, left: number(attributes.lIns, 91440) / 9525}, autofit: normal ? {kind: "shrink", fontScale: savedPercentage(normal.attributes.fontScale), lineReduction: savedPercentage(normal.attributes.lnSpcReduction)} : fit?.node.local === "spAutoFit" ? {kind: "resize-shape"} : {kind: "none"}}
  let inherited: TextStyle = {font: "Aptos", size: 32, bold: false, color: "#171717"}, previousLevel = -1
  if (context.font) {
    const {document, node} = context.font, prefix = node.attributes.idx === "major" ? "+mj-lt" : node.attributes.idx === "minor" ? "+mn-lt" : null
    if (prefix) {
      const font = context.fonts[prefix]
      if (!font) throw new UnsupportedTextFormat()
      inherited = {...inherited, font, ...(children(document, node).length ? {color: resolvedColor(document, node, context)} : {})}
    }
  }
  const base = inherited
  const paragraphs = children(document, body).filter(node => node.local === "p").map((paragraph, index): Paragraph => {
    const properties = child(document, paragraph, "pPr"), level = number(properties?.attributes.lvl, 0)
    const defaults: LocatedNode[] = lists.flatMap(({document, node}) => node.local === "pPr" ? number(node.attributes.lvl, 0) === level ? [{document, node}] : [] : [child(document, node, "defPPr"), child(document, node, `lvl${level + 1}pPr`)].flatMap(node => node ? [{document, node}] : []))
    const layers = [...defaults, ...(properties ? [{document, node: properties}] : [])]
    for (const layer of defaults) assertTextSupported(layer.document, layer.node, true, true)
    let initial = level === previousLevel && !defaults.length && !children(document, paragraph).some(node => node.local === "r") ? inherited : base
    for (const {document, node} of layers) {
      const properties = child(document, node, "defRPr")
      initial = resolvedStyle(properties ? {document, node: properties} : undefined, initial, context)
    }
    const runs: Paragraph["runs"] = []
    let last = initial
    for (const run of children(document, paragraph)) {
      const properties = child(document, run, "rPr")
      if (run.local === "br") { last = resolvedStyle(properties ? {document, node: properties} : undefined, last, context); runs.push({kind: "break", style: last}) }
      if (run.local === "r" || run.local === "fld") {
        last = resolvedStyle(properties ? {document, node: properties} : undefined, initial, context)
        for (const value of children(document, run).filter(node => node.local === "t")) {
          const content = text(document, value)
          if ([...layers, ...(properties ? [{document, node: properties}] : [])].some(layer => layer.document.nodes.some(node => node.start > layer.node.start && node.end < layer.node.end && ["ea", "cs"].includes(node.local) && node.attributes.typeface)) && Array.from(content).some(character => { const point = character.codePointAt(0)!; return !(last.symbolFont && point >= 0xf000 && point <= 0xf0ff) && point > 0x024f && (point < 0x2000 || point > 0x206f) && (point < 0x20a0 || point > 0x22ff) })) throw new UnsupportedTextFormat("script-specific font projection")
          runs.push({kind: "text", text: content, style: last})
        }
      }
    }
    const end = child(document, paragraph, "endParaRPr"), endStyle = resolvedStyle(end ? {document, node: end} : undefined, last, context)
    inherited = endStyle; previousLevel = level
    const attribute = (name: string) => layers.map(value => value.node.attributes[name]).findLast(value => value !== undefined)
    const property = (name: string) => layers.flatMap(({document, node}) => {const found = child(document, node, name); return found ? [{document, node: found}] : []}).at(-1)
    const alignment = attribute("algn"), line = property("lnSpc"), percent = line && child(line.document, line.node, "spcPct"), points = line && child(line.document, line.node, "spcPts")
    const pointSpace = (name: string) => { const value = property(name), points = value && child(value.document, value.node, "spcPts"), percent = value && child(value.document, value.node, "spcPct"); return points ? Number(points.attributes.val) / 75 : percent && Number(percent.attributes.val) !== 0 ? {kind: "multiple", value: Number(percent.attributes.val) / 100000} satisfies Paragraph["spacing"]["before"] : 0 }
    const glyph = attribute("fontAlgn")
    return {id: id(`${identity}p${index}`), kind: "paragraph", runs, endStyle, ...(attribute("defTabSz") === undefined ? {} : {tabSize: Number(attribute("defTabSz")) / 9525}), ...(glyph === undefined ? {} : {glyphAlignment: glyph === "t" ? "top" : glyph === "ctr" ? "center" : glyph === "b" ? "bottom" : "baseline"}), alignment: alignment === "ctr" ? "center" : alignment === "r" ? "right" : alignment === "just" ? "justify" : "left", level, indentation: {left: number(attribute("marL"), 0) / 9525, right: number(attribute("marR"), 0) / 9525, firstLine: number(attribute("indent"), 0) / 9525}, marker: layers.reduce<ParagraphMarker>((value, layer) => marker(layer.document, layer.node, value, context), {kind: "none"} satisfies ParagraphMarker), spacing: {before: pointSpace("spcBef"), after: pointSpace("spcAft"), line: points ? {kind: "points", value: Number(points.attributes.val) / 75} : {kind: "multiple", value: percent ? Number(percent.attributes.val) / 100000 : 1.2}}}
  })
  return parseTextBody({frame, paragraphs})
}
function shadowXml(style: TextStyle): string {
  const value = style.outerShadow
  return value ? `<a:effectLst><a:outerShdw blurRad="${Math.round(value.blur * 9525)}" dist="${Math.round(value.distance * 9525)}" dir="${Math.round(value.direction * 60000)}" sx="${Math.round(value.scale.x * 100000)}" sy="${Math.round(value.scale.y * 100000)}" kx="${Math.round(value.skew.x * 60000)}" ky="${Math.round(value.skew.y * 60000)}" algn="${value.alignment}" rotWithShape="${value.rotateWithShape ? 1 : 0}"><a:srgbClr val="${value.color.slice(1)}"><a:alpha val="${Math.round(value.opacity * 100000)}"/></a:srgbClr></a:outerShdw></a:effectLst>` : ""
}
function propertiesXml(value: TextStyle, tag: string): string {
  const style: TextStyle = tag === "endParaRPr" ? {letterSpacing: 0, baseline: 0, kerning: 0, strike: false, capitalization: "none", ...value} : value
  if (style.color !== null && !/^#[0-9a-f]{6}$/i.test(style.color)) throw new Error("pptx-text-color-required")
  const extra = `${style.letterSpacing === undefined ? "" : ` spc="${Math.round(style.letterSpacing * 75)}"`}${style.baseline === undefined ? "" : ` baseline="${Math.round(style.baseline * 100000)}"`}${style.kerning === undefined ? "" : ` kern="${Math.round(style.kerning * 75)}"`}${style.strike === undefined ? "" : ` strike="${style.strike ? "sngStrike" : "noStrike"}"`}${style.capitalization === undefined ? "" : ` cap="${style.capitalization}"`}`
  return `<a:${tag}${extra} sz="${Math.round(style.size * 75)}" b="${style.bold ? 1 : 0}" i="${style.italic ? 1 : 0}" u="${style.underline ? "sng" : "none"}">${style.color === null ? "<a:noFill/>" : `<a:solidFill><a:srgbClr val="${style.color.slice(1)}">${style.opacity === undefined ? "" : `<a:alpha val="${Math.round(style.opacity * 100000)}"/>`}</a:srgbClr></a:solidFill>`}${shadowXml(style)}${style.highlight ? `<a:highlight><a:srgbClr val="${style.highlight.slice(1)}"/></a:highlight>` : ""}<a:latin typeface="${escapeXml(style.font)}"/>${style.symbolFont ? `<a:sym typeface="${escapeXml(style.symbolFont)}"/>` : ""}</a:${tag}>`
}
export function writeTextBody(body: TextBody): string {
  const frame = body.frame, autofit = frame.autofit
  const fit = autofit.kind === "shrink" ? `<a:normAutofit${autofit.fontScale === null ? "" : ` fontScale="${percentage(autofit.fontScale)}"`}${autofit.lineReduction === null ? "" : ` lnSpcReduction="${percentage(autofit.lineReduction)}"`}/>` : autofit.kind === "resize-shape" ? "<a:spAutoFit/>" : "<a:noAutofit/>"
  const space = (value: Paragraph["spacing"]["before"]) => typeof value === "number" ? `<a:spcPts val="${Math.round(value * 75)}"/>` : `<a:spcPct val="${Math.round(value.value * 100000)}"/>`
  const paragraphs = body.paragraphs.map(paragraph => {
    const marker = paragraph.marker, line = paragraph.spacing.line
    const presentation = marker.kind === "none" ? "" : `${marker.color ? `<a:buClr><a:srgbClr val="${marker.color.slice(1)}"/></a:buClr>` : ""}${marker.size ? `<a:buSz${marker.size.kind === "multiple" ? "Pct" : "Pts"} val="${Math.round(marker.size.value * (marker.size.kind === "multiple" ? 100000 : 75))}"/>` : ""}`
    const bullet = marker.kind === "none" ? "<a:buNone/>" : marker.kind === "bullet" ? `${marker.font ? `<a:buFont typeface="${escapeXml(marker.font)}"/>` : ""}<a:buChar char="${escapeXml(marker.character)}"/>` : `<a:buAutoNum type="${numberMarkerScheme(marker)}"${marker.start === null ? "" : ` startAt="${marker.start}"`}/>`
    const alignment = {left: "l", center: "ctr", right: "r", justify: "just"}[paragraph.alignment]
    const properties = `<a:pPr${paragraph.tabSize === undefined ? "" : ` defTabSz="${Math.round(paragraph.tabSize * 9525)}"`}${paragraph.glyphAlignment === undefined ? "" : ` fontAlgn="${{baseline: "base", top: "t", center: "ctr", bottom: "b"}[paragraph.glyphAlignment]}"`} algn="${alignment}" lvl="${paragraph.level}" marL="${Math.round(paragraph.indentation.left * 9525)}" marR="${Math.round(paragraph.indentation.right * 9525)}" indent="${Math.round(paragraph.indentation.firstLine * 9525)}"><a:lnSpc><a:${line.kind === "multiple" ? "spcPct" : "spcPts"} val="${Math.round(line.value * (line.kind === "multiple" ? 100000 : 75))}"/></a:lnSpc><a:spcBef>${space(paragraph.spacing.before)}</a:spcBef><a:spcAft>${space(paragraph.spacing.after)}</a:spcAft>${presentation}${bullet}</a:pPr>`
    return `<a:p>${properties}${paragraph.runs.map(run => run.kind === "break" ? `<a:br>${propertiesXml(run.style, "rPr")}</a:br>` : `<a:r>${propertiesXml(run.style, "rPr")}<a:t xml:space="preserve">${escapeXml(run.text)}</a:t></a:r>`).join("")}${propertiesXml(paragraph.endStyle, "endParaRPr")}</a:p>`
  }).join("")
  return `<p:txBody xmlns:a="${drawing}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><a:bodyPr${frame.spacingAtEdges === undefined ? "" : ` spcFirstLastPara="${frame.spacingAtEdges ? 1 : 0}"`}${frame.wrap === undefined ? "" : ` wrap="${frame.wrap}"`}${frame.compatibilityLineSpacing === undefined ? "" : ` compatLnSpc="${frame.compatibilityLineSpacing ? 1 : 0}"`}${frame.verticalFlow === undefined ? "" : ` vert="${frame.verticalFlow === "vertical270" ? "vert270" : "horz"}"`} anchor="${frame.anchor === "middle" ? "ctr" : frame.anchor === "bottom" ? "b" : "t"}" lIns="${Math.round(frame.insets.left * 9525)}" rIns="${Math.round(frame.insets.right * 9525)}" tIns="${Math.round(frame.insets.top * 9525)}" bIns="${Math.round(frame.insets.bottom * 9525)}">${fit}</a:bodyPr><a:lstStyle/>${paragraphs}</p:txBody>`
}
export function replaceTextBody(document: Document, node: XmlNode, body: TextBody, previous?: TextBody): string {
  if (previous) {
    const selective = selectiveTextBody(document, node, previous, body, writeTextBody(previous), writeTextBody(body))
    if (selective !== undefined) return selective
  }
  assertTextSupported(document, node)
  return document.xml.slice(0, node.start) + writeTextBody(body) + document.xml.slice(node.end)
}
