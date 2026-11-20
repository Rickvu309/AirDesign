import { markupDocument, spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { xmlAttribute } from "./shape-write.js"
import { holderText, markupChildren, type MarkupChildren } from "./text-value-route.js"

export type ChartTree = {
  readonly bytes: Uint8Array
  readonly elements: readonly MarkupElement[]
  readonly children: MarkupChildren
}

export function chartTree(bytes: Uint8Array | undefined): ChartTree | null {
  if (bytes === undefined) return null
  try {
    const document = markupDocument(bytes)
    return document.wellFormed
      ? { bytes, elements: document.elements, children: markupChildren(document.elements) }
      : null
  } catch {
    return null
  }
}

export function treeRoot(tree: ChartTree): MarkupElement | undefined {
  return tree.elements.find((element) => element.parent < 0)
}

export function treeKids(tree: ChartTree, parent: MarkupElement | undefined, kind: string): readonly MarkupElement[] {
  return parent === undefined ? [] : (tree.children[parent.index] ?? []).filter((item) => item.kind === kind)
}

export function treeKid(tree: ChartTree, parent: MarkupElement | undefined, kind: string): MarkupElement | undefined {
  return treeKids(tree, parent, kind)[0]
}

export function treeValue(element: MarkupElement | undefined, name = "val"): string | undefined {
  return element?.attributes.find((item) => item.name === name)?.value
}

export function treeText(tree: ChartTree, element: MarkupElement | undefined): string {
  return element === undefined ? "" : holderText(tree.bytes, element)
}

export function treeXml(tree: ChartTree, element: MarkupElement): string {
  return decodeUtf8(tree.bytes.subarray(element.start, element.end))
}

export function chartGroup(tree: ChartTree): MarkupElement | undefined {
  const plot = treeKid(tree, treeKid(tree, treeRoot(tree), "c:chart"), "c:plotArea")
  return (tree.children[plot?.index ?? -1] ?? []).find((element) =>
    ["c:barChart", "c:lineChart", "c:pieChart"].includes(element.kind),
  )
}

export function orderedSeries(tree: ChartTree, group: MarkupElement | undefined): readonly MarkupElement[] {
  const order = (series: MarkupElement) => Number(treeValue(treeKid(tree, series, "c:order")) ?? "0")
  return [...treeKids(tree, group, "c:ser")].sort((left, right) => order(left) - order(right))
}

export function replaced(element: MarkupElement, xml: string): ByteEdit {
  return { start: element.start, end: element.end, next: encodeUtf8(xml) }
}

export function removed(element: MarkupElement): ByteEdit {
  return { start: element.start, end: element.end, next: new Uint8Array() }
}

export function attributeSet(tree: ChartTree, element: MarkupElement, name: string, value: string): ByteEdit {
  const found = element.attributes.find((item) => item.name === name)
  if (found !== undefined)
    return { start: found.valueStart, end: found.valueEnd, next: encodeUtf8(xmlAttribute(value)) }
  const at = element.openEnd - (element.selfClosing ? 2 : 1)
  const close = decodeUtf8(tree.bytes.subarray(at - 1, at)) === " " ? "" : " "
  return { start: at, end: at, next: encodeUtf8(`${close}${name}="${xmlAttribute(value)}"`) }
}

export function placedAfter(tree: ChartTree, parent: MarkupElement, kinds: readonly string[], xml: string): ByteEdit {
  if (parent.selfClosing) {
    const open = decodeUtf8(tree.bytes.subarray(parent.start, parent.end - 2)).trimEnd()
    return { start: parent.start, end: parent.end, next: encodeUtf8(`${open}>${xml}</${parent.kind}>`) }
  }
  const at = (tree.children[parent.index] ?? []).reduce(
    (after, child) => (kinds.includes(child.kind) ? child.end : after),
    parent.openEnd,
  )
  return { start: at, end: at, next: encodeUtf8(xml) }
}

export function placedBefore(tree: ChartTree, parent: MarkupElement, kinds: readonly string[], xml: string): ByteEdit {
  if (parent.selfClosing) return placedAfter(tree, parent, [], xml)
  const first = (tree.children[parent.index] ?? []).find((child) => kinds.includes(child.kind))
  const at = first === undefined ? parent.closeStart : first.start
  return { start: at, end: at, next: encodeUtf8(xml) }
}

export function treeEdited(tree: ChartTree, edits: readonly ByteEdit[]): ChartTree | null {
  return edits.length === 0 ? tree : chartTree(spliceBytes(tree.bytes, edits))
}
