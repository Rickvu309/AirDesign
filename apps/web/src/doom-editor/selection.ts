import * as doom from "@airdesign/doom"
import { ancestorsOf, type Placed, type SlideGeometry } from "./slide-geometry"
import { intersects } from "./hit-test"

export type Selection = { readonly ids: readonly doom.NodeId[]; readonly inside: doom.NodeId | null }

export const noSelection: Selection = { ids: [], inside: null }

export type Locked = (id: doom.NodeId) => boolean

function insideOf(chain: readonly Placed[], unit: Placed): doom.NodeId | null {
  const index = chain.indexOf(unit)
  return index > 0 ? chain[index - 1]!.id : null
}

export function unitOf(chain: readonly Placed[], inside: doom.NodeId | null, deep: boolean): Placed {
  if (deep) return chain[chain.length - 1]!
  const index = inside === null ? -1 : chain.findIndex((placed) => placed.id === inside)
  return index < 0 ? chain[0]! : (chain[index + 1] ?? chain[index]!)
}

export function same(one: Selection, other: Selection): boolean {
  return (
    one.inside === other.inside &&
    one.ids.length === other.ids.length &&
    one.ids.every((id, at) => id === other.ids[at])
  )
}

export function picked(
  chain: readonly Placed[],
  selection: Selection,
  how: { readonly shift: boolean; readonly deep: boolean },
): Selection {
  const unit = unitOf(chain, selection.inside, how.deep)
  if (!how.shift) return { ids: [unit.id], inside: insideOf(chain, unit) }
  const ids = selection.ids.includes(unit.id)
    ? selection.ids.filter((id) => id !== unit.id)
    : [...selection.ids, unit.id]
  return { ids, inside: ids.length === 0 ? null : insideOf(chain, unit) }
}

export function steppedIn(chain: readonly Placed[], selection: Selection): Selection | null {
  const [id] = selection.ids
  if (selection.ids.length !== 1 || id === undefined) return null
  const index = chain.findIndex((placed) => placed.id === id)
  const next = index < 0 ? undefined : chain[index + 1]
  return next === undefined ? null : { ids: [next.id], inside: id }
}

export function steppedOut(geometry: SlideGeometry, selection: Selection): Selection {
  const [id] = selection.ids
  if (id === undefined) return noSelection
  const parent = geometry.byId.get(id)?.parent ?? null
  if (parent === null) return noSelection
  const chain = ancestorsOf(geometry, parent)
  return { ids: [parent], inside: chain.length > 1 ? chain[chain.length - 2]!.id : null }
}

export type Rect = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }

export function rectBetween(
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
): Rect {
  return {
    left: Math.min(from.x, to.x),
    top: Math.min(from.y, to.y),
    right: Math.max(from.x, to.x),
    bottom: Math.max(from.y, to.y),
  }
}

function leaves(placed: readonly Placed[]): readonly Placed[] {
  return placed.flatMap((each) => (each.children.length === 0 ? [each] : leaves(each.children)))
}

export function marqueeSelection(
  geometry: SlideGeometry,
  rect: Rect,
  how: { readonly deep: boolean; readonly locked: Locked },
): readonly doom.NodeId[] {
  const candidates = how.deep ? leaves(geometry.roots) : geometry.roots
  return candidates.filter((each) => intersects(each, rect) && !how.locked(each.id)).map((each) => each.id)
}

export function kept(selection: Selection, geometry: SlideGeometry): Selection {
  const ids = selection.ids.filter((id) => geometry.byId.has(id))
  if (ids.length === selection.ids.length && (selection.inside === null || geometry.byId.has(selection.inside)))
    return selection
  return {
    ids,
    inside:
      ids.length === 0 || (selection.inside !== null && !geometry.byId.has(selection.inside)) ? null : selection.inside,
  }
}

export function allIn(geometry: SlideGeometry, selection: Selection, locked: Locked): Selection {
  const parent = selection.inside === null ? null : geometry.byId.get(selection.inside)
  const siblings = parent === null || parent === undefined ? geometry.roots : parent.children
  return { ids: siblings.filter((each) => !locked(each.id)).map((each) => each.id), inside: selection.inside }
}
