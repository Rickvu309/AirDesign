import { SaxesParser } from "saxes"
import { fileLimits } from "../../files/src/index.ts"

export type XmlNode = { uri: string; local: string; name: string; attributes: Record<string, string>; start: number; openEnd: number; closeStart: number; end: number }
export function parseXml(bytes: Buffer): { xml: string; nodes: XmlNode[] } {
  if (bytes.length > fileLimits.xml) throw new Error("xml-byte-limit")
  const xml = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("xml-dtd-forbidden")
  const parser = new SaxesParser({ xmlns: true })
  const nodes: XmlNode[] = []
  const stack: XmlNode[] = []
  parser.on("error", error => { throw error })
  parser.on("processinginstruction", () => { throw new Error("xml-processing-instruction-forbidden") })
  parser.on("opentag", tag => {
    if (nodes.length >= fileLimits.nodes || stack.length >= fileLimits.depth || Object.keys(tag.attributes).length > fileLimits.attributes) throw new Error("xml-complexity-limit")
    if (tag.uri === "http://www.w3.org/2001/XInclude") throw new Error("xml-xinclude-forbidden")
    const node: XmlNode = { uri: tag.uri, local: tag.local, name: tag.name, attributes: Object.fromEntries(Object.values(tag.attributes).map(attribute => [attribute.name, attribute.value])), start: xml.lastIndexOf("<", parser.position - 1), openEnd: parser.position, closeStart: parser.position, end: parser.position }
    nodes.push(node)
    stack.push(node)
  })
  parser.on("closetag", tag => {
    const node = stack.pop()
    if (!node) throw new Error("xml-stack")
    node.end = parser.position
    node.closeStart = tag.isSelfClosing ? node.openEnd : xml.lastIndexOf("</", parser.position - 1)
  })
  parser.write(xml).close()
  return { xml, nodes }
}
export function escapeXml(value: string): string {
  if ([...value].some(character => character.charCodeAt(0) < 32 && ![9,10,13].includes(character.charCodeAt(0)))) throw new Error("xml-invalid-text")
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;")
}
