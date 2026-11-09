import type {TextStyle} from "../../../deck/src/text/body.ts"
import type {Presentation} from "../index.ts"
import {parseXml, type XmlNode} from "../xml.ts"
import {children, child, type Document} from "./nodes.ts"

export type LocatedNode = {document: Document; node: XmlNode}
export type TextContext = {lists: LocatedNode[]; frames: LocatedNode[]; font: LocatedNode | null; colors: Record<string, string>; mapping: Record<string, string>; fonts: Record<string, string>}
export class UnsupportedTextFormat extends Error {
  constructor(detail = "unsupported text") { super(`source-text-format-preservation-required: ${detail}`) }
}
export function emptyContext(): TextContext { return {lists: [], frames: [], font: null, colors: {}, mapping: {}, fonts: {}} }
function located(document: Document | undefined, node: XmlNode | undefined): LocatedNode[] { return document && node ? [{document, node}] : [] }
function descendant(document: Document, node: XmlNode | undefined, local: string): XmlNode | undefined {
  return node && document.nodes.find(candidate => candidate.start > node.start && candidate.end < node.end && candidate.local === local)
}
function placeholder(document: Document, shape: XmlNode): XmlNode | undefined { return descendant(document, shape, "ph") }
const documents = new WeakMap<Presentation, Map<string, Document>>()
export function textContext(source: Presentation, part: string, document: Document, shape: XmlNode): TextContext {
  const context = emptyContext()
  const cached = documents.get(source) ?? new Map<string, Document>()
  documents.set(source, cached)
  const read = (name: string | undefined) => {
    if (!name) return undefined
    const prior = cached.get(name)
    if (prior) return prior
    const bytes = source.parts.get(name)
    if (!bytes) return undefined
    const parsed = parseXml(bytes)
    cached.set(name, parsed)
    return parsed
  }
  const related = (name: string | undefined, type: string) => source.report.relationships.find(relation => relation.part === name && relation.type.endsWith(`/${type}`))?.target
  const layoutPart = related(part, "slideLayout"), masterPart = related(layoutPart, "slideMaster")
  if ([part, layoutPart, masterPart].some(name => related(name, "themeOverride"))) throw new UnsupportedTextFormat("theme override")
  const layout = read(layoutPart), master = read(masterPart), theme = read(related(masterPart, "theme"))
  if (theme) {
    const scheme = theme.nodes.find(node => node.local === "clrScheme")
    if (scheme) for (const entry of children(theme, scheme)) {
      const value = children(theme, entry)[0]
      if (value?.local === "srgbClr" && value.attributes.val) context.colors[entry.local] = value.attributes.val
      if (value?.local === "sysClr" && value.attributes.lastClr) context.colors[entry.local] = value.attributes.lastClr
    }
    for (const {name, prefix} of [{name: "majorFont", prefix: "+mj"}, {name: "minorFont", prefix: "+mn"}]) {
      const family = theme.nodes.find(node => node.local === name)
      for (const {kind, suffix} of [{kind: "latin", suffix: "lt"}, {kind: "ea", suffix: "ea"}, {kind: "cs", suffix: "cs"}]) {
        const value = child(theme, family, kind)?.attributes.typeface
        if (value) context.fonts[`${prefix}-${suffix}`] = value
      }
    }
  }
  if (master) context.mapping = {...master.nodes.find(node => node.local === "clrMap")?.attributes}
  const masterMapping = {...context.mapping}
  for (const doc of [layout, document]) {
    const override = doc?.nodes.find(node => node.local === "overrideClrMapping")
    if (override) context.mapping = {...override.attributes}
    else if (doc?.nodes.some(node => node.local === "masterClrMapping")) context.mapping = {...masterMapping}
  }
  const ph = placeholder(document, shape)
  const match = (doc: Document | undefined, byIndex: boolean, reference: XmlNode | undefined) => doc?.nodes.find(node => {
    if (node.local !== "sp") return false
    const candidate = placeholder(doc, node)
    if (!candidate || !reference) return false
    return byIndex ? (candidate.attributes.idx ?? "0") === (reference.attributes.idx ?? "0") : (candidate.attributes.type ?? "obj") === (reference.attributes.type === "ctrTitle" ? "title" : reference.attributes.type ?? "obj")
  })
  const layoutShape = match(layout, true, ph), masterShape = match(master, false, layout && layoutShape ? placeholder(layout, layoutShape) : ph)
  const type = ph?.attributes.type ?? (layout && layoutShape ? placeholder(layout, layoutShape)?.attributes.type : undefined) ?? "obj"
  const main = read("ppt/presentation.xml"), defaults = main?.nodes.find(node => node.local === "defaultTextStyle")
  context.lists.push(...located(main, defaults))
  if (master) {
    const styles = master.nodes.find(node => node.local === "txStyles")
    const category = ph ? ["title", "ctrTitle"].includes(type) ? "titleStyle" : ["body", "subTitle", "obj"].includes(type) ? "bodyStyle" : "otherStyle" : "otherStyle"
    context.lists.push(...located(master, child(master, styles, category)))
  }
  for (const entry of [{document: master, node: masterShape}, {document: layout, node: layoutShape}, {document, node: shape}]) {
    if (!entry.document || !entry.node) continue
    const body = child(entry.document, entry.node, "txBody")
    context.lists.push(...located(entry.document, child(entry.document, body, "lstStyle")))
    if (body && entry.document !== document) for (const paragraph of children(entry.document, body).filter(node => node.local === "p")) context.lists.push(...located(entry.document, child(entry.document, paragraph, "pPr")))
    context.frames.push(...located(entry.document, child(entry.document, body, "bodyPr")))
    const font = child(entry.document, child(entry.document, entry.node, "style"), "fontRef")
    if (font) context.font = {document: entry.document, node: font}
  }
  return context
}
export function resolvedColor(document: Document, fill: XmlNode, context: TextContext): string {
  const color = children(document, fill)[0]
  if (!color) throw new UnsupportedTextFormat()
  const name = color.attributes.val ?? ""
  const preset = color.local === "prstClr" ? name === "black" ? "000000" : name === "white" ? "ffffff" : undefined : undefined
  if (color.local === "prstClr" && name !== "black" && name !== "white") throw new UnsupportedTextFormat("preset color")
  const hex = color.local === "prstClr" ? preset : color.local === "srgbClr" ? name : color.local === "schemeClr" ? context.colors[context.mapping[name] ?? name] : color.local === "sysClr" ? color.attributes.lastClr : undefined
  if (!hex || !/^[a-f0-9]{6}$/i.test(hex)) throw new UnsupportedTextFormat("color")
  let channels = [0, 2, 4].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
  for (const transform of children(document, color)) {
    const amount = Number(transform.attributes.val) / 100000
    if (!Number.isFinite(amount) || amount < 0 || amount > 1 || !["tint", "shade", "lumMod", "lumOff", "alpha"].includes(transform.local)) throw new UnsupportedTextFormat(`color transform ${transform.local}`)
    if (transform.local === "alpha") continue
    if (transform.local === "lumMod" || transform.local === "lumOff") {
      const maximum = Math.max(...channels), minimum = Math.min(...channels), luminance = (maximum + minimum) / 2
      const delta = maximum - minimum, saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * luminance - 1))
      const light = Math.max(0, Math.min(1, transform.local === "lumMod" ? luminance * amount : luminance + amount))
      const chroma = (1 - Math.abs(2 * light - 1)) * saturation
      channels = channels.map(value => light - chroma / 2 + (delta === 0 ? 0 : (value - minimum) / delta * chroma))
    } else channels = channels.map(value => transform.local === "tint" ? value * amount + 1 - amount : value * amount)
  }
  return `#${channels.map(value => Math.round(value * 255).toString(16).padStart(2, "0")).join("")}`
}
export function resolvedOpacity(document: Document, fill: XmlNode): number {
  const color = children(document, fill)[0]
  if (!color) throw new UnsupportedTextFormat("color")
  const alpha = children(document, color).filter(node => node.local === "alpha").at(-1)
  const value = alpha ? Number(alpha.attributes.val) / 100000 : 1
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new UnsupportedTextFormat("alpha")
  return value
}
function capitalization(value: string): NonNullable<TextStyle["capitalization"]> {
  if (value !== "none" && value !== "small" && value !== "all") throw new UnsupportedTextFormat("capitalization")
  return value
}
export function resolvedStyle(properties: LocatedNode | undefined, inherited: TextStyle, context: TextContext): TextStyle {
  if (!properties) return inherited
  if (properties.node.attributes.u && !["none", "sng"].includes(properties.node.attributes.u)) throw new UnsupportedTextFormat("underline")
  const {document, node} = properties, attributes = node.attributes, latin = child(document, node, "latin"), fill = child(document, node, "solidFill"), highlight = child(document, node, "highlight"), symbol = child(document, node, "sym")
  const typeface = latin?.attributes.typeface ?? inherited.font, font = typeface.startsWith("+") ? context.fonts[typeface] : typeface
  if (!font) throw new UnsupportedTextFormat()
  if (highlight && resolvedOpacity(document, highlight) !== 1) throw new UnsupportedTextFormat("highlight alpha")
  return {...inherited, ...(symbol?.attributes.typeface ? {symbolFont: symbol.attributes.typeface} : {}), ...(highlight ? {highlight: resolvedColor(document, highlight, context)} : {}), ...(fill && (inherited.opacity !== undefined || children(document, children(document, fill)[0]!).some(node => node.local === "alpha")) ? {opacity: resolvedOpacity(document, fill)} : {}), ...(attributes.spc === undefined ? {} : {letterSpacing: Number(attributes.spc) / 75}), ...(attributes.baseline === undefined ? {} : {baseline: Number(attributes.baseline) / 100000}), ...(attributes.strike === undefined ? {} : {strike: attributes.strike === "sngStrike"}), ...(attributes.cap === undefined ? {} : {capitalization: capitalization(attributes.cap)}), ...(attributes.kern === undefined ? {} : {kerning: Number(attributes.kern) / 75}), font, size: attributes.sz === undefined ? inherited.size : Number(attributes.sz) / 75, bold: attributes.b === undefined ? inherited.bold : ["1", "true"].includes(attributes.b), ...(attributes.i === undefined ? {} : {italic: ["1", "true"].includes(attributes.i)}), ...(attributes.u === undefined ? {} : {underline: attributes.u !== "none"}), color: fill ? resolvedColor(document, fill, context) : inherited.color}
}
const styleAttributes = ["spc", "baseline", "strike", "cap", "kern"]
const attributes: Record<string, string[]> = {txBody: [], bodyPr: ["anchor", "lIns", "rIns", "tIns", "bIns", "wrap", "rtlCol", "vert", "compatLnSpc", "spcFirstLastPara"], noAutofit: [], normAutofit: ["fontScale", "lnSpcReduction"], spAutoFit: [], lstStyle: [], defaultTextStyle: [], titleStyle: [], bodyStyle: [], otherStyle: [], p: [], pPr: ["defTabSz", "algn", "lvl", "marL", "marR", "indent", "fontAlgn"], lnSpc: [], spcPct: ["val"], spcPts: ["val"], spcBef: [], spcAft: [], highlight: [], alpha: ["val"], buClr: [], buSzPct: ["val"], buSzPts: ["val"], buNone: [], buChar: ["char"], buAutoNum: ["type", "startAt"], r: [], br: [], t: ["xml:space"], rPr: ["sz", "b", "i", "u", "lang", "dirty", ...styleAttributes], endParaRPr: ["sz", "b", "i", "u", "lang", "dirty", ...styleAttributes], defRPr: ["sz", "b", "i", "u", "lang", "dirty", ...styleAttributes], solidFill: [], srgbClr: ["val"], schemeClr: ["val"], sysClr: ["val", "lastClr"], sym: ["typeface"], latin: ["typeface"], ea: ["typeface"], cs: ["typeface"]}
export function assertTextSupported(document: Document, root: XmlNode, retainedDefaults = false, preserveSource = false): void {
  for (const node of document.nodes.filter(node => node.start >= root.start && node.end <= root.end)) {
    const known = /^lvl[1-9]pPr$/.test(node.local) || node.local === "defPPr" ? attributes.pPr : attributes[node.local]
    const retainedNodes: Record<string, string[]> = {fld: ["id", "type"], ln: ["w"], noFill: [], uLnTx: [], uFillTx: [], prstTxWarp: ["prst"], avLst: [], prstClr: ["val"], tint: ["val"], shade: ["val"], effectLst: [], tabLst: [], tab: ["pos", "algn"], buFont: ["typeface", "panose", "pitchFamily", "charset"], buFontTx: [], highlight: [], buClrTx: [], buClr: [], buSzTx: [], buSzPct: ["val"], buSzPts: ["val"], lumMod: ["val"], lumOff: ["val"], alpha: ["val"], hlinkClick: ["r:id", "tooltip", "action", "history", "highlightClick", "endSnd", "tgtFrame"], hlinkMouseOver: ["r:id", "tooltip", "action", "history", "highlightClick", "endSnd", "tgtFrame"]}
    const supported = known ?? (preserveSource ? retainedNodes[node.local] : undefined)
    if (!supported || (!node.uri.endsWith("/drawingml/2006/main") && !(node === root && ["txBody", "defaultTextStyle", "titleStyle", "bodyStyle", "otherStyle"].includes(node.local) && node.uri.endsWith("/presentationml/2006/main")))) throw new UnsupportedTextFormat(node.name)
    const retained = retainedDefaults && (node.local === "pPr" || /^lvl[1-9]pPr$/.test(node.local) || node.local === "defPPr") ? ["defTabSz", "rtl", "eaLnBrk", "latinLnBrk", "hangingPunct"] : retainedDefaults && node.local === "defRPr" ? ["kern"] : []
    if (Object.keys(node.attributes).some(name => !name.startsWith("xmlns") && !supported.includes(name) && !retained.includes(name) && !(preserveSource && projectionAttributes(node).includes(name)))) throw new UnsupportedTextFormat(`${node.name} attributes ${Object.keys(node.attributes).join(",")}`)
    validateProjectionDefaults(node)
    if (preserveSource) {
      if (node.local === "ln" && !(node.attributes.w === "0" && children(document, node).length === 0) && !(children(document, node).length === 1 && children(document, node)[0]!.local === "noFill")) throw new UnsupportedTextFormat("visible text outline")
      if (node.local === "noFill" && !document.nodes.some(parent => parent.local === "ln" && parent.start < node.start && parent.end > node.end)) throw new UnsupportedTextFormat("invisible text fill")
      if (node.local === "prstTxWarp" && node.attributes.prst !== "textNoShape") throw new UnsupportedTextFormat("text warp")
      if (node.local === "avLst" && (!document.nodes.some(parent => parent.local === "prstTxWarp" && parent.attributes.prst === "textNoShape" && parent.start < node.start && parent.end > node.end) || children(document, node).length)) throw new UnsupportedTextFormat("text warp adjustments")
      if (node.local === "tab" && !document.nodes.some(parent => parent.local === "tabLst" && parent.start < node.start && parent.end > node.end)) throw new UnsupportedTextFormat("inline tab")
    }
    if (node.attributes.rtl && !["0", "false"].includes(node.attributes.rtl)) throw new UnsupportedTextFormat("right-to-left text")
    if (node.attributes.wrap && !["square", "none"].includes(node.attributes.wrap) || node.attributes.rtlCol && !["0", "false"].includes(node.attributes.rtlCol) || node.attributes.anchor && !["t", "ctr", "b"].includes(node.attributes.anchor)) throw new UnsupportedTextFormat()
    if (node.attributes.u && !["sng", "none"].includes(node.attributes.u)) throw new UnsupportedTextFormat()
    if (node.attributes.algn && !["l", "ctr", "r", "just"].includes(node.attributes.algn)) throw new UnsupportedTextFormat()
    if (!retainedDefaults && !preserveSource && ["ea", "cs"].includes(node.local) && node.attributes.typeface) throw new UnsupportedTextFormat()
  }
}

function projectionAttributes(node: XmlNode): string[] {
  if (["rPr", "endParaRPr", "defRPr"].includes(node.local)) return [...styleAttributes, "smtClean", "kumimoji", "normalizeH", "noProof", "altLang", "err"]
  if (["latin", "ea", "cs", "sym"].includes(node.local)) return ["panose", "pitchFamily", "charset"]
  if (node.local === "bodyPr") return ["vert", "numCol", "spcCol", "anchorCtr", "compatLnSpc", "forceAA", "fromWordArt", "upright"]
  if (node.local === "pPr" || node.local === "defPPr" || /^lvl[1-9]pPr$/.test(node.local)) return ["defTabSz", "rtl", "eaLnBrk", "latinLnBrk", "hangingPunct", "fontAlgn"]
  return []
}
function validateProjectionDefaults(node: XmlNode): void {
  const values: Record<string, string[]> = {spcFirstLastPara: ["0", "false", "1", "true"],vert: ["horz", "vert270"], numCol: ["1"], spcCol: ["0"], anchorCtr: ["0", "false"], compatLnSpc: ["0", "false", "1", "true"], forceAA: ["0", "false"], fromWordArt: ["0", "false"], upright: ["0", "false"], kumimoji: ["0", "false"], normalizeH: ["0", "false"], fontAlgn: ["auto", "base", "t", "ctr", "b"], strike: ["noStrike", "sngStrike"]}
  for (const [name, allowed] of Object.entries(values)) if (node.attributes[name] !== undefined && !allowed.includes(node.attributes[name]!)) throw new UnsupportedTextFormat(`${node.name}@${name}=${node.attributes[name]}`)
}
