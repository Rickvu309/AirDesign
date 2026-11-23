import { type ElementId } from "@airdesign/document"

export type GroupChange =
  | { readonly change: "group"; readonly nodes: readonly ElementId[] }
  | { readonly change: "ungroup"; readonly node: ElementId }
  | { readonly change: "frame"; readonly nodes: readonly ElementId[] }
  | { readonly change: "plain-frame"; readonly nodes: readonly ElementId[] }
  | { readonly change: "mask"; readonly nodes: readonly ElementId[] }
