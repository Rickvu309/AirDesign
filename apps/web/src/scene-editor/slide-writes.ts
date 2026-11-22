import { orderKeyBetween, scene, type OrderKey } from "@airdesign/document"
import { duplicateWrites } from "./copy-writes"
import { parentSlot, propOf, siblingsOf, slidesOf } from "./node-props"

type Mint = () => scene.NodeId

export type Added = { readonly slide: scene.NodeId; readonly writes: readonly scene.Write[] }

function deckId(view: scene.Scene): scene.NodeId | null {
  return [...view.nodes.values()].find((node) => node.type === "deck")?.id ?? null
}

function keyOf(view: scene.Scene, id: scene.NodeId | undefined): OrderKey | null {
  return id === undefined ? null : (parentSlot(view, id)?.at ?? null)
}

export type SlideLayout = "blank" | "title"

function titleWrites(view: scene.Scene, slide: scene.NodeId, title: scene.NodeId): readonly scene.Write[] {
  const { size } = scene.deckOf(view)
  const box = {
    x: Math.round(size.w / 12),
    y: Math.round((size.h * 19) / 54),
    w: Math.round((size.w * 5) / 6),
    h: Math.round(size.h / 6.75),
    rotation: 0,
    flipH: false,
    flipV: false,
  }
  return [
    { node: title, prop: "type", value: "shape" },
    { node: title, prop: "parent", value: { id: slide, at: orderKeyBetween(null, null) } },
    { node: title, prop: "name", value: "Title" },
    { node: title, prop: "role", value: "title" },
    { node: title, prop: "box", value: box },
    {
      node: title,
      prop: "text",
      value: { chars: "Title", spans: [], paras: [{}], style: "title", resize: "height", alignV: "top" },
    },
  ]
}

export function addSlideWrites(
  view: scene.Scene,
  after: scene.NodeId | null,
  mint: Mint,
  layout: SlideLayout = "blank",
): Added {
  const slides = slidesOf(view)
  const slide = mint()
  const writes: scene.Write[] = []
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
        { node: row, prop: "parent", value: { id: deck as scene.NodeId, at: orderKeyBetween(rowAt, null) } },
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
  if (layout === "title") writes.push(...titleWrites(view, slide, mint()))
  return { slide, writes }
}

export function duplicateSlideWrites(view: scene.Scene, slide: scene.NodeId, mint: Mint): Added {
  const copies = duplicateWrites(view, [slide], mint)
  return { slide: copies.roots[0] ?? slide, writes: copies.writes }
}

export function deleteSlideWrites(view: scene.Scene, slide: scene.NodeId): readonly scene.Write[] {
  const slides = slidesOf(view)
  return slides.length > 1 && slides.includes(slide) ? [{ node: slide, prop: "parent", value: null }] : []
}

export function neighbourAfterDelete(view: scene.Scene, slide: scene.NodeId): scene.NodeId | null {
  const slides = slidesOf(view)
  const index = slides.indexOf(slide)
  return slides[index + 1] ?? slides[index - 1] ?? null
}

export function moveSlideWrites(view: scene.Scene, slide: scene.NodeId, to: number): readonly scene.Write[] {
  const slides = slidesOf(view)
  const from = slides.indexOf(slide)
  if (from === -1 || from === to) return []
  const others = slides.filter((each) => each !== slide)
  const place = Math.max(0, Math.min(to, others.length))
  const before = others[place - 1]
  const next = others[place]
  const anchor = next ?? before
  const row = anchor === undefined ? undefined : parentSlot(view, anchor)?.id
  if (anchor === undefined || row === undefined) return []
  const low = before !== undefined && parentSlot(view, before)?.id === row ? keyOf(view, before) : null
  const high = next !== undefined && parentSlot(view, next)?.id === row ? keyOf(view, next) : null
  return [{ node: slide, prop: "parent", value: { id: row, at: orderKeyBetween(low, high) } }]
}
