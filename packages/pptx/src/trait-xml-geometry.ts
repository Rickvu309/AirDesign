import { presetAdjusts } from "@airdesign/document"
import { insertChildAt } from "./child-order.js"
import { spliceBytes, type ByteEdit } from "./element-span.js"
import { shownGeometry, type Geometry } from "./geometry-read.js"
import { encodeUtf8, sameBytes } from "./package-bytes.js"
import { partBytes, requireMarkup } from "./part-markup.js"
import { isShapeTag, shapeById, shapeTags } from "./shape-tree.js"
import { markupChildren } from "./text-value-route.js"
import { whole, type ElementAt, type Parts, type TraitXml } from "./xml-codec.js"

const geometryKinds = new Set(["a:prstGeom", "a:custGeom"])

export function presetMarkup(
  preset: string,
  named: readonly string[],
  adjust: Readonly<Record<string, number>>,
): string {
  const guides = named
    .filter((name) => Object.hasOwn(adjust, name))
    .map((name) => `<a:gd name="${name}" fmla="val ${String(adjust[name])}"/>`)
    .join("")
  return `<a:prstGeom prst="${preset}">${guides === "" ? "<a:avLst/>" : `<a:avLst>${guides}</a:avLst>`}</a:prstGeom>`
}

export function geometryMarkup(geometry: Geometry): string {
  return presetMarkup(geometry.preset, presetAdjusts[geometry.preset], geometry.adjust)
}

function writtenGeometry(parts: Parts, at: ElementAt, geometry: Geometry): Parts {
  return writtenMarkup(parts, at, geometryMarkup(geometry))
}

export function writtenMarkup(parts: Parts, at: ElementAt, xml: string): Parts {
  const bytes = partBytes(parts, at.part)
  const { elements } = requireMarkup(bytes)
  const children = markupChildren(elements)
  const shape = shapeById(elements, at.shape)
  const tag = isShapeTag(shape.kind) ? shapeTags[shape.kind].properties : null
  if (tag !== "p:spPr") throw new Error("geometry-shape")
  const properties = (children[shape.index] ?? []).filter((item) => item.kind === tag)
  const spPr = properties[0]
  if (properties.length !== 1 || spPr === undefined) throw new Error("geometry-properties")
  const spChildren = children[spPr.index] ?? []
  const held = spChildren.filter((item) => geometryKinds.has(item.kind))
  if (held.length > 1) throw new Error("geometry-choice")
  const own = held[0]
  let edit: ByteEdit
  if (own !== undefined) edit = { start: own.start, end: own.end, next: encodeUtf8(xml) }
  else if (spPr.selfClosing) edit = { start: spPr.openEnd - 2, end: spPr.openEnd, next: encodeUtf8(`>${xml}</p:spPr>`) }
  else {
    const spot = insertChildAt("p:spPr", "a:prstGeom", spPr, spChildren)
    edit = { start: spot, end: spot, next: encodeUtf8(xml) }
  }
  const next = spliceBytes(bytes, [edit])
  if (sameBytes(next, bytes)) return parts
  const changed = new Map(parts)
  changed.set(at.part, next)
  return changed
}

export const geometryXml: TraitXml<"geometry"> = {
  slot: null,
  fields: {
    shape: whole({
      read: (parts, at) => shownGeometry(parts, at)?.value ?? null,
      write: writtenGeometry,
    }),
  },
}
