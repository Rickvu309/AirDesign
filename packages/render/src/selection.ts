import type { ElementId } from "@airdesign/document"

export type Selection = {
  readonly ids: readonly ElementId[]
  readonly inside: ElementId | null
  readonly acrossGroups?: true
}

export const noSelection: Selection = { ids: [], inside: null }
