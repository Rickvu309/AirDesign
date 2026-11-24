import type { Desc } from "@/design/control-desc"
import type { PanelControl } from "@/design/panel"
import { resolveControl } from "@/design/panel-arrangement"

export type Held = { readonly value: unknown; readonly mixed?: boolean }

export const flagDesc: Desc = { kind: "flag" }

export const fontDesc: Desc = { kind: "words", max: 64 }

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
