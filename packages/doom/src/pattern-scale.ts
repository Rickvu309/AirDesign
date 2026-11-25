import type { AgentItem } from "./agent-item.js"
import type { Values } from "./agent-draft.js"
import type { Area } from "./agent-place.js"
import type { Measure } from "./measure.js"
import type { Px } from "./paint.js"
import type { Block, Styles } from "./pattern-parts.js"
import type { TextStyleName } from "./text.js"
import { widestWord } from "./text-estimate.js"
import { zeroBox } from "./doom-walk.js"
import type { Theme } from "./theme.js"

export type Scale = {
  readonly gap: Px
  readonly pad: Px
  readonly theme: Theme
  readonly styles: Styles
  readonly root: Values
  readonly filled: boolean
  readonly measure?: Measure | undefined
  readonly axes?: readonly [string, string] | undefined
}
export type Build = (area: Area, items: readonly AgentItem[], scale: Scale) => Block | undefined

export const slotWidth = (area: Area, count: number, gap: Px) => Math.floor((area.w - gap * (count - 1)) / count)
export const boxIn = (area: Area, h: Px) => ({ ...zeroBox, x: area.x, y: area.y, w: area.w, h })
export const strokeOf = (weight: Px) => ({ weight, align: "center" as const, dash: "solid" as const })

export function spreadDown(
  area: Area,
  highs: readonly Px[],
  minGap: Px,
): { readonly gap: Px; readonly high: Px } | undefined {
  const gaps = highs.length - 1
  if (gaps < 1) return undefined
  const content = highs.reduce((sum, high) => sum + high, 0)
  if (content + minGap * gaps > area.h) return undefined
  const gap = Math.floor((area.h - content) / gaps)
  return { gap, high: content + gap * gaps }
}

export const wordsOf = (items: readonly AgentItem[], field: "value" | "title" | "note") =>
  items.flatMap((item) => (item[field] === undefined ? [] : [item[field]]))

export const wordsFit = (words: readonly string[], theme: Theme, style: TextStyleName, room: Px, bold = false) =>
  widestWord(words, theme, style, bold) <= room

export const wholeWords = (items: readonly AgentItem[], scale: Scale, room: Px) =>
  wordsFit(wordsOf(items, "value"), scale.theme, scale.styles.label, room) &&
  wordsFit(wordsOf(items, "title"), scale.theme, scale.styles.heading, room) &&
  wordsFit(wordsOf(items, "note"), scale.theme, scale.styles.caption, room)
