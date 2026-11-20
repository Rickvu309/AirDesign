import { readLayoutGuides, type LayoutGuide } from "@airdesign/document"
import { markupDocument, type MarkupElement } from "./element-span.js"
import { childrenOf, extensionOf, guidesNamespace, localName, writeSlideExtension } from "./slide-extension.js"
import { whole, type FieldXml } from "./xml-codec.js"

type Parts = ReadonlyMap<string, Uint8Array>

export const layoutGuidesUri = "{69A285BF-2CD7-437C-98FB-1F09AAAED3C1}"

const numbers = ["count", "size", "offset", "gutter", "opacity"] as const

function rawGuide(element: MarkupElement): unknown {
  const fields: Record<string, unknown> = {}
  for (const attribute of element.attributes) {
    const name = attribute.name
    if (name.startsWith("xmlns")) continue
    fields[name] =
      name === "shown"
        ? attribute.value === "1"
        : (numbers as readonly string[]).includes(name)
          ? Number(attribute.value)
          : attribute.value
  }
  return fields
}

export function readLayoutGuideList(parts: Parts, part: string): readonly LayoutGuide[] {
  const bytes = parts.get(part)
  if (bytes === undefined) return []
  const { elements, wellFormed } = markupDocument(bytes)
  const extension = wellFormed ? extensionOf(elements, layoutGuidesUri) : undefined
  if (extension === undefined) return []
  const list = childrenOf(elements, extension).find((element) => localName(element.kind) === "layoutGuides")
  if (list === undefined) return []
  return readLayoutGuides(childrenOf(elements, list).map(rawGuide)) ?? []
}

function guideXml(guide: LayoutGuide): string {
  const fields = Object.entries(guide)
    .map(([name, value]) => ` ${name}="${typeof value === "boolean" ? (value ? "1" : "0") : String(value)}"`)
    .join("")
  return `<ag:layoutGuide${fields}/>`
}

export function writeLayoutGuideList(parts: Parts, part: string, guides: readonly LayoutGuide[]): Parts {
  const inner = `<ag:layoutGuides xmlns:ag="${guidesNamespace}">${guides.map(guideXml).join("")}</ag:layoutGuides>`
  return writeSlideExtension(parts, part, layoutGuidesUri, inner)
}

export const layoutGuidesXml: FieldXml<readonly LayoutGuide[]> = whole({
  read: (parts, at) => readLayoutGuideList(parts, at.part),
  write: (parts, at, value) => writeLayoutGuideList(parts, at.part, value),
})
