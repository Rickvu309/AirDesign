import { openPreset } from "@airdesign/render"
import type { PanelKind } from "./panel-order"

type Shown = {
  readonly fields?: Readonly<Record<string, { readonly value: unknown } | undefined>>
}

function presetName(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("preset" in value)) return null
  return typeof value.preset === "string" ? value.preset : null
}

export function endsOpen(kind: PanelKind | null, shown: Shown): boolean {
  if (kind === "connector") return true
  const geometry = shown.fields?.["geometry.shape"]
  if (geometry !== undefined && "open" in geometry && geometry.open === true) return true
  const name = presetName(geometry?.value)
  return name !== null && openPreset(name)
}
