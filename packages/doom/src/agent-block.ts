import type { AgentColor } from "./agent-change.js"
import { type Draft, type Values, create } from "./agent-draft.js"
import { textOfLook } from "./agent-look.js"
import type { Area } from "./agent-place.js"
import { zeroBox } from "./doom-walk.js"
import type { NodeId } from "./ids.js"
import type { Measure } from "./measure.js"
import type { Px } from "./paint.js"
import type { Text, TextStyleName } from "./text.js"
import { textStyleNames } from "./text.js"
import { textHeight, widestWord } from "./text-estimate.js"
import type { Theme } from "./theme.js"

export type Block = {
  readonly type: "frame" | "shape"
  readonly values: Values
  readonly children?: readonly Block[]
}
export type Part = { readonly block: Block; readonly text: Text }

export function emit(draft: Draft, parent: NodeId, block: Block): void {
  const id = create(draft, block.type, parent, block.values)
  for (const child of block.children ?? []) emit(draft, id, child)
}

export const ladderOf = (theme: Theme): readonly TextStyleName[] =>
  [...textStyleNames].sort((a, b) => theme.textStyles[b].size - theme.textStyles[a].size)

export function partOf(markdown: string, style: TextStyleName, color: AgentColor = "text"): Part {
  const text = textOfLook({ text: markdown, textStyle: style, color }, undefined, style) as Text
  const block: Block = {
    type: "shape",
    values: { geometry: { kind: "rect" }, sizing: { w: "fill", h: "hug" }, text },
  }
  return { text, block }
}

export const heightIn = (part: Part, theme: Theme, width: Px, measure?: Measure): Px =>
  measure === undefined
    ? Math.round(textHeight(part.text, theme, width))
    : Math.ceil(measure(part.text, theme, width).h)

export function frameOf(values: Values, children: readonly Block[]): Block {
  return { type: "frame", values, children }
}

export const boxIn = (area: Area, h: Px) => ({ ...zeroBox, x: area.x, y: area.y, w: area.w, h })
export const strokeOf = (weight: Px) => ({ weight, align: "center" as const, dash: "solid" as const })

export const wordsFit = (words: readonly string[], theme: Theme, style: TextStyleName, room: Px, bold = false) =>
  widestWord(words, theme, style, bold) <= room
