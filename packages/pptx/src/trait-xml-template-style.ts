import { deckLayouts } from "./deck-layouts.js"
import { spliceBytes, type ByteEdit } from "./element-span.js"
import { freePart, link, linkedPart, typed } from "./notes-part.js"
import { copyOwnedParts } from "./owned-parts.js"
import { presentationPart, relativeTarget, relsOf } from "./package-address.js"
import { encodeUtf8 } from "./package-bytes.js"
import { paintAttribute } from "./paint-color.js"
import { insertAt, partBytes, requireMarkup } from "./part-markup.js"
import { slideTheme } from "./theme-swatches.js"
import { themeFields } from "./trait-xml-theme.js"
import { whole, type Parts, type TraitXml } from "./xml-codec.js"

function retarget(bytes: Uint8Array, type: string, target: string): Uint8Array {
  const relation = requireMarkup(bytes).elements.find(
    (element) => element.kind === "Relationship" && paintAttribute(element, "Type")?.endsWith(`/${type}`),
  )
  const attribute = relation?.attributes.find((attribute) => attribute.name === "Target")
  if (attribute === undefined) throw new Error("template-relation")
  return spliceBytes(bytes, [{ start: attribute.valueStart, end: attribute.valueEnd, next: encodeUtf8(target) }])
}

function nativeIds(parts: Parts): ReadonlySet<number> {
  const masters = new Set(deckLayouts(parts).flatMap((layout) => linkedPart(parts, layout.part, "slideMaster") ?? []))
  const ids = new Set<number>()
  for (const part of [presentationPart, ...masters]) {
    for (const element of requireMarkup(partBytes(parts, part)).elements) {
      if (element.kind !== "p:sldMasterId" && element.kind !== "p:sldLayoutId") continue
      const id = Number(paintAttribute(element, "id"))
      if (Number.isSafeInteger(id)) ids.add(id)
    }
  }
  return ids
}

function freeId(ids: ReadonlySet<number>): number {
  let id = 2147483648
  while (ids.has(id)) id++
  if (id > 4294967295) throw new Error("template-id")
  return id
}

function clonedMaster(parts: Map<string, Uint8Array>, source: string, layout: string, theme: string): string {
  const used = nativeIds(parts)
  const layoutNumber = freeId(used)
  const masterNumber = freeId(new Set([...used, layoutNumber]))
  const master = freePart(parts, "ppt/slideMasters/slideMaster")
  const bytes = partBytes(parts, relsOf(source))
  let layoutId: string | null = null
  const edits: ByteEdit[] = []
  for (const element of requireMarkup(bytes).elements) {
    if (!paintAttribute(element, "Type")?.endsWith("/slideLayout")) continue
    if (layoutId === null) {
      layoutId = paintAttribute(element, "Id")
      const target = element.attributes.find((attribute) => attribute.name === "Target")
      if (target === undefined) throw new Error("template-layout")
      edits.push({ start: target.valueStart, end: target.valueEnd, next: encodeUtf8(relativeTarget(master, layout)) })
    } else edits.push({ start: element.start, end: element.end, next: new Uint8Array() })
  }
  if (layoutId === null) throw new Error("template-layout")
  parts.set(
    relsOf(master),
    retarget(copyOwnedParts(parts, source, master, spliceBytes(bytes, edits)), "theme", relativeTarget(master, theme)),
  )
  const xml = partBytes(parts, source)
  const list = requireMarkup(xml).elements.find((element) => element.kind === "p:sldLayoutIdLst")
  if (list === undefined) throw new Error("template-master")
  const row = `<p:sldLayoutIdLst><p:sldLayoutId id="${layoutNumber}" r:id="${layoutId}"/></p:sldLayoutIdLst>`
  parts.set(master, spliceBytes(xml, [{ start: list.start, end: list.end, next: encodeUtf8(row) }]))
  typed(parts, master, "application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml")
  const id = link(parts, presentationPart, "slideMaster", master)
  const presentation = partBytes(parts, presentationPart)
  const elements = requireMarkup(presentation).elements
  const container = elements.find((element) => element.kind === "p:sldMasterIdLst")
  if (container === undefined) throw new Error("template-master")
  parts.set(
    presentationPart,
    insertAt(presentation, container.closeStart, encodeUtf8(`<p:sldMasterId id="${masterNumber}" r:id="${id}"/>`)),
  )
  return master
}

function applyTemplate(parts: Parts, slide: string, theme: string): Parts {
  if (slideTheme(parts, slide) === theme) return parts
  const layout = linkedPart(parts, slide, "slideLayout")
  const master = layout === null ? null : linkedPart(parts, layout, "slideMaster")
  if (layout === null || master === null || !parts.has(theme)) throw new Error("template")
  const next = new Map(parts)
  const copy = freePart(next, "ppt/slideLayouts/slideLayout")
  const cloned = clonedMaster(next, master, copy, theme)
  next.set(copy, partBytes(parts, layout))
  next.set(
    relsOf(copy),
    retarget(
      copyOwnedParts(next, layout, copy, partBytes(parts, relsOf(layout))),
      "slideMaster",
      relativeTarget(copy, cloned),
    ),
  )
  typed(next, copy, "application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml")
  next.set(relsOf(slide), retarget(partBytes(parts, relsOf(slide)), "slideLayout", relativeTarget(slide, copy)))
  return next
}

export const templateStyleXml: TraitXml<"templateStyle"> = {
  slot: null,
  fields: {
    id: whole({
      read: (parts, at) => slideTheme(parts, at.part),
      write: (parts, at, id) => applyTemplate(parts, at.part, id),
    }),
    ...themeFields,
  },
}
