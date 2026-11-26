import type { Doom, Write } from "./doom.js"
import { childrenOf, deckOf, parentOf, slidesOf } from "./doom-walk.js"
import type { NodeId } from "./ids.js"
import { type Keyed, siblingKeys } from "./sibling-keys.js"

export type SlideGroup = { readonly group: NodeId; readonly slides: readonly NodeId[] }

export function slideGroups(doom: Doom): readonly SlideGroup[] {
  const groups: { group: NodeId; slides: NodeId[] }[] = []
  for (const slide of slidesOf(doom)) {
    const group = parentOf(slide)?.id
    if (group === undefined) continue
    const last = groups.at(-1)
    if (last?.group === group) last.slides.push(slide.id)
    else groups.push({ group, slides: [slide.id] })
  }
  return groups
}

function placeAmong(
  parent: NodeId,
  siblings: readonly Keyed[],
  index: number,
  placed: readonly NodeId[],
): readonly Write[] {
  const { keys, shifted } = siblingKeys(siblings, index, placed.length)
  return [
    ...placed.map((node, offset) => ({ node, prop: "parent" as const, value: { id: parent, at: keys[offset]! } })),
    ...shifted.map((each) => ({ node: each.id, prop: "parent" as const, value: { id: parent, at: each.at } })),
  ]
}

type SlidePlacement =
  | {
      readonly kind: "slides"
      readonly group: NodeId
      readonly slides: readonly NodeId[]
      readonly after: NodeId | null
    }
  | {
      readonly kind: "newGroup"
      readonly group: NodeId
      readonly slides: readonly NodeId[]
      readonly after?: NodeId | null
    }
  | {
      readonly kind: "moveGroup"
      readonly group: NodeId
      readonly anchor: NodeId | null
      readonly side: "before" | "after"
    }

function keysOf(doom: Doom, ids: readonly NodeId[]): readonly Keyed[] {
  return ids.flatMap((id) => {
    const at = parentOf(doom.nodes.get(id))?.at
    return at === undefined ? [] : [{ id, at }]
  })
}

export function slidePlacementWrites(doom: Doom, place: SlidePlacement): readonly Write[] {
  if (place.kind === "slides") {
    const held = new Set(place.slides)
    const remaining = childrenOf(doom, place.group)
      .map((node) => node.id)
      .filter((id) => !held.has(id))
    const index = place.after === null ? 0 : remaining.indexOf(place.after) + 1
    return placeAmong(place.group, keysOf(doom, remaining), index, place.slides)
  }
  const deck = deckOf(doom)
  if (deck === undefined) return []
  const groups = slideGroups(doom).map((group) => group.group)
  const from = groups.indexOf(place.group)
  const remaining = groups.filter((group) => group !== place.group)
  const anchor = place.kind === "moveGroup" ? place.anchor : place.after
  const offset = place.kind === "moveGroup" && place.side === "before" ? 0 : 1
  const index = anchor === undefined ? remaining.length : anchor === null ? 0 : remaining.indexOf(anchor) + offset
  if (place.kind === "moveGroup" && from === index) return []
  const placed = placeAmong(deck.id, keysOf(doom, remaining), index, [place.group])
  if (place.kind === "moveGroup") return placed
  return [
    { node: place.group, prop: "type", value: "slideRow" },
    ...placed,
    ...placeAmong(place.group, [], 0, place.slides),
  ]
}
