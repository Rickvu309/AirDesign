import type { AgentColor } from "./agent-change.js"
import { type Draft, type Values, add, stop } from "./agent-draft.js"
import { solid, textOfLook } from "./agent-look.js"
import type { NodeId } from "./ids.js"
import type { Measure } from "./measure.js"
import type { Align9, Cell } from "./layout.js"
import type { Px } from "./paint.js"
import type { Text, TextStyleName } from "./text.js"
import { textStyleNames } from "./text.js"
import { textHeight } from "./text-estimate.js"
import type { Theme } from "./theme.js"

export type Block = {
  readonly type: "frame" | "shape"
  readonly key?: string
  readonly values: Values | ((ref: (key: string) => NodeId) => Values)
  readonly children?: readonly Block[]
}
export type Sized = { readonly block: Block; readonly high: Px }
export type Part = Sized & { readonly text: Text }

export function emit(draft: Draft, parent: NodeId, root: Block): NodeId {
  const ids = new Map<Block, NodeId>()
  const keyed = new Map<string, NodeId>()
  const assign = (block: Block): void => {
    const id = draft.mint()
    ids.set(block, id)
    if (block.key !== undefined) keyed.set(block.key, id)
    block.children?.forEach(assign)
  }
  assign(root)
  const ref = (key: string) => keyed.get(key) ?? stop("missing", undefined, key)
  const write = (block: Block, under: NodeId): void => {
    const id = ids.get(block) as NodeId
    add(draft, id, block.type, under, typeof block.values === "function" ? block.values(ref) : block.values)
    block.children?.forEach((child) => write(child, id))
  }
  write(root, parent)
  return ids.get(root) as NodeId
}

type Role = "number" | "heading" | "point" | "caption" | "label"
export type Styles = Readonly<Record<Role, TextStyleName>>

const starts: Styles = { number: "bigNumber", heading: "heading", point: "body", caption: "caption", label: "label" }
const floors: Styles = { number: "heading", heading: "body2", point: "caption", caption: "caption", label: "label" }
const roles = Object.keys(starts) as Role[]

export const ladderOf = (theme: Theme): readonly TextStyleName[] =>
  [...textStyleNames].sort((a, b) => theme.textStyles[b].size - theme.textStyles[a].size)

export function stylesAt(theme: Theme, step: number): Styles {
  const ladder = ladderOf(theme)
  return Object.fromEntries(
    roles.map((role) => {
      const from = ladder.indexOf(starts[role])
      const last = Math.max(from, ladder.indexOf(floors[role]))
      return [role, ladder[Math.min(from + step, last)]]
    }),
  ) as Styles
}

export function largestFitting<T>(theme: Theme, attempt: (styles: Styles) => T | undefined): T | undefined {
  let before: string | undefined
  for (let step = 0; step <= textStyleNames.length; step += 1) {
    const styles = stylesAt(theme, step)
    const same = JSON.stringify(styles)
    if (same === before) break
    before = same
    const made = attempt(styles)
    if (made !== undefined) return made
  }
  return undefined
}

export function partOf(markdown: string, style: TextStyleName, color: AgentColor = "text", center = false): Part {
  const text = textOfLook(
    { text: markdown, textStyle: style, color, ...(center ? { align: "center" as const } : {}) },
    undefined,
    style,
  ) as Text
  const block: Block = {
    type: "shape",
    values: { geometry: { kind: "rect" }, sizing: { w: "fill", h: "hug" }, text },
  }
  return { text, block, high: 0 }
}

export const heightIn = (part: Part, theme: Theme, width: Px, measure?: Measure): Px =>
  measure === undefined
    ? Math.round(textHeight(part.text, theme, width))
    : Math.ceil(measure(part.text, theme, width).h)

export const bullets = (points: readonly string[]): string => points.map((point) => `- ${point}`).join("\n")

export function frameOf(values: Values, children: readonly Block[]): Block {
  return { type: "frame", values, children }
}

export function cardOf(
  members: readonly Sized[],
  look: {
    readonly pad: Px
    readonly gap: Px
    readonly fill: AgentColor
    readonly cell?: Cell
    readonly key?: string
    readonly align?: Align9
    readonly hug?: boolean
  },
): Sized {
  const inner = Math.round(look.gap / 2)
  const high =
    look.pad * 2 + members.reduce((sum, member) => sum + member.high, 0) + inner * Math.max(0, members.length - 1)
  const framed = frameOf(
    {
      sizing: { w: "fill", h: look.hug === true ? "hug" : "fill" },
      ...(look.cell === undefined ? {} : { cell: look.cell }),
      layout: {
        mode: "column",
        gap: inner,
        padding: { t: look.pad, r: look.pad, b: look.pad, l: look.pad },
        align: look.align ?? "top-left",
      },
      fills: [solid(look.fill)],
      radius: Math.round(look.pad / 2),
    },
    members.map((member) => member.block),
  )
  return { block: look.key === undefined ? framed : { ...framed, key: look.key }, high }
}

export const sizedPart = (part: Part, theme: Theme, width: Px, measure?: Measure): Sized => ({
  block: part.block,
  high: heightIn(part, theme, width, measure),
})
