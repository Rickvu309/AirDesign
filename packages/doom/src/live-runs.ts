import type { Doom, Run } from "./doom.js"

export type ListedRun = Run & { readonly id: string }

const newestFirst = (a: ListedRun, b: ListedRun) => b.started - a.started

export const runsOf = (doom: Doom): readonly ListedRun[] =>
  [...doom.runs]
    .filter(([, run]) => run.agent !== "")
    .map(([id, run]) => ({ ...run, id }))
    .sort(newestFirst)

export const liveRuns = (doom: Doom): readonly ListedRun[] => runsOf(doom).filter((run) => run.phase === "running")
