import { orderKeyBetween, scene } from "@airdesign/document"
import { parentSlot, siblingsOf } from "./node-props"

type Point = { readonly x: number; readonly y: number }
type Natural = { readonly width: number; readonly height: number }
type Size = { readonly w: number; readonly h: number }

export function pictureBox(natural: Natural, slide: Size, at: Point | null): scene.Box {
  const width = Math.max(1, natural.width)
  const height = Math.max(1, natural.height)
  const scale = Math.min(1, slide.w / width, slide.h / height)
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))
  const centre = at ?? { x: slide.w / 2, y: slide.h / 2 }
  const x = Math.min(Math.max(0, Math.round(centre.x - w / 2)), Math.max(0, slide.w - w))
  const y = Math.min(Math.max(0, Math.round(centre.y - h / 2)), Math.max(0, slide.h - h))
  return { x, y, w, h, rotation: 0, flipH: false, flipV: false }
}

export function pictureWrites(
  view: scene.Scene,
  slide: scene.NodeId,
  id: scene.NodeId,
  asset: string,
  natural: Natural,
  at: Point | null,
): readonly scene.Write[] {
  const last = siblingsOf(view, slide).at(-1)
  const above = last === undefined ? null : (parentSlot(view, last)?.at ?? null)
  return [
    { node: id, prop: "type", value: "shape" },
    { node: id, prop: "parent", value: { id: slide, at: orderKeyBetween(above, null) } },
    { node: id, prop: "box", value: pictureBox(natural, scene.deckOf(view).size, at) },
    { node: id, prop: "geometry", value: { kind: "rect" } },
    { node: id, prop: "fills", value: [{ kind: "image", asset, fit: "fill" }] },
  ]
}
