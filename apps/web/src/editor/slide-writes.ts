import * as doom from "@airdesign/doom"
import { gridAnchor, gridMovePlacement, sameGroups, type GridMoveSide } from "./grid-move"

type Mint = () => doom.NodeId

export type Added = { readonly slide: doom.NodeId; readonly writes: readonly doom.Write[] }

export type SlideGroup = doom.SlideGroup

export const slideGroupsOf = doom.slideGroups

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
  const previous = after !== null && slides.includes(after) ? after : slides.at(-1)
  const previousGroup = previous === undefined ? undefined : doom.parentOf(view.nodes.get(previous))?.id
  const row = previousGroup ?? doom.slideRowAt(view, "last")
  const placement =
    row === undefined || (side === "new" && previousGroup !== undefined)
      ? doom.slidePlacementWrites(view, {
          kind: "newGroup",
          group: mint(),
          slides: [slide],
          ...(previousGroup === undefined ? {} : { after: previousGroup }),
        })
      : doom.slidePlacementWrites(view, { kind: "slides", group: row, slides: [slide], after: previous ?? null })
  const writes: doom.Write[] = [
    { node: slide, prop: "type", value: "slide" },
    ...placement,
    { node: slide, prop: "name", value: `Slide ${String(slides.length + 1)}` },
  ]
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
  const after = before !== undefined && doom.parentOf(view.nodes.get(before))?.id === row ? before : null
  return doom.slidePlacementWrites(view, { kind: "slides", group: row, slides: held, after })
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
  const placed = next.map((slides) => {
    const kept = slides.find((slide) => !held.has(slide))
    return kept === undefined ? (whole?.group ?? null) : (groupOf.get(kept) ?? null)
  })
  return next.flatMap((slides, number): readonly doom.Write[] => {
    const known = placed[number] ?? null
    if (slides.every((slide) => held.has(slide))) {
      const after = placed[number - 1] ?? null
      return known === null
        ? doom.slidePlacementWrites(view, { kind: "newGroup", group: mint(), slides, after })
        : doom.slidePlacementWrites(view, { kind: "moveGroup", group: known, anchor: after, side: "after" })
    }
    const first = slides.findIndex((slide) => held.has(slide))
    if (known === null || first === -1) return []
    return doom.slidePlacementWrites(view, {
      kind: "slides",
      group: known,
      after: slides[first - 1] ?? null,
      slides: slides.filter((slide) => held.has(slide)),
    })
  })
}
