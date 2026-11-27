import { orderKeyBetween } from "./order-key.js"
import type { Write } from "./doom.js"
import type { NodeId } from "./ids.js"
import type { Placeholder, StartRules } from "./start-rules.js"
import type { Text } from "./text.js"

type Size = { readonly w: number; readonly h: number }

const upright = { rotation: 0, flipH: false, flipV: false } as const

const titleText = (chars: string, style: Text["style"], alignV: Text["alignV"]): Text => ({
  chars,
  spans: [],
  paras: [{}],
  style,
  resize: "height",
  alignV,
})

const subtitleText = (chars: string): Text => ({
  chars,
  spans: [{ end: chars.length, color: { var: "text2" } }],
  paras: [{}],
  style: "body",
  resize: "fixed",
  alignV: "top",
})

function placeholder(
  node: NodeId,
  slide: NodeId,
  at: string,
  { name }: Placeholder,
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

export function titleSlideWrites(slide: NodeId, mint: () => NodeId, size: Size, starts: StartRules): readonly Write[] {
  const x = Math.round(size.w * starts.marginShare)
  const w = size.w - 2 * x
  const gap = Math.round(size.w * starts.gapShare)
  const bottom = Math.round(size.h * starts.middleShare)
  const high = Math.round(size.h * starts.titleHighShare)
  const first = orderKeyBetween(null, null)
  return [
    ...placeholder(
      mint(),
      slide,
      first,
      starts.title,
      "title",
      { x, y: bottom - high, w, h: high },
      titleText(starts.title.chars, "display", "bottom"),
    ),
    ...placeholder(
      mint(),
      slide,
      orderKeyBetween(first, null),
      starts.subtitle,
      "subtitle",
      { x, y: bottom + gap, w, h: Math.round(size.h * starts.subtitleHighShare) },
      subtitleText(starts.subtitle.chars),
    ),
  ]
}

export function titleOnlyWrites(slide: NodeId, mint: () => NodeId, size: Size, starts: StartRules): readonly Write[] {
  const x = Math.round(size.w * starts.marginShare)
  return placeholder(
    mint(),
    slide,
    orderKeyBetween(null, null),
    starts.title,
    "title",
    {
      x,
      y: Math.round(size.h * starts.titleTopShare),
      w: size.w - 2 * x,
      h: Math.round(size.h * starts.titleOnlyHighShare),
    },
    titleText(starts.title.chars, "title", "top"),
  )
}
