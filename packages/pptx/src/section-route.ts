import type { MarkupElement } from "./element-span.js"
import { encodeUtf8 } from "./package-bytes.js"
import { cut, elementById, insertAt, moveBytes, requireMarkup, rootClose, within } from "./part-markup.js"
import { xmlAttribute as attributeText } from "./shape-write.js"

const sectionUri = "{521415D9-36F7-43E2-AB2F-B90AF26B5E84}"
const sectionNamespace = "http://schemas.microsoft.com/office/powerpoint/2010/main"
const sectionKind = "p14:section"
const sectionListKind = "p14:sectionLst"

function sectionGuid(elements: readonly MarkupElement[]): string {
  const used = new Set(
    elements
      .filter((element) => (element.kind === sectionKind || element.kind === "p:section") && element.id !== null)
      .map((element) => element.id),
  )
  for (let number = 1; number <= used.size + 1; number += 1) {
    const id = `{00000000-0000-4000-8000-${String(number).padStart(12, "0")}}`
    if (!used.has(id)) return id
  }
  throw new Error("section")
}

function sectionXml(title: string, id: string): string {
  return `<p14:section name="${attributeText(title)}" id="${id}"><p14:sldIdLst/></p14:section>`
}

export function addSection(bytes: Uint8Array, title: string): Uint8Array {
  const document = requireMarkup(bytes)
  const section = sectionXml(title, sectionGuid(document.elements))
  const list = document.elements.find((element) => element.kind === sectionListKind)
  if (list !== undefined) {
    if (list.selfClosing || list.closeStart < 0) throw new Error("section")
    return insertAt(bytes, list.closeStart, encodeUtf8(section))
  }
  const listXml = `<${sectionListKind} xmlns:p14="${sectionNamespace}">${section}</${sectionListKind}>`
  const extension = document.elements.find(
    (element) =>
      element.kind === "p:ext" && element.attributes.some((item) => item.name === "uri" && item.value === sectionUri),
  )
  if (extension !== undefined) {
    if (extension.selfClosing || extension.closeStart < 0) throw new Error("section")
    return insertAt(bytes, extension.closeStart, encodeUtf8(listXml))
  }
  const extXml = `<p:ext uri="${sectionUri}">${listXml}</p:ext>`
  const extList = document.elements.find((element) => element.kind === "p:extLst")
  if (extList !== undefined) {
    if (extList.selfClosing || extList.closeStart < 0) throw new Error("section")
    return insertAt(bytes, extList.closeStart, encodeUtf8(extXml))
  }
  return insertAt(bytes, rootClose(document, "p:presentation", "section"), encodeUtf8(`<p:extLst>${extXml}</p:extLst>`))
}

function directChildren(elements: readonly MarkupElement[], parent: MarkupElement): MarkupElement[] {
  return elements.filter((element) => element.parent === parent.index)
}

export function removeSection(bytes: Uint8Array, section: string): Uint8Array {
  const document = requireMarkup(bytes)
  const found = elementById(document.elements, sectionKind, section, "section")
  const list = document.elements.find(
    (element) => element.kind === sectionListKind && within(document.elements, found, element),
  )
  if (list === undefined) throw new Error("section")
  const count = document.elements.filter(
    (element) => element.kind === sectionKind && within(document.elements, element, list),
  ).length
  if (count > 1) return cut(bytes, found.start, found.end)
  const extension = document.elements.find(
    (element) => element.kind === "p:ext" && within(document.elements, list, element),
  )
  const extList =
    extension === undefined
      ? undefined
      : document.elements.find(
          (element) => element.kind === "p:extLst" && within(document.elements, extension, element),
        )
  if (
    extension !== undefined &&
    extList !== undefined &&
    directChildren(document.elements, extension).every((child) => child.kind === sectionListKind) &&
    directChildren(document.elements, extList).length === 1
  ) {
    return cut(bytes, extList.start, extList.end)
  }
  if (
    extension !== undefined &&
    directChildren(document.elements, extension).every((child) => child.kind === sectionListKind)
  ) {
    return cut(bytes, extension.start, extension.end)
  }
  return cut(bytes, list.start, list.end)
}

export function orderSection(bytes: Uint8Array, section: string, before: string): Uint8Array {
  if (section === before) throw new Error("section")
  const document = requireMarkup(bytes)
  return moveBytes(
    bytes,
    elementById(document.elements, sectionKind, section, "section"),
    elementById(document.elements, sectionKind, before, "section"),
  )
}
