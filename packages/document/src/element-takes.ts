import type { Box } from "./box.js"
import type { IndexElement } from "./deck-index.js"
import type { Kind } from "./kinds.js"
import { alphaKeys, fieldKeys, kindTraits, type FieldKey } from "./traits.js"

export type ElementFacts = {
  readonly kind: Kind
  readonly text: boolean
  readonly grouped: boolean
  readonly animated: boolean
  readonly frame?: "auto" | "free"
  readonly framed?: "auto" | "free"
  readonly backdrop?: true
}

const turns: readonly FieldKey[] = ["box.rot", "box.flipH", "box.flipV"]

const placed: readonly FieldKey[] = ["box.x", "box.y", "box.w", "box.h"]

const sized: readonly FieldKey[] = ["box.w", "box.h"]

const sizes: readonly FieldKey[] = ["layout.width", "layout.height"]

const chosenStyle: FieldKey = "templateStyle.id"

const masks: FieldKey = "identity.mask"

const unwritten: Partial<Readonly<Record<Kind, readonly FieldKey[]>>> = {
  table: [...turns, masks],
  chart: [...turns, masks],
  connector: [masks],
  group: [masks],
  slide: [
    "fills.weight",
    "fills.color",
    "fills.mode",
    "fills.tileScale",
    "fills.crop",
    "fills.recolor",
    "fills.blur",
    "fills.alpha",
    ...fieldKeys("templateStyle").filter((field) => field !== chosenStyle),
  ],
  deck: [chosenStyle],
  kept: ["identity.name", "identity.alt", "identity.hidden", "identity.locked", masks],
}

const textFields: readonly FieldKey[] = ["text.value", "text.alpha", "notes.value", "link.target"]

const removes: readonly Kind[] = ["shape", "connector", "table", "chart", "kept", "group"]

export function takes(facts: ElementFacts): readonly FieldKey[] {
  const fields = kindTraits[facts.kind].flatMap((trait): readonly FieldKey[] => {
    if (trait === "layout")
      return facts.frame !== undefined
        ? fieldKeys(trait)
        : facts.framed === "auto" && facts.backdrop !== true
          ? sizes
          : []
    if (trait === "box" && facts.framed !== undefined) return facts.framed === "free" ? placed : sized
    return fieldKeys(trait)
  })
  return fields.filter(
    (field) =>
      !(unwritten[facts.kind]?.includes(field) ?? false) &&
      (facts.text || !(textFields.includes(field) || field.startsWith("body."))),
  )
}

export function opacityFields(facts: ElementFacts): readonly FieldKey[] {
  return takes(facts).filter((field) => alphaKeys.includes(field))
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
