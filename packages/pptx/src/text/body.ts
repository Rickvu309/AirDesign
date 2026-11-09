import {SaxesParser} from "saxes"
import {id, type Id} from "../../../deck/src/model.ts"
import type {TextBody, TextStyle, Paragraph, ParagraphMarker, NumberFormat} from "../../../deck/src/text/body.ts"
import {parseTextBody} from "../../../deck/src/text/body-codec.ts"
import {escapeXml, type XmlNode} from "../xml.ts"

import {children, child, type Document} from "./nodes.ts"
import {type TextContext, type LocatedNode, resolvedStyle, resolvedColor, emptyContext, assertTextSupported, UnsupportedTextFormat} from "./cascade.ts"

const drawing = "http://schemas.openxmlformats.org/drawingml/2006/main"
const numbering = {decimal: "arabicPeriod", alphaLower: "alphaLcPeriod", alphaUpper: "alphaUcPeriod", romanLower: "romanLcPeriod", romanUpper: "romanUcPeriod"} satisfies Record<NumberFormat, string>
function text(document: Document, node: XmlNode): string {
  let result = ""
  const parser = new SaxesParser({xmlns: true})
  parser.on("text", value => { result += value }); parser.on("cdata", value => { result += value })
  parser.write(`<root>${document.xml.slice(node.openEnd, node.closeStart)}</root>`).close()
  if (/\t/.test(result)) throw new UnsupportedTextFormat("tab")
  return result
}
function number(value: string | undefined, fallback: number): number {
  return value === undefined ? fallback : Number(value)
}
function marker(document: Document, properties: XmlNode | undefined, inherited: ParagraphMarker): ParagraphMarker {
  if (!properties) return inherited
  if (child(document, properties, "buNone")) return {kind: "none"}
  const bullet = child(document, properties, "buChar"), numeric = child(document, properties, "buAutoNum")
  if (bullet) return {kind: "bullet", character: bullet.attributes.char ?? "•"}
  if (numeric) {
    const entry = Object.entries(numbering).find(([, value]) => value === numeric.attributes.type)
    if (!entry) throw new UnsupportedTextFormat("numbering")
    const format = entry[0]
    if (format !== "decimal" && format !== "alphaLower" && format !== "alphaUpper" && format !== "romanLower" && format !== "romanUpper") throw new UnsupportedTextFormat("numbering")
    return {kind: "number", format, start: numeric.attributes.startAt === undefined ? null : Number(numeric.attributes.startAt)}
  }
  return inherited
}
export function readTextBody(document: Document, body: XmlNode, identity: Id, context: TextContext = emptyContext()): TextBody {
  assertTextSupported(document, body)
  const local = child(document, body, "lstStyle"), lists = [...context.lists]
  if (local && !lists.some(value => value.node === local)) lists.push({document, node: local})
  const frames = [...context.frames], ownFrame = child(document, body, "bodyPr")
  if (ownFrame && !frames.some(value => value.node === ownFrame)) frames.push({document, node: ownFrame})
  for (const layer of [...lists, ...frames]) if (layer.document === document || layer.node.local === "bodyPr") assertTextSupported(layer.document, layer.node)
  const attributes = frames.reduce<Record<string, string>>((value, layer) => ({...value, ...layer.node.attributes}), {})
  const fit = frames.flatMap(({document, node}) => children(document, node).map(child => ({document, node: child}))).at(-1)
  const normal = fit?.node.local === "normAutofit" ? fit.node : undefined
  const frame: TextBody["frame"] = {id: id(`${identity}f`), kind: "text-frame", anchor: attributes.anchor === "ctr" ? "middle" : attributes.anchor === "b" ? "bottom" : "top", insets: {top: number(attributes.tIns, 45720) / 9525, right: number(attributes.rIns, 91440) / 9525, bottom: number(attributes.bIns, 45720) / 9525, left: number(attributes.lIns, 91440) / 9525}, autofit: normal ? {kind: "shrink", fontScale: number(normal.attributes.fontScale, 100000) / 100000, lineReduction: number(normal.attributes.lnSpcReduction, 0) / 100000} : fit?.node.local === "spAutoFit" ? {kind: "resize-shape"} : {kind: "none"}}
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
    for (const layer of defaults) assertTextSupported(layer.document, layer.node, true)
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
      if (run.local === "r") {
        last = resolvedStyle(properties ? {document, node: properties} : undefined, initial, context)
        for (const value of children(document, run).filter(node => node.local === "t")) runs.push({kind: "text", text: text(document, value), style: last})
      }
    }
    const end = child(document, paragraph, "endParaRPr"), endStyle = resolvedStyle(end ? {document, node: end} : undefined, last, context)
    inherited = endStyle; previousLevel = level
    const attribute = (name: string) => layers.map(value => value.node.attributes[name]).findLast(value => value !== undefined)
    const property = (name: string) => layers.flatMap(({document, node}) => {const found = child(document, node, name); return found ? [{document, node: found}] : []}).at(-1)
    const alignment = attribute("algn"), line = property("lnSpc"), percent = line && child(line.document, line.node, "spcPct"), points = line && child(line.document, line.node, "spcPts")
    const pointSpace = (name: string) => {const value = property(name), points = value && child(value.document, value.node, "spcPts"); if (value && !points) throw new UnsupportedTextFormat(); return points ? Number(points.attributes.val) / 75 : 0}
    return {id: id(`${identity}p${index}`), kind: "paragraph", runs, endStyle, alignment: alignment === "ctr" ? "center" : alignment === "r" ? "right" : alignment === "just" ? "justify" : "left", level, indentation: {left: number(attribute("marL"), 0) / 9525, right: number(attribute("marR"), 0) / 9525, firstLine: number(attribute("indent"), 0) / 9525}, marker: layers.reduce<ParagraphMarker>((value, layer) => marker(layer.document, layer.node, value), {kind: "none"} satisfies ParagraphMarker), spacing: {before: pointSpace("spcBef"), after: pointSpace("spcAft"), line: points ? {kind: "points", value: Number(points.attributes.val) / 75} : {kind: "multiple", value: percent ? Number(percent.attributes.val) / 100000 : 1.2}}}
  })
  return parseTextBody({frame, paragraphs})
}
function propertiesXml(style: TextStyle, tag: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(style.color)) throw new Error("pptx-text-color-required")
  return `<a:${tag} sz="${Math.round(style.size * 75)}" b="${style.bold ? 1 : 0}" i="${style.italic ? 1 : 0}" u="${style.underline ? "sng" : "none"}"><a:solidFill><a:srgbClr val="${style.color.slice(1)}"/></a:solidFill><a:latin typeface="${escapeXml(style.font)}"/></a:${tag}>`
}
export function writeTextBody(body: TextBody): string {
  const frame = body.frame, autofit = frame.autofit
  const fit = autofit.kind === "shrink" ? `<a:normAutofit fontScale="${Math.round(autofit.fontScale * 100000)}" lnSpcReduction="${Math.round(autofit.lineReduction * 100000)}"/>` : autofit.kind === "resize-shape" ? "<a:spAutoFit/>" : "<a:noAutofit/>"
  const paragraphs = body.paragraphs.map(paragraph => {
    const marker = paragraph.marker, line = paragraph.spacing.line
    const bullet = marker.kind === "none" ? "<a:buNone/>" : marker.kind === "bullet" ? `<a:buChar char="${escapeXml(marker.character)}"/>` : `<a:buAutoNum type="${numbering[marker.format]}"${marker.start === null ? "" : ` startAt="${marker.start}"`}/>`
    const alignment = {left: "l", center: "ctr", right: "r", justify: "just"}[paragraph.alignment]
    const properties = `<a:pPr algn="${alignment}" lvl="${paragraph.level}" marL="${Math.round(paragraph.indentation.left * 9525)}" marR="${Math.round(paragraph.indentation.right * 9525)}" indent="${Math.round(paragraph.indentation.firstLine * 9525)}"><a:lnSpc><a:${line.kind === "multiple" ? "spcPct" : "spcPts"} val="${Math.round(line.value * (line.kind === "multiple" ? 100000 : 75))}"/></a:lnSpc><a:spcBef><a:spcPts val="${Math.round(paragraph.spacing.before * 75)}"/></a:spcBef><a:spcAft><a:spcPts val="${Math.round(paragraph.spacing.after * 75)}"/></a:spcAft>${bullet}</a:pPr>`
    return `<a:p>${properties}${paragraph.runs.map(run => run.kind === "break" ? `<a:br>${propertiesXml(run.style, "rPr")}</a:br>` : `<a:r>${propertiesXml(run.style, "rPr")}<a:t xml:space="preserve">${escapeXml(run.text)}</a:t></a:r>`).join("")}${propertiesXml(paragraph.endStyle, "endParaRPr")}</a:p>`
  }).join("")
  return `<p:txBody xmlns:a="${drawing}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><a:bodyPr anchor="${frame.anchor === "middle" ? "ctr" : frame.anchor === "bottom" ? "b" : "t"}" lIns="${Math.round(frame.insets.left * 9525)}" rIns="${Math.round(frame.insets.right * 9525)}" tIns="${Math.round(frame.insets.top * 9525)}" bIns="${Math.round(frame.insets.bottom * 9525)}">${fit}</a:bodyPr><a:lstStyle/>${paragraphs}</p:txBody>`
}
export function replaceTextBody(document: Document, node: XmlNode, body: TextBody): string {
  assertTextSupported(document, node)
  return document.xml.slice(0, node.start) + writeTextBody(body) + document.xml.slice(node.end)
}
