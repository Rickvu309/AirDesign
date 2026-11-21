import type { AgentChange } from "@airdesign/catalog"
import { presentSlides, textStylesOf, type Register } from "@airdesign/document"

export type StyleProblem = { readonly code: "field"; readonly detail: string }

function knownStyles(register: Register): ReadonlySet<string> {
  const slides = [
    ...(register.index?.slides ?? []).map((slide) => slide.id),
    ...presentSlides(register).map((slide) => slide.id),
  ]
  return new Set(slides.flatMap((slide) => textStylesOf(register, slide).map((style) => style.id)))
}

export function styleProblem(register: Register, changes: readonly AgentChange[]): StyleProblem | undefined {
  let known: ReadonlySet<string> | undefined
  for (const [at, change] of changes.entries()) {
    if (!("op" in change) || change.op !== "set") continue
    const edits = change.templateStyle?.textStyle
    if (!Array.isArray(edits)) continue
    known ??= knownStyles(register)
    const unknown = edits.find((edit) => !known?.has(edit.id))
    if (unknown !== undefined)
      return {
        code: "field",
        detail: `Change ${String(at + 1)}: the deck has no text style ${unknown.id}. Use a textStyles id from airdesign_read_deck with a slide.`,
      }
  }
  return undefined
}
