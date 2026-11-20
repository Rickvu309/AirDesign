import type { Desc, ScopedElement, TraitName } from "@airdesign/document"

function sizingOptions(facts: ScopedElement["facts"], options: readonly string[]): readonly string[] {
  if (facts.frame === undefined) return options.filter((option) => option !== "hug")
  return facts.framed === "auto" ? options : options.filter((option) => option !== "fill")
}

export function directions(trait: TraitName, field: string, desc: Desc, facts: ScopedElement["facts"]): Desc {
  if (trait === "layout" && (field === "width" || field === "height") && desc.kind === "choice")
    return { ...desc, options: sizingOptions(facts, desc.options) }
  if (trait !== "layout" || field !== "flow" || desc.kind !== "choice") return desc
  return { ...desc, options: desc.options.filter((option) => option !== "none").reverse() }
}
