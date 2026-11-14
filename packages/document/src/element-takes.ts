import type { Box } from "./box.js"
import type { IndexElement } from "./deck-index.js"
import type { Kind } from "./kinds.js"
import { fieldKeys, kindTraits, type FieldKey } from "./traits.js"

export type ElementFacts = {
  readonly kind: Kind
  readonly text: boolean
  readonly grouped: boolean
  readonly animated: boolean
}

const unwritten: Partial<Readonly<Record<Kind, readonly FieldKey[]>>> = { table: ["box.w", "box.h"] }

const textFields: readonly FieldKey[] = ["text.value", "notes.value"]

const removes: readonly Kind[] = ["shape", "picture", "connector", "table", "chart", "kept"]

export function takes(facts: ElementFacts): readonly FieldKey[] {
  const fields = kindTraits[facts.kind].flatMap((trait) => (trait === "box" && facts.grouped ? [] : fieldKeys(trait)))
  return fields.filter(
    (field) => !(unwritten[facts.kind]?.includes(field) ?? false) && (facts.text || !textFields.includes(field)),
  )
}

export function agentTakes(facts: ElementFacts): readonly FieldKey[] {
  return takes(facts).filter((field) => field !== "table.value")
}

export function removable(facts: ElementFacts): boolean {
  return removes.includes(facts.kind) && !facts.grouped && !facts.animated
}

export function indexFacts(element: IndexElement, animated: boolean): ElementFacts {
  return { kind: element.kind, text: element.value !== null, grouped: element.grouped, animated }
}

export type Wanted = FieldKey | "remove"

export function boxOnly(missing: readonly Wanted[]): boolean {
  return missing.every((wanted) => wanted.startsWith("box."))
}

export function boxFields(before: Box | null, after: Box): readonly FieldKey[] {
  if (before === null || before.cx !== after.cx || before.cy !== after.cy) return ["box.x", "box.y", "box.w", "box.h"]
  return ["box.x", "box.y"]
}
