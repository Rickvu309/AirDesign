import type { NodeId } from "@airdesign/doom"
export type SlideSetChange = "clone" | "remove"
export type SelectedCopy = { readonly id: NodeId; readonly index: number }
