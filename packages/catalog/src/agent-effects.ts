import type {
  Design,
  DesignKey,
  ElementPatch,
  FieldEdit,
  FieldValue,
  GlowRead,
  ShadowRead,
  Shown,
} from "@airdesign/document"
import { agentColor } from "./agent-color.js"

const emuPerPoint = 12_700
const anglePerDegree = 60_000

function tenths(value: number): number {
  return Math.round(value * 10) / 10
}

function agentShadow(shadow: ShadowRead): string {
  const parts = [
    `blur ${String(tenths(shadow.blur / emuPerPoint))}`,
    `distance ${String(tenths(shadow.distance / emuPerPoint))}`,
    `direction ${String(tenths(shadow.direction / anglePerDegree))}`,
  ]
  return shadow.color === null ? parts.join(" ") : `${parts.join(" ")} ${agentColor(shadow.color)}`
}

function agentGlow(glow: GlowRead): string {
  const radius = `radius ${String(tenths(glow.radius / emuPerPoint))}`
  return glow.color === null ? radius : `${radius} ${agentColor(glow.color)}`
}

type Shadow = FieldValue<"effects", "shadow">
type InnerShadow = FieldValue<"effects", "innerShadow">
type Glow = FieldValue<"effects", "glow">
type SoftEdge = FieldValue<"effects", "softEdge">

const shadowShown = (shadow: Shadow) => ("none" in shadow ? null : agentShadow(shadow.outer))
const innerShown = (shadow: InnerShadow) => ("none" in shadow ? null : agentShadow(shadow.inner))
const glowShown = (glow: Glow) => ("none" in glow ? null : agentGlow(glow.halo))
const softEdgeShown = (soft: SoftEdge) => ("none" in soft ? null : tenths(soft.radius / emuPerPoint))

export const effectAgents = {
  "effects.shadow": agentShadow,
  "effects.innerShadow": agentShadow,
  "effects.glow": agentGlow,
  "effects.softEdge": (value: number) => tenths(value / emuPerPoint),
  "effects.blur": (value: number) => tenths(value / emuPerPoint),
  "effects.kept": (value: string) => value,
}

function folded<V>(
  design: Design,
  key: DesignKey,
  edit: FieldEdit<V> | undefined,
  shown: (value: V) => Shown[0] | null,
): Design {
  if (edit === undefined || edit === "opening") return design
  const rest: Design = Object.fromEntries(Object.entries(design).filter(([each]) => each !== key))
  const value = edit === "inherit" ? null : shown(edit.set)
  return value === null ? rest : { ...rest, [key]: [value] }
}

export function foldEffects(design: Design, effects: ElementPatch["effects"]): Design {
  let next = folded(design, "effects.shadow", effects?.shadow, shadowShown)
  next = folded(next, "effects.innerShadow", effects?.innerShadow, innerShown)
  next = folded(next, "effects.glow", effects?.glow, glowShown)
  next = folded(next, "effects.softEdge", effects?.softEdge, softEdgeShown)
  return folded(next, "effects.blur", effects?.blur, softEdgeShown)
}
