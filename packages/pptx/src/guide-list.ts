import { readGuideList, type Guide } from "@airdesign/document"
import { markupDocument, type MarkupElement } from "./element-span.js"
import { presentationPart } from "./package-address.js"
import { attr, childrenOf, extensionOf, guidesNamespace, localName, writeSlideExtension } from "./slide-extension.js"
import { relatedPart } from "./slide-placeholders.js"
import { whole, type TraitXml } from "./xml-codec.js"
import { layoutGuidesXml } from "./layout-guide-list.js"

type Parts = ReadonlyMap<string, Uint8Array>

export const guidesUri = "{B7EA18BA-A583-420B-AA80-A42F3E0419E5}"

const deckGuidesUri = "{EFAFB233-063F-42B5-8137-9DF3F51BA10A}"
const layoutGuidesUri = "{DCECCB84-F9BA-43D5-87BE-67443E8EF086}"
const masterGuidesUri = "{27BBF7A9-308A-43DC-89C8-2F10F3537804}"
const emuPerEighth = 1587.5

function powerpointGuide(element: MarkupElement): Guide | null {
  const pos = attr(element, "pos") ?? "0"
  if (!/^-?[0-9]+$/.test(pos)) return null
  const offset = Math.round(Number(pos) * emuPerEighth)
  if (!Number.isSafeInteger(offset)) return null
  return { axis: attr(element, "orient") === "horz" ? "y" : "x", offset }
}

function powerpointGuides(parts: Parts, part: string | null, uri: string): readonly Guide[] {
  const bytes = part === null ? undefined : parts.get(part)
  if (bytes === undefined) return []
  const { elements, wellFormed } = markupDocument(bytes)
  const extension = wellFormed ? extensionOf(elements, uri) : undefined
  if (extension === undefined) return []
  const list = childrenOf(elements, extension).find((element) => localName(element.kind) === "sldGuideLst")
  if (list === undefined) return []
  return childrenOf(elements, list).flatMap((element) => {
    if (localName(element.kind) !== "guide") return []
    const guide = powerpointGuide(element)
    return guide === null ? [] : [guide]
  })
}

function ownGuides(bytes: Uint8Array | undefined): readonly Guide[] | null {
  if (bytes === undefined) return null
  const { elements, wellFormed } = markupDocument(bytes)
  const extension = wellFormed ? extensionOf(elements, guidesUri) : undefined
  if (extension === undefined) return null
  const list = childrenOf(elements, extension).find((element) => localName(element.kind) === "guides")
  if (list === undefined) return null
  const raw = childrenOf(elements, list).map((element) => ({
    axis: attr(element, "axis"),
    offset: Number(attr(element, "offset")),
  }))
  return readGuideList(raw)
}

function once(guides: readonly Guide[]): readonly Guide[] {
  const seen = new Set<string>()
  return guides.filter((guide) => {
    const key = `${guide.axis} ${String(guide.offset)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function readSlideGuides(parts: Parts, part: string): readonly Guide[] {
  const own = ownGuides(parts.get(part))
  if (own !== null) return own
  const layout = relatedPart(parts, part, "slideLayout")
  const master = layout === null ? null : relatedPart(parts, layout, "slideMaster")
  return once([
    ...powerpointGuides(parts, presentationPart, deckGuidesUri),
    ...powerpointGuides(parts, layout, layoutGuidesUri),
    ...powerpointGuides(parts, master, masterGuidesUri),
  ])
}

export function writeSlideGuides(parts: Parts, part: string, guides: readonly Guide[]): Parts {
  const lines = guides.map((guide) => `<ag:guide axis="${guide.axis}" offset="${String(guide.offset)}"/>`).join("")
  return writeSlideExtension(parts, part, guidesUri, `<ag:guides xmlns:ag="${guidesNamespace}">${lines}</ag:guides>`)
}

export const guidesXml: TraitXml<"guides"> = {
  slot: null,
  fields: {
    ruler: whole({
      read: (parts, at) => readSlideGuides(parts, at.part),
      write: (parts, at, value) => writeSlideGuides(parts, at.part, value),
    }),
    layout: layoutGuidesXml,
  },
}
