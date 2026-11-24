import { type MarkupElement } from "./element-span.js"
import { partOf, relsOf } from "./package-address.js"
import { requireMarkup } from "./part-markup.js"
import { shapeById } from "./shape-tree.js"
import { markupChildren, type MarkupChildren } from "./text-value-route.js"

type Parts = ReadonlyMap<string, Uint8Array>

const tagsType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/tags"
const tagName = "AIRDESIGN_LAYOUT"

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
