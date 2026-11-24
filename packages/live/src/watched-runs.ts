import * as doom from "@airdesign/doom"

const watchedRuns = 20

export type WatchedRun = { readonly started: doom.Doom; readonly edits: doom.RunEdit[] }

export function watchedRunsOf() {
  const watched = new Map<string, WatchedRun>()
  return {
    get: (run: string) => watched.get(run),
    clear: () => watched.clear(),
    watch(run: string | undefined, read: doom.Landed, before: doom.Doom) {
      if (run === undefined) return
      if (read.phase === "start") {
        watched.delete(run)
        watched.set(run, { started: before, edits: [] })
        const oldest = watched.keys().next().value
        if (watched.size > watchedRuns && oldest !== undefined) watched.delete(oldest)
      }
      watched.get(run)?.edits.push({ ...read, replaced: doom.replacedBy(before, read) })
    },
  }
}
