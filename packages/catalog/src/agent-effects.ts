import { designWordBytes, type GlowRead, type ShadowRead } from "@airdesign/document"
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
  const words = shadow.color === null ? parts.join(" ") : `${parts.join(" ")} ${agentColor(shadow.color)}`
  return words.length <= designWordBytes ? words : `${words.slice(0, designWordBytes - 3)}...`
}

function agentGlow(glow: GlowRead): string {
  const radius = `radius ${String(tenths(glow.radius / emuPerPoint))}`
  return glow.color === null ? radius : `${radius} ${agentColor(glow.color)}`
}

export const effectAgents = {
  "effects.shadow": agentShadow,
  "effects.innerShadow": agentShadow,
  "effects.drop1": agentShadow,
  "effects.drop2": agentShadow,
  "effects.drop3": agentShadow,
  "effects.inner1": agentShadow,
  "effects.inner2": agentShadow,
  "effects.inner3": agentShadow,
  "effects.glow": agentGlow,
  "effects.softEdge": (value: number) => tenths(value / emuPerPoint),
  "effects.blur": (value: number) => tenths(value / emuPerPoint),
  "effects.kept": (value: string) => value,
}
