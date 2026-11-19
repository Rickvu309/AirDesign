import { readElementId, type ElementId } from "@airdesign/document"
import { readShapes, shownIdentity, type ReadShape } from "@airdesign/pptx"
import { plainNames } from "@/design/node-names"
import type { LayerFlow, LayerKind, LayerRow } from "./layer-tree"

type Parts = ReadonlyMap<string, Uint8Array>

export type LayerLook = { readonly kind: LayerKind; readonly backdrop?: ElementId; readonly flow?: LayerFlow }

const shapesRead = new WeakMap<Parts, readonly ReadShape[]>()

function shapesOf(parts: Parts): readonly ReadShape[] {
  const known = shapesRead.get(parts)
  if (known !== undefined) return known
  const read = readShapes(parts)
  shapesRead.set(parts, read)
  return read
}

export function slideLayerRows(parts: Parts, slide: string, look: (node: ElementId) => LayerLook): readonly LayerRow[] {
  const found = shapesOf(parts).flatMap((shape) => {
    const node = shape.slide === slide ? readElementId(`${slide}.${shape.shape}`) : undefined
    if (node === undefined) return []
    const parent = shape.group === undefined ? null : (readElementId(`${slide}.${shape.group}`) ?? null)
    const identity = shownIdentity(parts, { slide, part: shape.part, shape: shape.shape })
    return [{ node, parent, look: look(node), name: identity?.name ?? "", hidden: identity?.hidden === true }]
  })
  const backdrops = new Set(found.flatMap((each) => (each.look.backdrop === undefined ? [] : [each.look.backdrop])))
  const kept = found.filter((each) => !backdrops.has(each.node))
  const names = plainNames(kept.map((each) => ({ name: each.name, kind: each.look.kind })))
  return kept.map((each, at) => ({
    node: each.node,
    parent: each.parent,
    name: names[at] ?? each.name,
    kind: each.look.kind,
    hidden: each.hidden,
    ...(each.look.flow === undefined ? {} : { flow: each.look.flow }),
  }))
}
