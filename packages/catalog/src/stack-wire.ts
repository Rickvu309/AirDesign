import { type ElementId } from "@airdesign/document"

export type Stack = "front" | "back" | { readonly above: ElementId } | { readonly below: ElementId }
