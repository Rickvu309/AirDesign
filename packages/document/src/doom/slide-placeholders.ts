import { orderKeyBetween } from "../order-key.js"
import type { Write } from "./doom.js"
import type { NodeId } from "./ids.js"
import { placeholderTitle } from "./placeholder-title.js"
import type { Text } from "./text.js"

export const placeholderSubtitle = "Subtitle"

type Size = { readonly w: number; readonly h: number }

const upright = { rotation: 0, flipH: false, flipV: false } as const
const marginShare = 1 / 12
const gapShare = 1 / 60
const middleShare = 1 / 2
const titleHighShare = 2 / 11
const subtitleHighShare = 1 / 8
const titleTopShare = 2 / 27
const titleOnlyHighShare = 1 / 9

const titleText = (resize: Text["resize"], alignV: Text["alignV"]): Text => ({
  chars: placeholderTitle,
  spans: [],
  paras: [{}],
  style: "title",
  resize,
  alignV,
})

const subtitleText: Text = {
  chars: placeholderSubtitle,
  spans: [{ end: placeholderSubtitle.length, color: { var: "text2" } }],
  paras: [{}],
  style: "body",
  resize: "fixed",
  alignV: "top",
}

function placeholder(
  node: NodeId,
  slide: NodeId,
  at: string,
  name: string,
  role: "title" | "subtitle",
  box: { x: number; y: number; w: number; h: number },
  text: Text,
): readonly Write[] {
  return [
    { node, prop: "type", value: "shape" },
    { node, prop: "parent", value: { id: slide, at: at as never } },
    { node, prop: "name", value: name },
    { node, prop: "role", value: role },
    { node, prop: "box", value: { ...box, ...upright } },
    { node, prop: "text", value: text },
  ]
}

export function titleSlideWrites(slide: NodeId, mint: () => NodeId, size: Size): readonly Write[] {
  const x = Math.round(size.w * marginShare)
  const w = size.w - 2 * x
  const gap = Math.round(size.w * gapShare)
  const bottom = Math.round(size.h * middleShare)
  const high = Math.round(size.h * titleHighShare)
  const first = orderKeyBetween(null, null)
  return [
    ...placeholder(
      mint(),
      slide,
      first,
      "Title",
      "title",
      { x, y: bottom - high, w, h: high },
      titleText("fixed", "bottom"),
    ),
    ...placeholder(
      mint(),
      slide,
      orderKeyBetween(first, null),
      "Subtitle",
      "subtitle",
      { x, y: bottom + gap, w, h: Math.round(size.h * subtitleHighShare) },
      subtitleText,
    ),
  ]
}

export function titleOnlyWrites(slide: NodeId, mint: () => NodeId, size: Size): readonly Write[] {
  const x = Math.round(size.w * marginShare)
  return placeholder(
    mint(),
    slide,
    orderKeyBetween(null, null),
    "Title",
    "title",
    { x, y: Math.round(size.h * titleTopShare), w: size.w - 2 * x, h: Math.round(size.h * titleOnlyHighShare) },
    titleText("height", "top"),
  )
}
