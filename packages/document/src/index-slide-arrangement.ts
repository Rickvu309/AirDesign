import { readGuideList, type Guide } from "./trait-guides.js"
import { readStoredTransition, type TransitionValue } from "./trait-transition.js"

export type IndexArrangement = {
  readonly transition?: TransitionValue | "kept"
  readonly guides?: readonly Guide[]
}

export function readIndexArrangement(row: Readonly<Record<string, unknown>>): IndexArrangement | null {
  const transition = row.transition === undefined ? undefined : readStoredTransition(row.transition)
  const guides = row.guides === undefined ? undefined : readGuideList(row.guides)
  if (transition === null || guides === null) return null
  return {
    ...(transition === undefined ? {} : { transition }),
    ...(guides === undefined ? {} : { guides }),
  }
}
