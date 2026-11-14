import type { Color } from "@airdesign/document"
import { colorIn } from "./color-read.js"
import { child, whole, type Held } from "./markup-held.js"

export type Reference = { readonly entry: Held; readonly placed: Color | null } | "none"

export function referenceOf(owners: readonly Held[], kind: string, list: readonly Held[]): Reference | undefined {
  for (const owner of owners) {
    const reference = child(child(owner, "p:style"), kind)
    if (reference === undefined) continue
    const index = whole(reference.element, "idx") ?? -1
    if (index === 0) return "none"
    const entry = list[index - 1]
    return entry === undefined ? undefined : { entry: { ...entry, source: "style" }, placed: colorIn(reference, null) }
  }
  return undefined
}
