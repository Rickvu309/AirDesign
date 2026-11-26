import { type Part, type Sized, frameOf, heightIn, ladderOf } from "./agent-block.js"
import type { AgentColor } from "./agent-change.js"
import { solid } from "./agent-look.js"
import type { Measure } from "./measure.js"
import type { Align9, Cell } from "./layout.js"
import type { Px } from "./paint.js"
import { type TextStyleName, textStyleNames } from "./text.js"
import type { Theme } from "./theme.js"

type Role = "number" | "heading" | "point" | "caption" | "label"
export type Styles = Readonly<Record<Role, TextStyleName>>

const starts: Styles = { number: "bigNumber", heading: "heading", point: "body", caption: "caption", label: "label" }
const floors: Styles = { number: "heading", heading: "body2", point: "caption", caption: "caption", label: "label" }
const roles = Object.keys(starts) as Role[]

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

export const bullets = (points: readonly string[]): string => points.map((point) => `- ${point}`).join("\n")

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
