import type * as doom from "@airdesign/doom"
import { liveRuns } from "@airdesign/doom"

export const editingWindow = 30_000

export type Heard = ReadonlyMap<string, { readonly wrote: doom.Rev; readonly at: number }>

export function heardWrites(heard: Heard, view: doom.Doom, now: number, opening: boolean): Heard {
  const next = new Map<string, { readonly wrote: doom.Rev; readonly at: number }>()
  for (const run of liveRuns(view)) {
    const before = heard.get(run.id)
    if (before === undefined) next.set(run.id, { wrote: run.wrote, at: opening ? -Infinity : now })
    else next.set(run.id, before.wrote === run.wrote ? before : { wrote: run.wrote, at: now })
  }
  return next
}

export function editingNow(heard: Heard, now: number): ReadonlySet<string> {
  return new Set([...heard].filter(([, each]) => now - each.at < editingWindow).map(([id]) => id))
}

export function quietIn(heard: Heard, now: number): number | undefined {
  const left = [...heard.values()].map((each) => each.at + editingWindow - now).filter((ms) => ms > 0)
  return left.length === 0 ? undefined : Math.min(...left)
}
