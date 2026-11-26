import { pickedSlides, prunedPick, type GridPick } from "@/editor/grid-selection"

export type GridInteraction = { readonly kind: "none" } | { readonly kind: "slides"; readonly pick: GridPick }

export type GridStep =
  | { readonly kind: "pick"; readonly pick: GridPick }
  | { readonly kind: "escape" }
  | { readonly kind: "clear" }
  | { readonly kind: "restore"; readonly state: GridInteraction }

const none: GridInteraction = { kind: "none" }

export const gridOpened: GridInteraction = { kind: "slides", pick: null }

export function gridStep(state: GridInteraction, step: GridStep): GridInteraction {
  switch (step.kind) {
    case "pick":
      return { kind: "slides", pick: step.pick }
    case "escape":
    case "clear":
      return state.kind === "none" ? state : none
    case "restore":
      return step.state
  }
}

export function gridPick(state: GridInteraction): GridPick {
  return state.kind === "slides" ? state.pick : null
}

export function gridRinged(state: GridInteraction, current: number, count: number): readonly number[] {
  return state.kind === "slides" ? pickedSlides(prunedPick(state.pick, count), current) : []
}
