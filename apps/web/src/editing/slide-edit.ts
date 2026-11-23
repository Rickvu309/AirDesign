import { type SlideId } from "@airdesign/document"
export type SlideSetChange = "clone" | "remove"
export type SelectedCopy = { readonly id: SlideId; readonly index: number }
