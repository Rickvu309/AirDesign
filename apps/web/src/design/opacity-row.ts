import { opacityWire } from "@airdesign/catalog"
import {
  keptRefuses,
  opacityFields,
  opaque,
  type ScopedElement,
  type SetChange,
  type TraitName,
} from "@airdesign/document"
import { opacityCopy } from "@/copy/opacity-copy"
import { arrange, resolveRow } from "./panel-arrangement"
import type { PanelReads, PanelSection } from "./panel"

function shownOf(values: readonly unknown[]): { readonly value: unknown; readonly mixed: boolean } {
  const shown = values.filter((value) => value !== undefined && value !== null)
  const [first, ...rest] = shown
  if (first === undefined) return { value: opaque, mixed: false }
  const mixed = first === "mixed" || rest.some((each) => each !== first)
  return { value: mixed ? undefined : first, mixed }
}

export function opacitySection(view: ScopedElement, shown: PanelReads): PanelSection | null {
  const fields = opacityFields(view.facts)
  const kept = fields.some((key) => {
    const [trait = "", field = ""] = key.split(".")
    return keptRefuses(view.kept, trait as TraitName, field)
  })
  if (fields.length === 0 || kept) return null
  const change = (value: unknown) => ({ target: { node: view.node }, opacity: value }) as SetChange
  const row = resolveRow({
    trait: "opacity",
    field: "opacity",
    label: opacityCopy.label,
    desc: opacityWire.desc,
    ...shownOf(fields.map((key) => shown.fields?.[key]?.value)),
    inherited: false,
    reset: null,
    change,
  })
  return { trait: "opacity", label: opacityCopy.section, open: true, strips: arrange("opacity", [row]) }
}
