import type { PanelSection } from "./panel"

const kindNames = ["blur", "glow", "innerShadow", "shadow", "softEdge"] as const

type KindName = (typeof kindNames)[number]

function isKind(field: string): field is KindName {
  return (kindNames as readonly string[]).includes(field)
}

function liveValue(kind: KindName, value: unknown): boolean {
  if (typeof value !== "object" || value === null || "none" in value) return false
  if (kind === "shadow") return "outer" in value
  if (kind === "innerShadow") return "inner" in value
  if (kind === "glow") return "halo" in value
  return "radius" in value && typeof value.radius === "number"
}

export function visibleEffects(section: PanelSection): PanelSection {
  if (section.trait !== "effects") return section
  return {
    ...section,
    strips: section.strips.filter((strip) => {
      const effect = strip.find((control) => isKind(control.field))
      return effect === undefined || !isKind(effect.field) || liveValue(effect.field, effect.value)
    }),
  }
}
