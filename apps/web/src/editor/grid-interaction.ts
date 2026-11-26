import { pickedSlides, type GridPick } from "@/editor/grid-selection"

export type GridInteraction =
  | { readonly kind: "none" }
  | { readonly kind: "slides"; readonly pick: GridPick }
  | { readonly kind: "elements"; readonly slide: string }
  | { readonly kind: "text"; readonly slide: string }

export type GridStep =
  | { readonly kind: "pick"; readonly pick: GridPick }
  | { readonly kind: "enter"; readonly slide: string }
  | { readonly kind: "type"; readonly slide: string }
  | { readonly kind: "escape" }
  | { readonly kind: "clear" }
  | { readonly kind: "restore"; readonly state: GridInteraction }

const none: GridInteraction = { kind: "none" }

function same(state: GridInteraction, next: GridInteraction): GridInteraction {
  if (state.kind === "elements" && next.kind === "elements") return state.slide === next.slide ? state : next
  if (state.kind === "text" && next.kind === "text") return state.slide === next.slide ? state : next
  if (state.kind === "none" && next.kind === "none") return state
  return next
}

function escaped(state: GridInteraction): GridInteraction {
  switch (state.kind) {
    case "text":
      return { kind: "elements", slide: state.slide }
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
      return same(state, { kind: "elements", slide: step.slide })
    case "type":
      return same(state, { kind: "text", slide: step.slide })
    case "clear":
      return same(state, none)
    case "escape":
      return escaped(state)
    case "restore":
      return step.state
  }
}

export const gridOpened: GridInteraction = { kind: "slides", pick: null }

export function gridEditing(state: GridInteraction): boolean {
  return state.kind === "elements" || state.kind === "text"
}

export function gridLiveSlide(state: GridInteraction): string | null {
  return state.kind === "elements" || state.kind === "text" ? state.slide : null
}

export function gridPick(state: GridInteraction): GridPick {
  return state.kind === "slides" ? state.pick : null
}

export function gridRinged(state: GridInteraction, order: readonly string[], current: number): readonly number[] {
  return state.kind === "slides" ? pickedSlides(state.pick, order, current) : []
}
