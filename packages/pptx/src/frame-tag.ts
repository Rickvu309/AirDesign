import { spliceBytes, type MarkupElement } from "./element-span.js"
import { attributeEdit } from "./markup-attribute.js"
import { contentTypesPart, partOf, relsOf } from "./package-address.js"
import { encodeUtf8 } from "./package-bytes.js"
import { insertAt, partBytes, requireMarkup, rootClose } from "./part-markup.js"
import { shapeById } from "./shape-tree.js"
import { markupChildren, type MarkupChildren } from "./text-value-route.js"

type Parts = ReadonlyMap<string, Uint8Array>

const tagsType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags"
const tagsContent = "application/vnd.openxmlformats-officedocument.presentationml.tags+xml"
const relationships = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const presentation = "http://schemas.openxmlformats.org/presentationml/2006/main"
const emptyRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`
const tagName = "AIRDESIGN_LAYOUT"
const tagPart = /^ppt\/tags\/tag([0-9]{1,9})\.xml$/

function attr(element: MarkupElement | undefined, name: string): string | null {
  return element?.attributes.find((item) => item.name === name)?.value ?? null
}

function childOf(children: MarkupChildren, parent: MarkupElement | undefined, kind: string): MarkupElement | undefined {
  return parent === undefined ? undefined : children[parent.index]?.find((each) => each.kind === kind)
}

function tagsOf(children: MarkupChildren, group: MarkupElement): MarkupElement | undefined {
  const properties = childOf(children, childOf(children, group, "p:nvGrpSpPr"), "p:nvPr")
  return childOf(children, childOf(children, properties, "p:custDataLst"), "p:tags")
}

function linked(parts: Parts, slide: string, id: string): string | null {
  const rels = parts.get(relsOf(slide))
  if (rels === undefined) return null
  const row = requireMarkup(rels).elements.find(
    (element) => element.kind === "Relationship" && attr(element, "Id") === id && attr(element, "Type") === tagsType,
  )
  const target = attr(row, "Target")
  return target === null ? null : partOf(slide, target)
}

function tagIn(bytes: Uint8Array): MarkupElement | undefined {
  return requireMarkup(bytes).elements.find((element) => element.kind === "p:tag" && attr(element, "name") === tagName)
}

function markedPart(parts: Parts, slide: string, shape: string): string | null {
  const bytes = parts.get(slide)
  if (bytes === undefined) return null
  const { elements } = requireMarkup(bytes)
  const group = shapeById(elements, shape)
  if (group.kind !== "p:grpSp") return null
  const id = attr(tagsOf(markupChildren(elements), group), "r:id")
  return id === null ? null : linked(parts, slide, id)
}

export function frameMarker(parts: Parts, slide: string, shape: string): string | null {
  const part = markedPart(parts, slide, shape)
  const bytes = part === null ? undefined : parts.get(part)
  return bytes === undefined ? null : attr(tagIn(bytes), "val")
}

function freshTag(parts: Parts): string {
  let highest = 0
  for (const name of parts.keys()) highest = Math.max(highest, Number(tagPart.exec(name)?.[1] ?? 0))
  return `ppt/tags/tag${String(highest + 1)}.xml`
}

function linkTag(parts: Map<string, Uint8Array>, slide: string, part: string): string {
  const name = relsOf(slide)
  const rels = parts.get(name) ?? encodeUtf8(emptyRels)
  const document = requireMarkup(rels)
  let highest = 0
  for (const element of document.elements) {
    const number = /^rId([0-9]{1,9})$/.exec(attr(element, "Id") ?? "")?.[1]
    if (element.kind === "Relationship" && number !== undefined) highest = Math.max(highest, Number(number))
  }
  const id = `rId${String(highest + 1)}`
  const target = `../tags/${part.slice("ppt/tags/".length)}`
  const row = `<Relationship Id="${id}" Type="${tagsType}" Target="${target}"/>`
  parts.set(name, insertAt(rels, rootClose(document, "Relationships", "rels"), encodeUtf8(row)))
  return id
}

function typed(parts: Map<string, Uint8Array>, part: string): void {
  const types = partBytes(parts, contentTypesPart)
  const row = `<Override PartName="/${part}" ContentType="${tagsContent}"/>`
  parts.set(contentTypesPart, insertAt(types, rootClose(requireMarkup(types), "Types", "types"), encodeUtf8(row)))
}

function tagged(marker: string): Uint8Array {
  return encodeUtf8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:tagLst xmlns:p="${presentation}"><p:tag name="${tagName}" val="${marker}"/></p:tagLst>`,
  )
}

function listed(bytes: Uint8Array, shape: string, id: string): Uint8Array {
  const { elements } = requireMarkup(bytes)
  const children = markupChildren(elements)
  const group = shapeById(elements, shape)
  const properties = childOf(children, childOf(children, group, "p:nvGrpSpPr"), "p:nvPr")
  if (properties === undefined) throw new Error("p:nvPr")
  const root = elements.find((element) => element.parent < 0)
  const declared = attr(root, "xmlns:r") === relationships ? "" : ` xmlns:r="${relationships}"`
  const list = `<p:custDataLst><p:tags${declared} r:id="${id}"/></p:custDataLst>`
  if (properties.selfClosing)
    return spliceBytes(bytes, [
      { start: properties.start, end: properties.end, next: encodeUtf8(`<p:nvPr>${list}</p:nvPr>`) },
    ])
  const tail = childOf(children, properties, "p:extLst")
  const at = tail?.start ?? properties.end - encodeUtf8("</p:nvPr>").byteLength
  return spliceBytes(bytes, [{ start: at, end: at, next: encodeUtf8(list) }])
}

export function markFrame(parts: Parts, slide: string, shape: string, marker: string): Parts {
  const part = markedPart(parts, slide, shape)
  const held = part === null ? undefined : parts.get(part)
  const tag = held === undefined ? undefined : tagIn(held)
  const next = new Map(parts)
  if (part !== null && held !== undefined && tag !== undefined) {
    const edit = attr(tag, "val") === marker ? null : attributeEdit(held, tag, "val", marker)
    if (edit === null) return parts
    next.set(part, spliceBytes(held, [edit]))
    return next
  }
  const fresh = freshTag(parts)
  next.set(fresh, tagged(marker))
  typed(next, fresh)
  const id = linkTag(next, slide, fresh)
  next.set(slide, listed(partBytes(next, slide), shape, id))
  return next
}
