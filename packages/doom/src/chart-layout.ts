import { type Context, type Entry, clamp } from "./chart-context.js"
import { type Legend, legendGrid, legendLooks, legendStack } from "./chart-legend.js"
import { spot } from "./chart-parts.js"
import type { Box, Resolved } from "./resolved.js"

export type Side = "top" | "right" | "below"

export type Room = { readonly fits: boolean; readonly score: number }

export type Budget = {
  readonly entries: readonly Entry[]
  readonly header: string | undefined
  readonly sides: readonly Side[]
  readonly indent?: number
  readonly besideTop?: (region: Box) => number
  readonly used?: (region: Box) => number
  readonly plot: (region: Box) => Room
}

export type ChartLayout = { readonly legend: readonly Resolved[]; readonly region: Box }

const rowsGap = 22

type Option = { readonly region: Box; readonly place: () => readonly Resolved[] }

const besideGap = (context: Context) => clamp(context.w * 0.08, 24, 64)

function option(context: Context, budget: Budget, side: Side, legend: Legend | undefined): Option | undefined {
  if (legend === undefined) return undefined
  const { w, h } = context
  if (side === "right") {
    const room = w - legend.w - besideGap(context)
    if (room <= 0 || legend.h > h) return undefined
    const region = spot(0, 0, room, h)
    const top = clamp(budget.besideTop?.(region) ?? (h - legend.h) / 2, 0, h - legend.h)
    const left = Math.min(w - legend.w, (budget.used?.(region) ?? room) + besideGap(context))
    return { region, place: () => legend.place(left, top) }
  }
  const taken = legend.h + rowsGap
  if (taken >= h) return undefined
  if (side === "top") {
    const indent = budget.indent ?? 0
    const x = indent + legend.w <= w ? indent : 0
    return { region: spot(0, taken, w, h - taken), place: () => legend.place(x, 0) }
  }
  return { region: spot(0, 0, w, h - taken), place: () => legend.place((w - legend.w) / 2, h - legend.h) }
}

export function chartLayout(context: Context, budget: Budget): ChartLayout {
  if (budget.entries.length === 0 && budget.header === undefined) return { legend: [], region: context.bounds }
  const indent = budget.indent ?? 0
  const options = legendLooks(context).flatMap((look) =>
    budget.sides.flatMap((side) => {
      const legend =
        side === "right"
          ? legendStack(context, budget.entries, budget.header, look, context.h)
          : side === "top"
            ? widest(
                legendGrid(context, budget.entries, budget.header, look, context.w - indent),
                legendGrid(context, budget.entries, budget.header, look, context.w),
              )
            : legendGrid(context, budget.entries, budget.header, look, context.w)
      return option(context, budget, side, legend) ?? []
    }),
  )
  const rooms = options.map((one) => budget.plot(one.region))
  const fitting = rooms.findIndex((room) => room.fits)
  const roomiest = rooms.reduce((best, room, at) => (room.score > rooms[best]!.score ? at : best), 0)
  const chosen = options[fitting >= 0 ? fitting : roomiest]
  if (chosen === undefined) return { legend: [], region: context.bounds }
  return { legend: chosen.place(), region: chosen.region }
}

const widest = (indented: Legend | undefined, full: Legend | undefined) =>
  indented !== undefined && full !== undefined && indented.h <= full.h ? indented : full
