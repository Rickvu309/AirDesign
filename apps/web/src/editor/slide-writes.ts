import { orderKeyBetween, type OrderKey } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { gridAnchor, gridMovePlacement, sameGroups, type GridMoveSide } from "./grid-move"

type Mint = () => doom.NodeId

export type Added = { readonly slide: doom.NodeId; readonly writes: readonly doom.Write[] }

function deckId(view: doom.Doom): doom.NodeId | null {
  return [...view.nodes.values()].find((node) => node.type === "deck")?.id ?? null
}

function keyOf(view: doom.Doom, id: doom.NodeId | undefined): OrderKey | null {
  return id === undefined ? null : (doom.parentOf(view.nodes.get(id))?.at ?? null)
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
  const at = groups.findIndex((each) => each.group === above)
  const place = doom.parentOf(view.nodes.get(above))
  const next = doom.parentOf(view.nodes.get(groups[at + 1]?.group ?? above))
  const group = mint()
  if (place == null) return { group, writes: [] }
  const key = orderKeyBetween(place.at, next !== undefined && next !== null && next.at > place.at ? next.at : null)
  return {
    group,
    writes: [
      { node: group, prop: "type", value: "slideRow" },
      { node: group, prop: "parent", value: { id: place.id, at: key } },
    ],
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
        { node: row, prop: "parent", value: { id: deck as doom.NodeId, at: orderKeyBetween(rowAt, null) } },
      )
    }
  }
  const order = doom.childrenOf(view, row)
  const index = previous === undefined || side === "new" ? -1 : order.findIndex((each) => each.id === previous)
  const at = orderKeyBetween(doom.parentOf(order[index])?.at ?? null, doom.parentOf(order[index + 1])?.at ?? null)
  writes.push(
    { node: slide, prop: "type", value: "slide" },
    { node: slide, prop: "parent", value: { id: row, at } },
    { node: slide, prop: "name", value: `Slide ${String(slides.length + 1)}` },
  )
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
  let low = before !== undefined && doom.parentOf(view.nodes.get(before))?.id === row ? keyOf(view, before) : null
  const high = next !== undefined && doom.parentOf(view.nodes.get(next))?.id === row ? keyOf(view, next) : null
  return held.map((slide) => {
    low = orderKeyBetween(low, high)
    return { node: slide, prop: "parent", value: { id: row, at: low } }
  })
}

function keysBetween(low: OrderKey | null, high: OrderKey | null, count: number): readonly OrderKey[] {
  const keys: OrderKey[] = []
  let at = low
  for (let made = 0; made < count; made += 1) {
    at = orderKeyBetween(at, high)
    keys.push(at)
  }
  return keys
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
  const writes: doom.Write[] = []
  next.forEach((slides, number) => {
    const known = placed[number] ?? null
    const kept = slides.some((slide) => !held.has(slide))
    if (!kept) {
      const keyOfGroup = (each: doom.NodeId | null | undefined) =>
        each === null || each === undefined ? null : (doom.parentOf(view.nodes.get(each))?.at ?? null)
      const key = orderKeyBetween(keyOfGroup(placed[number - 1]), keyOfGroup(placed[number + 1]))
      if (known !== null) {
        writes.push({ node: known, prop: "parent", value: { id: deck, at: key } })
        return
      }
      const group = mint()
      writes.push(
        { node: group, prop: "type", value: "slideRow" },
        { node: group, prop: "parent", value: { id: deck, at: key } },
      )
      keysBetween(null, null, slides.length).forEach((at, offset) =>
        writes.push({ node: slides[offset]!, prop: "parent", value: { id: group, at } }),
      )
      return
    }
    if (known === null) return
    const first = slides.findIndex((slide) => held.has(slide))
    if (first === -1) return
    const run = slides.filter((slide) => held.has(slide))
    const low = first === 0 ? null : keyOf(view, slides[first - 1])
    const high = keyOf(view, slides[first + run.length])
    keysBetween(low, high, run.length).forEach((at, offset) =>
      writes.push({ node: run[offset]!, prop: "parent", value: { id: known, at } }),
    )
  })
  const left = new Set(placed)
  for (const each of groups)
    if (!left.has(each.group) && each.slides.every((slide) => held.has(slide)))
      writes.push({ node: each.group, prop: "parent", value: null })
  return writes
}
