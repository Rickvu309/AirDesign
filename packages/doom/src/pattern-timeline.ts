import type { AgentItem } from "./agent-item.js"
import { sidesOf, solid } from "./agent-look.js"
import type { Px } from "./paint.js"
import { type Block, type Sized, boxIn, frameOf, partOf, strokeOf } from "./agent-block.js"
import { sizedPart } from "./pattern-parts.js"
import { type Build, type Scale, slotWidth, spreadDown, wholeWords } from "./pattern-scale.js"
import { zeroBox } from "./doom-walk.js"

const dotShare = 0.7
const slideWeight = 3

function stepWords(item: AgentItem, scale: Scale, room: Px): readonly Sized[] {
  const { theme, styles } = scale
  return [
    ...(item.value === undefined ? [] : [sizedPart(partOf(item.value, styles.label, "accent1"), theme, room)]),
    ...(item.title === undefined ? [] : [sizedPart(partOf(item.title, styles.heading), theme, room)]),
    ...(item.note === undefined ? [] : [sizedPart(partOf(item.note, styles.caption, "text2"), theme, room)]),
  ]
}

const dotOf = (at: number, side: Px): Block => ({
  type: "shape",
  key: `m${at}`,
  values: { box: { ...zeroBox, w: side, h: side }, geometry: { kind: "ellipse" }, fills: [solid("accent1")] },
})

const railOf = (dot: Px, last: number, box: { readonly w: Px; readonly h: Px }): Block => ({
  type: "shape",
  values: (ref) => ({
    box: { ...zeroBox, x: Math.round(dot / 2), y: Math.round(dot / 2), ...box },
    geometry: {
      kind: "line",
      start: { node: ref("m0"), site: "c" },
      end: { node: ref(`m${last}`), site: "c" },
      route: "straight",
      arrows: ["none", "none"],
    },
    strokes: [solid("accent1")],
    stroke: strokeOf(slideWeight),
  }),
})

export const timeline: Build = (area, items, scale) => {
  const { gap, pad } = scale
  const dot = Math.round(pad * dotShare)
  const inner = Math.round(gap / 2)
  const room = area.w - dot - inner
  if (room <= 0 || !wholeWords(items, scale, room)) return undefined
  const steps = items.map((item, at): Sized => {
    const words = stepWords(item, scale, room)
    const textHigh = words.reduce((sum, word) => sum + word.high, 0) + inner * Math.max(0, words.length - 1)
    const copy =
      words.length === 0
        ? []
        : [
            frameOf(
              {
                sizing: { w: "fill", h: "hug" },
                layout: { mode: "column", gap: inner, padding: sidesOf(0), align: "top-left" },
              },
              words.map((word) => word.block),
            ),
          ]
    return {
      high: Math.max(dot, textHigh),
      block: frameOf(
        {
          sizing: { w: "fill", h: "hug" },
          layout: { mode: "row", gap: inner, padding: sidesOf(0), align: "top-left" },
        },
        [dotOf(at, dot), ...copy],
      ),
    }
  })
  const spread = spreadDown(
    area,
    steps.map((step) => step.high),
    gap,
  )
  if (spread === undefined) return undefined
  const lane = frameOf(
    {
      box: { ...zeroBox, w: area.w, h: spread.high },
      layout: { mode: "column", gap: spread.gap, padding: sidesOf(0), align: "top-left" },
    },
    steps.map((step) => step.block),
  )
  return frameOf({ ...scale.root, box: boxIn(area, spread.high) }, [
    railOf(dot, items.length - 1, { w: 0, h: Math.max(0, spread.high - dot) }),
    lane,
  ])
}

export const timelineAcross: Build = (area, items, scale) => {
  const { gap, pad } = scale
  const dot = Math.round(pad * dotShare)
  const inner = Math.round(gap / 2)
  const slot = slotWidth(area, items.length, gap)
  if (slot <= 0 || !wholeWords(items, scale, slot)) return undefined
  const steps = items.map((item, at): Sized => {
    const words = stepWords(item, scale, slot)
    const textHigh = words.reduce((sum, word) => sum + word.high, 0) + inner * words.length
    return {
      high: dot + textHigh,
      block: frameOf(
        {
          sizing: { w: "fill", h: "hug" },
          layout: { mode: "column", gap: inner, padding: sidesOf(0), align: "top-left" },
        },
        [dotOf(at, dot), ...words.map((word) => word.block)],
      ),
    }
  })
  const tallest = Math.max(...steps.map((step) => step.high))
  if (tallest > area.h) return undefined
  const high = scale.filled ? area.h : tallest
  const lane = frameOf(
    {
      box: { ...zeroBox, w: area.w, h: high },
      layout: { mode: "row", gap, padding: sidesOf(0), align: "top-left" },
    },
    steps.map((step) => step.block),
  )
  return frameOf({ ...scale.root, box: boxIn(area, high) }, [
    railOf(dot, items.length - 1, { w: (slot + gap) * (items.length - 1), h: 0 }),
    lane,
  ])
}
