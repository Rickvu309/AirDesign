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
import { arrange, resolveControl } from "./panel-arrangement"
import { Checker } from "./preset-icons"
import type { PanelReads, PanelSection } from "./panel"

export const opacitySteps = [100, 75, 50, 25, 10, 0] as const

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
  const resolved = resolveControl({
    trait: "opacity",
    field: "opacity",
    label: opacityCopy.label,
    desc: opacityWire.desc,
    ...shownOf(fields.map((key) => shown.fields?.[key]?.value)),
    inherited: false,
    reset: null,
    change,
  })
  const listed = view.facts.kind === "shape" || view.facts.kind === "picture"
  const control = listed ? { ...resolved, look: { ...resolved.look, glyph: Checker, steps: opacitySteps } } : resolved
  return { trait: "opacity", label: opacityCopy.section, open: true, strips: arrange("opacity", [control]) }
}
