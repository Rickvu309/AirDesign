import * as doom from "@airdesign/doom"
import { gridAnchor, gridMovePlacement, sameGroups, type GridMoveSide } from "./grid-move"
import { compiledIntents, intentWrites, madeOf } from "./editor-intents"
import { placementRules, startRules } from "@airdesign/taste"

type Mint = () => doom.NodeId

export type Added = { readonly slide: doom.NodeId; readonly writes: readonly doom.Write[] }

export type Copied = { readonly slides: readonly doom.NodeId[]; readonly writes: readonly doom.Write[] }

const writesOf = (view: doom.Doom, intents: readonly doom.Intent[], mint?: Mint): readonly doom.Write[] =>
  intents.length === 0 ? [] : (intentWrites(view, intents, mint === undefined ? {} : { mint })?.writes ?? [])

export function addSlide(
  view: doom.Doom,
  after: doom.NodeId | null,
  mint: Mint,
  start: doom.SlideStart = "titleOnly",
  measure?: doom.Measure,
  side: "same" | "new" = "same",
): Added | doom.Refusal {
  const slides = doom.slidesOf(view).map((each) => each.id)
  const previous = after !== null && slides.includes(after) ? after : slides.at(-1)
  const previousGroup = previous === undefined ? undefined : doom.parentOf(view.nodes.get(previous))?.id
  const intent: doom.Intent =
    side === "new" && previousGroup !== undefined
      ? { op: "insert", kind: "slide", group: "new", after: previousGroup }
      : { op: "insert", kind: "slide", ...(previous === undefined ? {} : { after: previous }) }
  const made = compiledIntents(view, [intent], { mint })
  if (doom.isRefusal(made)) return made
  const slide = madeOf(view, made.writes, "slide")[0]
  if (slide === undefined) return { refused: "missing" }
  const fills = previous === undefined ? undefined : doom.propOf(view.nodes.get(previous), "fills")
  const writes = [
    ...made.writes,
    ...(fills === undefined ? [] : [{ node: slide, prop: "fills" as const, value: fills }]),
  ]
  const withSlide = doom.applyEdit(view, {
    once: "slide-added",
    author: { kind: "person", id: "slide-start" },
    writes,
    rev: doom.rev(view.rev + 1),
  })
  if (doom.isRefusal(withSlide)) return { slide, writes }
  return {
    slide,
    writes: [...writes, ...doom.slideStartWrites(withSlide, slide, mint, start, placementRules, startRules, measure)],
  }
}

export function duplicateSlides(view: doom.Doom, slides: readonly doom.NodeId[], mint: Mint): Copied | doom.Refusal {
  if (slides.length === 0) return { slides: [], writes: [] }
  const made = compiledIntents(view, [{ op: "copy", targets: slides }], { mint })
  return doom.isRefusal(made) ? made : { slides: madeOf(view, made.writes, "slide"), writes: made.writes }
}

export function deleteSlides(view: doom.Doom, removed: readonly doom.NodeId[]): readonly doom.Write[] {
  const gone = new Set(removed)
  const targets = doom
    .slidesOf(view)
    .map((each) => each.id)
    .filter((slide) => gone.has(slide))
  return writesOf(view, targets.length === 0 ? [] : [{ op: "remove", targets }])
}

export function neighbourAfterDelete(view: doom.Doom, removed: readonly doom.NodeId[]): doom.NodeId | null {
  const slides = doom.slidesOf(view).map((each) => each.id)
  const gone = new Set(removed)
  const first = slides.findIndex((slide) => gone.has(slide))
  const kept = (slide: doom.NodeId) => !gone.has(slide)
  return slides.slice(first + 1).find(kept) ?? slides.slice(0, Math.max(first, 0)).findLast(kept) ?? null
}

export function moveSlides(
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
  return writesOf(view, [{ op: "move", targets: held, group: row, after }])
}

export function moveSlideGroups(
  view: doom.Doom,
  moved: readonly doom.NodeId[],
  at: number,
  side: GridMoveSide,
  mint: Mint,
): readonly doom.Write[] {
  const groups = doom.slideGroups(view)
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
  const intents = next.flatMap((slides, number): readonly doom.Intent[] => {
    const known = placed[number] ?? null
    if (slides.every((slide) => held.has(slide))) {
      const after = placed[number - 1] ?? null
      return known === null
        ? [{ op: "move", targets: slides, group: "new", after }]
        : [{ op: "move", targets: [known], after }]
    }
    const first = slides.findIndex((slide) => held.has(slide))
    if (known === null || first === -1) return []
    return [
      {
        op: "move",
        targets: slides.filter((slide) => held.has(slide)),
        group: known,
        after: slides[first - 1] ?? null,
      },
    ]
  })
  return writesOf(view, intents, mint)
}
