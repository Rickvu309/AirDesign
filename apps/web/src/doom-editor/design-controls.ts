import { traits, type Desc, type TraitName } from "@airdesign/document"
import { shownPlace, type PanelControl } from "@/design/panel"
import { resolveControl } from "@/design/panel-arrangement"
import { traitControls } from "@/design/trait-controls"

type Loose = Readonly<Record<string, { readonly desc: Desc }>>
type Labelled = { readonly fields: Readonly<Record<string, { readonly label: string }>> }

export type Held = { readonly value: unknown; readonly mixed?: boolean }

export function descOf(trait: TraitName, field: string): Desc {
  const found = (traits[trait].fields as Loose)[field] ?? (traits[trait].inputs as Loose)[field]
  if (found === undefined) throw new Error(`No ${trait}.${field}`)
  return found.desc
}

export function labelOf(trait: TraitName, field: string): string {
  return (traitControls[trait] as Labelled).fields[field]?.label ?? ""
}

export function oldControl(
  trait: TraitName,
  field: string,
  held: Held,
  extra: Partial<PanelControl> = {},
): PanelControl {
  const place = shownPlace(trait, field)
  return resolveControl({
    ...place,
    label: labelOf(trait, field),
    desc: descOf(trait, field),
    value: held.value,
    mixed: held.mixed === true,
    inherited: false,
    reset: null,
    ...extra,
  })
}

export const doomControl = (
  place: { readonly trait: PanelControl["trait"]; readonly field: string },
  label: string,
  desc: Desc,
  held: Held,
  extra: Partial<PanelControl> = {},
): PanelControl =>
  resolveControl({
    ...place,
    label,
    desc,
    value: held.value,
    mixed: held.mixed === true,
    inherited: false,
    reset: null,
    ...extra,
  })

export function choiceDesc(options: readonly string[]): Desc {
  return { kind: "choice", options }
}
