import { spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { partBytes, requireMarkup } from "./part-markup.js"

type Parts = ReadonlyMap<string, Uint8Array>

export const guidesNamespace = "https://airdesign.app/2026/guides"

export function attr(element: MarkupElement, name: string): string | undefined {
  return element.attributes.find((attribute) => attribute.name === name)?.value
}

export function localName(kind: string): string {
  const colon = kind.indexOf(":")
  return colon < 0 ? kind : kind.slice(colon + 1)
}

export function childrenOf(elements: readonly MarkupElement[], parent: MarkupElement): readonly MarkupElement[] {
  return elements.filter((element) => element.parent === parent.index)
}

export function extensionOf(elements: readonly MarkupElement[], uri: string): MarkupElement | undefined {
  const root = elements[0]
  if (root === undefined) return undefined
  const list = childrenOf(elements, root).find((element) => element.kind === "p:extLst")
  if (list === undefined) return undefined
  return childrenOf(elements, list).find((element) => element.kind === "p:ext" && attr(element, "uri") === uri)
}

function openTag(bytes: Uint8Array, element: MarkupElement): string {
  return decodeUtf8(bytes.subarray(element.start, element.openEnd - 2)).trimEnd()
}

export function writeSlideExtension(parts: Parts, part: string, uri: string, inner: string): Parts {
  const bytes = partBytes(parts, part)
  const { elements } = requireMarkup(bytes)
  const root = elements[0]
  if (root?.kind !== "p:sld") throw new Error("slide-extension")
  const xml = `<p:ext uri="${uri}">${inner}</p:ext>`
  const list = childrenOf(elements, root).find((element) => element.kind === "p:extLst")
  const held = extensionOf(elements, uri)
  let edit: ByteEdit
  if (held !== undefined) edit = { start: held.start, end: held.end, next: encodeUtf8(xml) }
  else if (list !== undefined && !list.selfClosing)
    edit = { start: list.closeStart, end: list.closeStart, next: encodeUtf8(xml) }
  else if (list !== undefined)
    edit = { start: list.start, end: list.end, next: encodeUtf8(`<p:extLst>${xml}</p:extLst>`) }
  else if (root.selfClosing)
    edit = {
      start: root.start,
      end: root.end,
      next: encodeUtf8(`${openTag(bytes, root)}><p:extLst>${xml}</p:extLst></p:sld>`),
    }
  else edit = { start: root.closeStart, end: root.closeStart, next: encodeUtf8(`<p:extLst>${xml}</p:extLst>`) }
  return new Map(parts).set(part, spliceBytes(bytes, [edit]))
}
