import type { Para } from "./text.js"

export const listStart = { min: 1, max: 32_767 } as const

export function listNumbers(paras: readonly Para[]): readonly (number | undefined)[] {
  const runs: ({ readonly start: number; count: number } | undefined)[] = []
  return paras.map((para) => {
    if (para.list === undefined) {
      runs.length = 0
      return undefined
    }
    const level = para.level ?? 0
    runs.length = level + 1
    if (para.list === "bullet") {
      runs[level] = undefined
      return undefined
    }
    const run = runs[level]
    if (run === undefined) {
      runs[level] = { start: para.startAt ?? listStart.min, count: 0 }
      return para.startAt ?? listStart.min
    }
    run.count += 1
    return run.start + run.count
  })
}
