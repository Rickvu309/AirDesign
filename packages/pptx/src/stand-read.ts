import type { MarkupElement } from "./element-span.js"
import { effectsUri, storedDrops, type StoredDrop } from "./effects-extension.js"
import { paintAttribute } from "./paint-color.js"
import { whole } from "./markup-held.js"
import { isShapeTag, shapeTags } from "./shape-tree.js"
import type { MarkupChildren } from "./text-value-route.js"

export type StandRecord = {
  readonly group: string
  readonly picture: string
  readonly shape: string
  readonly matched: boolean
  readonly parent: string | null
  readonly stand: MarkupElement
  readonly drops: readonly StoredDrop[]
}

function identity(children: MarkupChildren, shape: MarkupElement): string | null {
  const kind = shape.kind
  if (!isShapeTag(kind)) return null
  const visual = children[shape.index]?.find((each) => each.kind === shapeTags[kind].nonVisual)
  const named = visual === undefined ? undefined : children[visual.index]?.find((each) => each.kind === "p:cNvPr")
  return named?.id ?? null
}

function parentId(elements: readonly MarkupElement[], children: MarkupChildren, group: MarkupElement): string | null {
  let parent = group.parent
  while (parent >= 0) {
    const element = elements[parent]
    if (element === undefined) return null
    if (element.kind === "p:grpSp") return identity(children, element)
    parent = element.parent
  }
  return null
}

function boxOf(
  children: MarkupChildren,
  properties: MarkupElement,
): { x: number; y: number; cx: number; cy: number } | null {
  const xfrm = children[properties.index]?.find((each) => each.kind === "a:xfrm")
  const off = xfrm === undefined ? undefined : children[xfrm.index]?.find((each) => each.kind === "a:off")
  const ext = xfrm === undefined ? undefined : children[xfrm.index]?.find((each) => each.kind === "a:ext")
  if (off === undefined || ext === undefined) return null
  const x = whole(off, "x")
  const y = whole(off, "y")
  const cx = whole(ext, "cx")
  const cy = whole(ext, "cy")
  return x === undefined || y === undefined || cx === undefined || cy === undefined ? null : { x, y, cx, cy }
}

function numberAttr(element: MarkupElement, name: string): number | null {
  const value = whole(element, name)
  return value === undefined ? null : value
}

export function standRecords(elements: readonly MarkupElement[], children: MarkupChildren): readonly StandRecord[] {
  const records: StandRecord[] = []
  for (const group of elements) {
    if (group.kind !== "p:grpSp") continue
    const properties = children[group.index]?.find((each) => each.kind === "p:grpSpPr")
    if (properties === undefined) continue
    const list = children[properties.index]?.find((each) => each.kind === "a:extLst")
    const own =
      list === undefined ? undefined : children[list.index]?.find((each) => paintAttribute(each, "uri") === effectsUri)
    const stand = own === undefined ? undefined : children[own.index]?.find((each) => each.kind === "adf:stand")
    if (stand === undefined) continue
    const groupId = identity(children, group)
    const shape = paintAttribute(stand, "shape")
    const picture = paintAttribute(stand, "picture")
    if (groupId === null || shape === null || picture === null) continue
    const marker = {
      x: numberAttr(stand, "x"),
      y: numberAttr(stand, "y"),
      cx: numberAttr(stand, "cx"),
      cy: numberAttr(stand, "cy"),
    }
    const box = boxOf(children, properties)
    const drawing = (children[group.index] ?? []).filter((each) => isShapeTag(each.kind))
    const first = drawing[0]
    const second = drawing[1]
    const matched =
      marker.x !== null &&
      marker.y !== null &&
      marker.cx !== null &&
      marker.cy !== null &&
      box !== null &&
      box.x === marker.x &&
      box.y === marker.y &&
      box.cx === marker.cx &&
      box.cy === marker.cy &&
      drawing.length === 2 &&
      first?.kind === "p:pic" &&
      second !== undefined &&
      identity(children, first) === picture &&
      identity(children, second) === shape
    records.push({
      group: groupId,
      picture,
      shape,
      matched,
      parent: parentId(elements, children, group),
      stand,
      drops: matched ? storedDrops(children, stand) : [],
    })
  }
  return records
}
