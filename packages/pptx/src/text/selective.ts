import {isDeepStrictEqual} from "node:util"
import type {TextBody} from "../../../deck/src/text/body.ts"
import {escapeXml, parseXml, type XmlNode} from "../xml.ts"
import {child, children, type Document} from "./nodes.ts"
import {UnsupportedTextFormat} from "./cascade.ts"

type Edit = {start: number; end: number; value: string}
export function selectiveTextBody(document: Document, root: XmlNode, previous: TextBody, next: TextBody, serializedPrevious: string, serializedNext: string): string | undefined {
  if (previous.paragraphs.length !== next.paragraphs.length || previous.paragraphs.some((paragraph, index) => {
    const current = next.paragraphs[index]!
    return paragraph.id !== current.id || paragraph.runs.length !== current.runs.length || paragraph.runs.some((run, index) => run.kind !== current.runs[index]!.kind)
  })) return undefined
  const before = parseXml(Buffer.from(serializedPrevious)), after = parseXml(Buffer.from(serializedNext))
  const edits: Edit[] = [], additions = new Map<XmlNode, {value: string; position: number}[]>()
  const raw = (doc: Document, node: XmlNode) => doc.xml.slice(node.start, node.end)
  const append = (parent: XmlNode, value: string) => {
    const order = parent.local === "p" ? ["pPr", "r", "br", "fld", "endParaRPr"] : ["ln", "noFill", "solidFill", "gradFill", "blipFill", "pattFill", "grpFill", "effectLst", "effectDag", "highlight", "uLnTx", "uLn", "uFillTx", "uFill", "latin", "ea", "cs", "sym", "hlinkClick", "hlinkMouseOver", "rtl", "extLst"]
    const paragraphOrder = ["lnSpc", "spcBef", "spcAft", "buClrTx", "buClr", "buSzTx", "buSzPct", "buSzPts", "buFontTx", "buFont", "buNone", "buAutoNum", "buChar", "buBlip", "tabLst", "defRPr", "extLst"]
    const locals = parent.local === "pPr" ? paragraphOrder : order
    const local = value.match(/^<a:([^\s/>]+)/)?.[1]
    if (!local) throw new UnsupportedTextFormat("selective property namespace")
    const next = children(document, parent).find(node => locals.indexOf(node.local) > locals.indexOf(local))
    const position = next?.start ?? parent.closeStart
    const prior = additions.get(parent) ?? []
    prior.push({value: value.replace(/^<a:([^\s/>]+)/, '<a:$1 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'), position})
    additions.set(parent, prior)
  }
  const attributes = (node: XmlNode, changes: Record<string, string | undefined>) => {
    let opening = document.xml.slice(node.start, node.openEnd)
    for (const [name, value] of Object.entries(changes)) {
      const expression = new RegExp(`\\s${name}\\s*=\\s*(?:"[^"]*"|'[^']*')`)
      if (value === undefined) opening = opening.replace(expression, "")
      else if (expression.test(opening)) opening = opening.replace(expression, () => ` ${name}="${escapeXml(value)}"`)
      else opening = opening.replace(/\s*\/?>$/, ending => ` ${name}="${escapeXml(value)}"${ending}`)
    }
    edits.push({start: node.start, end: node.openEnd, value: opening})
  }
  const reconcile = (parent: XmlNode, local: string, oldNode: XmlNode | undefined, newNode: XmlNode | undefined) => {
    if (!oldNode || !newNode) throw new UnsupportedTextFormat("selective source structure")
    const target = child(document, parent, local)
    if (!target) { if (!isDeepStrictEqual(oldNode.attributes, newNode.attributes) || raw(before, oldNode) !== raw(after, newNode)) append(parent, raw(after, newNode)); return }
    const changed: Record<string, string | undefined> = {}
    for (const name of new Set([...Object.keys(oldNode.attributes), ...Object.keys(newNode.attributes)])) if (!name.startsWith("xmlns") && oldNode.attributes[name] !== newNode.attributes[name]) changed[name] = newNode.attributes[name]
    if (["spc", "baseline", "kern", "strike", "cap"].some(name => Object.hasOwn(changed, name) && changed[name] === undefined)) throw new UnsupportedTextFormat("clearing inherited character formatting")
    if (Object.keys(changed).length) attributes(target, changed)
    const locals = new Set([...children(before, oldNode), ...children(after, newNode)].map(node => node.local))
    for (const local of locals) {
      const oldChild = child(before, oldNode, local), newChild = child(after, newNode, local)
      if (oldChild && newChild && raw(before, oldChild) === raw(after, newChild)) continue
      const existing = child(document, target, local)
      if (existing && local === "latin" && Object.keys(existing.attributes).some(name => name !== "typeface" && !name.startsWith("xmlns"))) throw new UnsupportedTextFormat("font fallback metadata requires unchanged font")
      if (existing) edits.push({start: existing.start, end: existing.end, value: newChild ? raw(after, newChild).replace(/^<a:([^\s/>]+)/, '<a:$1 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"') : ""})
      else if (newChild) append(target, raw(after, newChild))
    }
  }
  reconcile(root, "bodyPr", before.nodes.find(node => node.local === "bodyPr"), after.nodes.find(node => node.local === "bodyPr"))
  const paragraphs = children(document, root).filter(node => node.local === "p"), oldParagraphs = before.nodes.filter(node => node.local === "p"), newParagraphs = after.nodes.filter(node => node.local === "p")
  if (paragraphs.length !== previous.paragraphs.length) throw new UnsupportedTextFormat("selective paragraph structure")
  for (const [index, paragraph] of paragraphs.entries()) {
    const prior = previous.paragraphs[index]!, current = next.paragraphs[index]!, oldParagraph = oldParagraphs[index]!, newParagraph = newParagraphs[index]!
    reconcile(paragraph, "pPr", child(before, oldParagraph, "pPr"), child(after, newParagraph, "pPr"))
    reconcile(paragraph, "endParaRPr", child(before, oldParagraph, "endParaRPr"), child(after, newParagraph, "endParaRPr"))
    const runs = children(document, paragraph).filter(node => ["r", "br", "fld"].includes(node.local)), oldRuns = children(before, oldParagraph).filter(node => ["r", "br"].includes(node.local)), newRuns = children(after, newParagraph).filter(node => ["r", "br"].includes(node.local))
    if (runs.length !== prior.runs.length) throw new UnsupportedTextFormat("selective run structure")
    for (const [index, run] of runs.entries()) {
      const oldRun = prior.runs[index]!, newRun = current.runs[index]!
      reconcile(run, "rPr", child(before, oldRuns[index], "rPr"), child(after, newRuns[index], "rPr"))
      if (oldRun.kind === "text" && newRun.kind === "text" && oldRun.text !== newRun.text) {
        if (run.local === "fld") throw new UnsupportedTextFormat("field value is source controlled")
        const text = child(document, run, "t")
        if (!text || /[\r\n\t]/.test(newRun.text)) throw new UnsupportedTextFormat("selective text structure")
        if (text.openEnd === text.end) edits.push({start: text.start, end: text.end, value: `<${text.name} xml:space="preserve">${escapeXml(newRun.text)}</${text.name}>`})
        else { attributes(text, {"xml:space": "preserve"}); edits.push({start: text.openEnd, end: text.closeStart, value: escapeXml(newRun.text)}) }
      }
    }
  }
  for (const [parent, values] of additions) {
    const attribute = edits.find(edit => edit.start === parent.start && edit.end === parent.openEnd)
    if (parent.openEnd === parent.end) {
      if (attribute) edits.splice(edits.indexOf(attribute), 1)
      edits.push({start: parent.start, end: parent.end, value: (attribute?.value ?? document.xml.slice(parent.start, parent.end)).replace(/\s*\/>$/, ">") + values.map(item => item.value).join("") + `</${parent.name}>`})
    } else {
      for (const position of new Set(values.map(item => item.position))) {
        const value = values.filter(item => item.position === position).map(item => item.value).join("")
        edits.push({start: position, end: position, value})
      }
    }
  }
  let result = document.xml, boundary = result.length
  for (const edit of edits.sort((a,b) => b.start - a.start || b.end - a.end)) {
    if (edit.end > boundary) throw new UnsupportedTextFormat("overlapping selective edits")
    result = result.slice(0, edit.start) + edit.value + result.slice(edit.end); boundary = edit.start
  }
  return result
}
