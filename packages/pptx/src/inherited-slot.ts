import type { MarkupElement } from "./element-span.js"
import { linkedPart } from "./notes-part.js"
import { attr, finalPlacement, layoutMatch, masterMatch, sheetFrom, type Sheet } from "./paint-sheet.js"
import { requireMarkup } from "./part-markup.js"
import { isShapeTag, shapeById, shapeTags } from "./shape-tree.js"
import { markupChildren, type MarkupChildren } from "./text-value-route.js"
import type { ElementAt, Parts, SlotXml } from "./xml-codec.js"

export type SlotPlace = {
  readonly host: MarkupElement | null
  readonly hostTag: string
  readonly tag: string
  readonly own: MarkupElement | null
}

function transformAt(children: MarkupChildren, shape: MarkupElement): SlotPlace {
  if (!isShapeTag(shape.kind)) throw new Error("shape")
  const { properties, transform } = shapeTags[shape.kind]
  const host = properties === null ? shape : (children[shape.index]?.find((each) => each.kind === properties) ?? null)
  const own = host === null ? null : (children[host.index]?.find((each) => each.kind === transform) ?? null)
  return { host, hostTag: properties ?? shape.kind, tag: transform, own }
}

function placeOf(children: MarkupChildren, shape: MarkupElement, slot: SlotXml): SlotPlace {
  switch (slot) {
    case "transform":
      return transformAt(children, shape)
  }
}

export function slotAt(bytes: Uint8Array, id: string, slot: SlotXml): SlotPlace {
  const { elements } = requireMarkup(bytes)
  return placeOf(markupChildren(elements), shapeById(elements, id), slot)
}

function sheetOf(parts: Parts, part: string | null): Sheet | null {
  const bytes = part === null ? undefined : parts.get(part)
  return part === null || bytes === undefined ? null : sheetFrom(part, bytes)
}

const drawingPrefix = (sheet: Sheet): string | null => {
  const root = sheet.elements[0]
  return root === undefined ? null : attr(root, "xmlns:a")
}

export function inheritedSlot(parts: Parts, at: ElementAt, slot: SlotXml): Uint8Array | null {
  const sheet = sheetOf(parts, at.part)
  const placeholder = sheet?.drawn.find((item) => item.shape === at.shape)?.placeholder ?? null
  if (sheet === null || placeholder === null) return null
  const layout = sheetOf(parts, linkedPart(parts, at.part, "slideLayout"))
  const master = layout === null ? null : sheetOf(parts, linkedPart(parts, layout.part, "slideMaster"))
  const above = layout === null ? undefined : layoutMatch(layout, placeholder)
  const base = master === null ? undefined : masterMatch(master, above?.placeholder ?? placeholder)
  const source =
    layout !== null && above !== undefined && finalPlacement(above) !== null
      ? { sheet: layout, item: above }
      : master !== null && base !== undefined && finalPlacement(base) !== null
        ? { sheet: master, item: base }
        : null
  if (source === null || drawingPrefix(source.sheet) !== drawingPrefix(sheet)) return null
  const { own } = placeOf(source.sheet.children, source.item.element, slot)
  return own === null ? null : source.sheet.bytes.subarray(own.start, own.end)
}
