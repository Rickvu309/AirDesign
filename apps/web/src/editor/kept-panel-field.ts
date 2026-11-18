import { keptEffectText } from "@airdesign/pptx"

type Parts = Parameters<typeof keptEffectText>[0]
type At = Parameters<typeof keptEffectText>[1]

export function keptPanelField(
  parts: Parts,
  at: At,
): { readonly "effects.kept"?: { readonly value: string; readonly own: true } } {
  const kept = keptEffectText(parts, at)
  return kept === null ? {} : { "effects.kept": { value: kept, own: true } }
}
