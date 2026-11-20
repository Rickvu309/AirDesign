import { readGuideList, readLayoutGuides, type Guide, type LayoutGuide } from "./trait-guides.js"
import { readStoredTransition, type TransitionValue } from "./trait-transition.js"

export type IndexArrangement = {
  readonly transition?: TransitionValue | "kept"
  readonly guides?: readonly Guide[]
  readonly layoutGuides?: readonly LayoutGuide[]
}

export function readIndexArrangement(row: Readonly<Record<string, unknown>>): IndexArrangement | null {
  const transition = row.transition === undefined ? undefined : readStoredTransition(row.transition)
  const guides = row.guides === undefined ? undefined : readGuideList(row.guides)
  const layoutGuides = row.layoutGuides === undefined ? undefined : readLayoutGuides(row.layoutGuides)
  if (transition === null || guides === null || layoutGuides === null) return null
  return {
    ...(transition === undefined ? {} : { transition }),
    ...(guides === undefined ? {} : { guides }),
    ...(layoutGuides === undefined ? {} : { layoutGuides }),
  }
}
