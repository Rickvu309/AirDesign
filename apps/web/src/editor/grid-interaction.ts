import { pickedSlides, prunedPick, type GridPick } from "@/editor/grid-selection"

export type GridInteraction =
  | { readonly kind: "none" }
  | { readonly kind: "slides"; readonly pick: GridPick }
  | { readonly kind: "elements" }
  | { readonly kind: "text" }

export type GridStep =
  | { readonly kind: "pick"; readonly pick: GridPick }
  | { readonly kind: "enter" }
  | { readonly kind: "type" }
  | { readonly kind: "escape" }
  | { readonly kind: "clear" }

const none: GridInteraction = { kind: "none" }
const elements: GridInteraction = { kind: "elements" }
const text: GridInteraction = { kind: "text" }

function same(state: GridInteraction, next: GridInteraction): GridInteraction {
  return state.kind === next.kind && next.kind !== "slides" ? state : next
}

function escaped(state: GridInteraction): GridInteraction {
  switch (state.kind) {
    case "text":
      return elements
    case "elements":
      return { kind: "slides", pick: null }
    case "slides":
      return none
    case "none":
      return state
  }
}

export function gridStep(state: GridInteraction, step: GridStep): GridInteraction {
  switch (step.kind) {
    case "pick":
      return { kind: "slides", pick: step.pick }
    case "enter":
      return same(state, elements)
    case "type":
      return same(state, text)
    case "clear":
      return same(state, none)
    case "escape":
      return escaped(state)
  }
}

export function gridOpened(selected: boolean): GridInteraction {
  return selected ? elements : { kind: "slides", pick: null }
}

export function gridEditing(state: GridInteraction): boolean {
  return state.kind === "elements" || state.kind === "text"
}

export function gridPick(state: GridInteraction): GridPick {
  return state.kind === "slides" ? state.pick : null
}

export function gridRinged(state: GridInteraction, current: number, count: number): readonly number[] {
  return state.kind === "slides" ? pickedSlides(prunedPick(state.pick, count), current) : []
}
