export const p14Namespace = "http://schemas.microsoft.com/office/powerpoint/2010/main"

export const p159Namespace = "http://schemas.microsoft.com/office/powerpoint/2015/09/main"

export const mcNamespace = "http://schemas.openxmlformats.org/markup-compatibility/2006"

export const speeds: Readonly<Record<string, number>> = { fast: 500, med: 750, slow: 1000 }

export const fromSide = { left: "l", right: "r", top: "u", bottom: "d" } as const

export const pushDir = { left: "r", right: "l", top: "d", bottom: "u" } as const

export const sideOf = { l: "left", r: "right", u: "top", d: "bottom" } as const

export const pushSide = { l: "right", r: "left", u: "bottom", d: "top" } as const

export type Side = keyof typeof fromSide

export function speedOf(duration: number): "fast" | "med" | "slow" {
  if (duration <= 625) return "fast"
  if (duration <= 875) return "med"
  return "slow"
}

export function speedDuration(spd: string | undefined): number | null {
  if (spd === undefined || spd === "fast") return speeds.fast!
  if (spd === "med") return speeds.med!
  if (spd === "slow") return speeds.slow!
  return null
}
