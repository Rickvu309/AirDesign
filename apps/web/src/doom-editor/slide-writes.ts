import { orderKeyBetween, type OrderKey } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { parentSlot, propOf, siblingsOf, slidesOf } from "@/editing/node-props"

type Mint = () => doom.NodeId

export type Added = { readonly slide: doom.NodeId; readonly writes: readonly doom.Write[] }

function deckId(view: doom.Doom): doom.NodeId | null {
  return [...view.nodes.values()].find((node) => node.type === "deck")?.id ?? null
}

function keyOf(view: doom.Doom, id: doom.NodeId | undefined): OrderKey | null {
  return id === undefined ? null : (parentSlot(view, id)?.at ?? null)
}

export function addSlideWrites(
  view: doom.Doom,
  after: doom.NodeId | null,
  mint: Mint,
  start: doom.SlideStart = "titleOnly",
): Added {
  const slides = slidesOf(view)
  const slide = mint()
  const writes: doom.Write[] = []
  const previous = after !== null && slides.includes(after) ? after : slides.at(-1)
  let row = previous === undefined ? undefined : parentSlot(view, previous)?.id
  if (row === undefined) {
    const deck = deckId(view)
    row = (deck === null ? [] : siblingsOf(view, deck)).findLast(
      (each) => propOf(view.nodes.get(each), "hidden") !== true,
    )
    if (row === undefined) {
      row = mint()
      const rowAt = deck === null ? null : keyOf(view, siblingsOf(view, deck).at(-1))
      writes.push(
        { node: row, prop: "type", value: "slideRow" },
        { node: row, prop: "parent", value: { id: deck as doom.NodeId, at: orderKeyBetween(rowAt, null) } },
      )
    }
  }
  const order = siblingsOf(view, row)
  const index = previous === undefined ? -1 : order.indexOf(previous)
  const at = orderKeyBetween(keyOf(view, order[index]), keyOf(view, order[index + 1]))
  writes.push(
    { node: slide, prop: "type", value: "slide" },
    { node: slide, prop: "parent", value: { id: row, at } },
    { node: slide, prop: "name", value: `Slide ${String(slides.length + 1)}` },
  )
  const fills = previous === undefined ? undefined : propOf(view.nodes.get(previous), "fills")
  if (fills !== undefined) writes.push({ node: slide, prop: "fills", value: fills })
  const withSlide = doom.applyEdit(view, {
    once: "slide-added",
    author: { kind: "person", id: "slide-start" },
    writes,
    rev: doom.rev(view.rev + 1),
  })
  if (!doom.isRefusal(withSlide)) writes.push(...doom.slideStartWrites(withSlide, slide, mint, start))
  return { slide, writes }
}

export type Copied = { readonly slides: readonly doom.NodeId[]; readonly writes: readonly doom.Write[] }

export function duplicateSlideWrites(view: doom.Doom, slides: readonly doom.NodeId[], mint: Mint): Copied {
  const copies = doom.duplicateWrites(view, slides, mint)
  return { slides: copies.roots, writes: copies.writes }
}

export function deleteSlideWrites(view: doom.Doom, removed: readonly doom.NodeId[]): readonly doom.Write[] {
  const slides = slidesOf(view)
  const gone = new Set(removed)
  if (!slides.some((slide) => gone.has(slide))) return []
  return slides.filter((slide) => gone.has(slide)).map((slide) => ({ node: slide, prop: "parent", value: null }))
}

export function neighbourAfterDelete(view: doom.Doom, removed: readonly doom.NodeId[]): doom.NodeId | null {
  const slides = slidesOf(view)
  const gone = new Set(removed)
  const first = slides.findIndex((slide) => gone.has(slide))
  const kept = (slide: doom.NodeId) => !gone.has(slide)
  return slides.slice(first + 1).find(kept) ?? slides.slice(0, Math.max(first, 0)).findLast(kept) ?? null
}

export function moveSlideWrites(view: doom.Doom, moved: readonly doom.NodeId[], at: number): readonly doom.Write[] {
  const slides = slidesOf(view)
  const held = slides.filter((slide) => moved.includes(slide))
  if (held.length === 0) return []
  const others = slides.filter((slide) => !held.includes(slide))
  const place = slides.slice(0, Math.max(0, at)).filter((slide) => !held.includes(slide)).length
  const order = [...others.slice(0, place), ...held, ...others.slice(place)]
  if (order.every((slide, index) => slide === slides[index])) return []
  const before = others[place - 1]
  const next = others[place]
  const anchor = next ?? before
  const row = anchor === undefined ? undefined : parentSlot(view, anchor)?.id
  if (anchor === undefined || row === undefined) return []
  let low = before !== undefined && parentSlot(view, before)?.id === row ? keyOf(view, before) : null
  const high = next !== undefined && parentSlot(view, next)?.id === row ? keyOf(view, next) : null
  return held.map((slide) => {
    low = orderKeyBetween(low, high)
    return { node: slide, prop: "parent", value: { id: row, at: low } }
  })
}
