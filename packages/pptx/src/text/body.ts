import {SaxesParser} from "saxes"
import {id, type Id} from "../../../deck/src/model.ts"
import type {TextBody, TextStyle, Paragraph, ParagraphMarker, NumberFormat} from "../../../deck/src/text/body.ts"
import {parseTextBody} from "../../../deck/src/text/body-codec.ts"
import {parseXml, escapeXml, type XmlNode} from "../xml.ts"

const drawing = "http://schemas.openxmlformats.org/drawingml/2006/main"
const numbering = {decimal: "arabicPeriod", alphaLower: "alphaLcPeriod", alphaUpper: "alphaUcPeriod", romanLower: "romanLcPeriod", romanUpper: "romanUcPeriod"} satisfies Record<NumberFormat, string>
type Document = ReturnType<typeof parseXml>
const childIndexes = new WeakMap<Document, Map<XmlNode, XmlNode[]>>()
function children(document: Document, parent: XmlNode): XmlNode[] {
  let index = childIndexes.get(document)
  if (!index) {
    index = new Map()
    const stack: XmlNode[] = []
    for (const node of document.nodes) {
      while (stack.length && stack.at(-1)!.end <= node.start) stack.pop()
      const owner = stack.at(-1)
      if (owner) { const siblings = index.get(owner) ?? []; siblings.push(node); index.set(owner, siblings) }
      stack.push(node)
    }
    childIndexes.set(document, index)
  }
  return index.get(parent) ?? []
}
function child(document: Document, parent: XmlNode | undefined, local: string): XmlNode | undefined {
  return parent && children(document, parent).find(node => node.local === local)
}
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
function style(document: Document, properties: XmlNode | undefined, inherited: TextStyle): TextStyle {
  if (!properties) return inherited
  const attributes = properties.attributes, latin = child(document, properties, "latin"), fill = child(document, properties, "solidFill"), color = child(document, fill, "srgbClr")
  return {...inherited, font: latin?.attributes.typeface ?? inherited.font, size: number(attributes.sz, inherited.size * 75) / 75, bold: attributes.b === undefined ? inherited.bold : attributes.b === "1", ...(attributes.i === undefined ? {} : {italic: attributes.i === "1"}), ...(attributes.u === undefined ? {} : {underline: attributes.u !== "none"}), color: color?.attributes.val ? `#${color.attributes.val}` : inherited.color}
}
function marker(document: Document, properties: XmlNode | undefined, inherited: ParagraphMarker): ParagraphMarker {
  if (!properties) return inherited
  if (child(document, properties, "buNone")) return {kind: "none"}
  const bullet = child(document, properties, "buChar"), numeric = child(document, properties, "buAutoNum")
  if (bullet) return {kind: "bullet", character: bullet.attributes.char ?? "•"}
  if (numeric) {
    const entry = Object.entries(numbering).find(([, value]) => value === numeric.attributes.type)
    if (!entry) throw new Error("unsupported-pptx-numbering-format")
    const format = entry[0]
    if (format !== "decimal" && format !== "alphaLower" && format !== "alphaUpper" && format !== "romanLower" && format !== "romanUpper") throw new Error("unsupported-pptx-numbering-format")
    return {kind: "number", format, start: numeric.attributes.startAt === undefined ? null : Number(numeric.attributes.startAt)}
  }
  return inherited
}
function spacing(document: Document, properties: XmlNode | undefined, name: string, fallback: number): number {
  const value = child(document, child(document, properties, name), "spcPts")
  return value ? Number(value.attributes.val) / 75 : fallback
}
export function readTextBody(document: Document, body: XmlNode, identity: Id): TextBody {
  const properties = child(document, body, "bodyPr"), attributes = properties?.attributes ?? {}, normal = child(document, properties, "normAutofit")
  const frame: TextBody["frame"] = {id: id(`${identity}f`), kind: "text-frame", anchor: attributes.anchor === "ctr" ? "middle" : attributes.anchor === "b" ? "bottom" : "top", insets: {top: number(attributes.tIns, 45720) / 9525, right: number(attributes.rIns, 91440) / 9525, bottom: number(attributes.bIns, 45720) / 9525, left: number(attributes.lIns, 91440) / 9525}, autofit: normal ? {kind: "shrink", fontScale: number(normal.attributes.fontScale, 100000) / 100000, lineReduction: number(normal.attributes.lnSpcReduction, 0) / 100000} : child(document, properties, "spAutoFit") ? {kind: "resize-shape"} : {kind: "none"}}
  let inherited: TextStyle = {font: "Aptos", size: 32, bold: false, color: "#171717"}
  const paragraphs = children(document, body).filter(node => node.local === "p").map((paragraph, index): Paragraph => {
    const properties = child(document, paragraph, "pPr"), level = number(properties?.attributes.lvl, 0), defaults = child(document, child(document, body, "lstStyle"), `lvl${level + 1}pPr`)
    const baseline = style(document, child(document, defaults, "defRPr"), inherited), initial = style(document, child(document, properties, "defRPr"), baseline)
    const runs: Paragraph["runs"] = []
    let last = initial
    for (const run of children(document, paragraph)) {
      if (run.local === "br") { last = style(document, child(document, run, "rPr"), last); runs.push({kind: "break", style: last}) }
      if (run.local === "r" || run.local === "fld") {
        last = style(document, child(document, run, "rPr"), initial)
        for (const value of children(document, run).filter(node => node.local === "t")) runs.push({kind: "text", text: text(document, value), style: last})
      }
    }
    const endStyle = style(document, child(document, paragraph, "endParaRPr"), last)
    inherited = endStyle
    const attribute = (name: string) => properties?.attributes[name] ?? defaults?.attributes[name]
    const alignment = attribute("algn"), line = child(document, properties, "lnSpc") ?? child(document, defaults, "lnSpc"), percent = child(document, line, "spcPct"), points = child(document, line, "spcPts")
    return {id: id(`${identity}p${index}`), kind: "paragraph", runs, endStyle, alignment: alignment === "ctr" ? "center" : alignment === "r" ? "right" : alignment === "just" ? "justify" : "left", level, indentation: {left: number(attribute("marL"), 0) / 9525, right: number(attribute("marR"), 0) / 9525, firstLine: number(attribute("indent"), 0) / 9525}, marker: marker(document, properties, marker(document, defaults, {kind: "none"})), spacing: {before: spacing(document, properties, "spcBef", spacing(document, defaults, "spcBef", 0)), after: spacing(document, properties, "spcAft", spacing(document, defaults, "spcAft", 0)), line: points ? {kind: "points", value: Number(points.attributes.val) / 75} : {kind: "multiple", value: percent ? Number(percent.attributes.val) / 100000 : 1.2}}}
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
  const attributes: Record<string, string[]> = {txBody: [], bodyPr: ["anchor", "lIns", "rIns", "tIns", "bIns"], noAutofit: [], normAutofit: ["fontScale", "lnSpcReduction"], spAutoFit: [], lstStyle: [], p: [], pPr: ["algn", "lvl", "marL", "marR", "indent"], lnSpc: [], spcPct: ["val"], spcPts: ["val"], spcBef: [], spcAft: [], buNone: [], buChar: ["char"], buAutoNum: ["type", "startAt"], r: [], br: [], t: ["xml:space"], rPr: ["sz", "b", "i", "u"], endParaRPr: ["sz", "b", "i", "u"], defRPr: ["sz", "b", "i", "u"], solidFill: [], srgbClr: ["val"], latin: ["typeface"]}
  for (const child of document.nodes.filter(child => child.start >= node.start && child.end <= node.end)) {
    const known = attributes[child.local]
    if ((child.uri !== drawing && !(child.local === "txBody" && child.uri === "http://schemas.openxmlformats.org/presentationml/2006/main")) || !known || Object.keys(child.attributes).some(name => !name.startsWith("xmlns") && !known.includes(name))) throw new Error("source-text-format-preservation-required")
    if (child.local === "lstStyle" && children(document, child).length) throw new Error("source-text-format-preservation-required")
  }
  return document.xml.slice(0, node.start) + writeTextBody(body) + document.xml.slice(node.end)
}
