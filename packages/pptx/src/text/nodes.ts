import {parseXml, type XmlNode} from "../xml.ts"

export type Document = ReturnType<typeof parseXml>
const childIndexes = new WeakMap<Document, Map<XmlNode, XmlNode[]>>()
export function children(document: Document, parent: XmlNode): XmlNode[] {
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
export function child(document: Document, parent: XmlNode | undefined, local: string): XmlNode | undefined {
  return parent && children(document, parent).find(node => node.local === local)
}
