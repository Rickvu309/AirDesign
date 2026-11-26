import * as doom from "@airdesign/doom"
import { gridAnchor, gridMovePlacement, sameGroups, type GridMoveSide } from "./grid-move"

type Mint = () => doom.NodeId

export type Added = { readonly slide: doom.NodeId; readonly writes: readonly doom.Write[] }

function deckId(view: doom.Doom): doom.NodeId | null {
  return [...view.nodes.values()].find((node) => node.type === "deck")?.id ?? null
}

function keyed(nodes: readonly (doom.Node | undefined)[]): readonly doom.Keyed[] {
  return nodes.flatMap((node) => {
    const place = doom.parentOf(node)
    return node === undefined || place == null ? [] : [{ id: node.id, at: place.at }]
  })
}

function placeWrites(
  parent: doom.NodeId,
  siblings: readonly doom.Keyed[],
  index: number,
  placed: readonly doom.NodeId[],
): readonly doom.Write[] {
  const { keys, shifted } = doom.siblingKeys(siblings, index, placed.length)
  return [
    ...placed.map((node, offset) => ({ node, prop: "parent" as const, value: { id: parent, at: keys[offset]! } })),
    ...shifted.map((each) => ({ node: each.id, prop: "parent" as const, value: { id: parent, at: each.at } })),
  ]
}

export type SlideGroup = { readonly group: doom.NodeId; readonly slides: readonly doom.NodeId[] }

export function slideGroupsOf(view: doom.Doom): readonly SlideGroup[] {
  const groups: { group: doom.NodeId; slides: doom.NodeId[] }[] = []
  for (const slide of doom.slidesOf(view)) {
    const group = doom.parentOf(slide)?.id
    if (group === undefined) continue
    const last = groups.at(-1)
    if (last?.group === group) last.slides.push(slide.id)
    else groups.push({ group, slides: [slide.id] })
  }
  return groups
}

function groupBelow(view: doom.Doom, above: doom.NodeId, mint: Mint): { group: doom.NodeId; writes: doom.Write[] } {
  const groups = slideGroupsOf(view)
  const deck = doom.parentOf(view.nodes.get(above))
  const group = mint()
  if (deck == null) return { group, writes: [] }
  const rows = keyed(groups.map((each) => view.nodes.get(each.group)))
  const at = groups.findIndex((each) => each.group === above) + 1
  return {
    group,
    writes: [{ node: group, prop: "type", value: "slideRow" }, ...placeWrites(deck.id, rows, at, [group])],
  }
}

export function addSlideWrites(
  view: doom.Doom,
  after: doom.NodeId | null,
  mint: Mint,
  start: doom.SlideStart = "titleOnly",
  measure?: doom.Measure,
  side: "same" | "new" = "same",
): Added {
  const slides = doom.slidesOf(view).map((each) => each.id)
  const slide = mint()
  const writes: doom.Write[] = []
  const previous = after !== null && slides.includes(after) ? after : slides.at(-1)
  let row = previous === undefined ? undefined : doom.parentOf(view.nodes.get(previous))?.id
  if (side === "new" && row !== undefined) {
    const below = groupBelow(view, row, mint)
    writes.push(...below.writes)
    row = below.group
  }
  if (row === undefined) {
    const deck = deckId(view)
    const deckRows = deck === null ? [] : doom.childrenOf(view, deck)
    row = deckRows.findLast((each) => each.type === "slideRow" && doom.propOf(each, "hidden") !== true)?.id
    if (row === undefined) {
      row = mint()
      const rowAt = doom.parentOf(deckRows.at(-1))?.at ?? null
      writes.push(
        { node: row, prop: "type", value: "slideRow" },
        { node: row, prop: "parent", value: { id: deck as doom.NodeId, at: doom.orderKeyBetween(rowAt, null) } },
      )
    }
  }
  const order = keyed(doom.childrenOf(view, row))
  const index = previous === undefined || side === "new" ? -1 : order.findIndex((each) => each.id === previous)
  writes.push({ node: slide, prop: "type", value: "slide" }, ...placeWrites(row, order, index + 1, [slide]), {
    node: slide,
    prop: "name",
    value: `Slide ${String(slides.length + 1)}`,
  })
  const fills = previous === undefined ? undefined : doom.propOf(view.nodes.get(previous), "fills")
  if (fills !== undefined) writes.push({ node: slide, prop: "fills", value: fills })
  const withSlide = doom.applyEdit(view, {
    once: "slide-added",
    author: { kind: "person", id: "slide-start" },
    writes,
    rev: doom.rev(view.rev + 1),
  })
  if (!doom.isRefusal(withSlide)) writes.push(...doom.slideStartWrites(withSlide, slide, mint, start, measure))
  return { slide, writes }
}

export type Copied = { readonly slides: readonly doom.NodeId[]; readonly writes: readonly doom.Write[] }

export function duplicateSlideWrites(view: doom.Doom, slides: readonly doom.NodeId[], mint: Mint): Copied {
  const copies = doom.duplicateWrites(view, slides, mint)
  return { slides: copies.roots, writes: copies.writes }
}

export function deleteSlideWrites(view: doom.Doom, removed: readonly doom.NodeId[]): readonly doom.Write[] {
  const slides = doom.slidesOf(view).map((each) => each.id)
  const gone = new Set(removed)
  if (!slides.some((slide) => gone.has(slide))) return []
  return slides.filter((slide) => gone.has(slide)).map((slide) => ({ node: slide, prop: "parent", value: null }))
}

export function neighbourAfterDelete(view: doom.Doom, removed: readonly doom.NodeId[]): doom.NodeId | null {
  const slides = doom.slidesOf(view).map((each) => each.id)
  const gone = new Set(removed)
  const first = slides.findIndex((slide) => gone.has(slide))
  const kept = (slide: doom.NodeId) => !gone.has(slide)
  return slides.slice(first + 1).find(kept) ?? slides.slice(0, Math.max(first, 0)).findLast(kept) ?? null
}

export function moveSlideWrites(
  view: doom.Doom,
  moved: readonly doom.NodeId[],
  at: number,
  onto?: doom.NodeId,
): readonly doom.Write[] {
  const slides = doom.slidesOf(view).map((each) => each.id)
  const held = slides.filter((slide) => moved.includes(slide))
  if (held.length === 0) return []
  const others = slides.filter((slide) => !held.includes(slide))
  const place = slides.slice(0, Math.max(0, at)).filter((slide) => !held.includes(slide)).length
  const order = [...others.slice(0, place), ...held, ...others.slice(place)]
  if (order.every((slide, index) => slide === slides[index])) return []
  const before = others[place - 1]
  const next = others[place]
  const anchor = (onto !== undefined && [before, next].includes(onto) ? onto : undefined) ?? next ?? before
  const row = anchor === undefined ? undefined : doom.parentOf(view.nodes.get(anchor))?.id
  if (anchor === undefined || row === undefined) return []
  const siblings = keyed(doom.childrenOf(view, row)).filter((each) => !held.includes(each.id))
  const index = before === undefined ? -1 : siblings.findIndex((each) => each.id === before)
  return placeWrites(row, siblings, index + 1, held)
}

export function slideGroupMoveWrites(
  view: doom.Doom,
  moved: readonly doom.NodeId[],
  at: number,
  side: GridMoveSide,
  mint: Mint,
): readonly doom.Write[] {
  const groups = slideGroupsOf(view)
  const before = groups.map((each) => each.slides)
  const sequence = before.flat()
  const held = new Set(moved.filter((slide) => sequence.includes(slide)))
  if (held.size === 0) return []
  const next = gridMovePlacement(before, [...held], gridAnchor(sequence, held, at, side), side)
  if (sameGroups(next, before)) return []
  const groupOf = new Map(groups.flatMap((each) => each.slides.map((slide) => [slide, each.group] as const)))
  const whole = groups.find((each) => each.slides.length === held.size && each.slides.every((id) => held.has(id)))
  const deck = doom.parentOf(view.nodes.get(groups[0]?.group ?? doom.nodeId("")))?.id
  if (deck === undefined) return []
  const placed = next.map((slides) => {
    const kept = slides.find((slide) => !held.has(slide))
    return kept === undefined ? (whole?.group ?? null) : (groupOf.get(kept) ?? null)
  })
  return next.flatMap((slides, number): readonly doom.Write[] => {
    const known = placed[number] ?? null
    if (slides.every((slide) => held.has(slide))) {
      const rows = keyed(
        placed.flatMap((row, other) => (other === number || row === null ? [] : [view.nodes.get(row)])),
      )
      if (known !== null) return placeWrites(deck, rows, number, [known])
      const group = mint()
      return [
        { node: group, prop: "type", value: "slideRow" },
        ...placeWrites(deck, rows, number, [group]),
        ...placeWrites(group, [], 0, slides),
      ]
    }
    const first = slides.findIndex((slide) => held.has(slide))
    if (known === null || first === -1) return []
    const siblings = keyed(doom.childrenOf(view, known)).filter((each) => !held.has(each.id))
    return placeWrites(
      known,
      siblings,
      first,
      slides.filter((slide) => held.has(slide)),
    )
  })
}
