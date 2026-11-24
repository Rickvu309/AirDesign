import { wrapDegrees } from "@airdesign/doom"
import type { Desc, NumberUnit } from "./control-desc"

const typed = /^(-?(?:\d+(?:\.\d+)?|\.\d+))\s*%?$/

export function typedNumber(text: string): number | null {
  const match = typed.exec(text.trim().replace(",", "."))
  return match === null ? null : Number(match[1])
}

const perUnit: { readonly [Unit in NumberUnit]: number } = {
  emu: 12_700,
  angle: 60_000,
  fraction: 1_000,
  "hundredth-point": 100,
  count: 1,
}

const widestSlide = 51_206_400

export function shownInUnit(unit: NumberUnit, stored: number): number {
  return Math.round((stored / perUnit[unit]) * 10) / 10
}

export function storedOf(desc: Desc, typed: number): number | null {
  if (desc.kind !== "number") return null
  const factor = perUnit[desc.unit]
  const low = desc.unit === "emu" ? Math.max(desc.min, -widestSlide) : desc.min
  const high = desc.unit === "emu" ? Math.min(desc.max, widestSlide) : desc.max
  if (!Number.isFinite(typed) || typed < low / factor || typed > high / factor) return null
  if (desc.unit === "count" && !Number.isInteger(typed)) return null
  const stored = Math.round(typed * factor)
  return Object.is(stored, -0) ? 0 : stored
}

export function clampedOf(desc: Desc, typed: number): number | null {
  if (desc.kind !== "number" || !Number.isFinite(typed)) return null
  const factor = perUnit[desc.unit]
  const low = desc.unit === "emu" ? Math.max(desc.min, -widestSlide) : desc.min
  const high = desc.unit === "emu" ? Math.min(desc.max, widestSlide) : desc.max
  if (desc.unit === "angle") {
    return storedOf(desc, wrapDegrees(typed))
  }
  const inRange = Math.min(high / factor, Math.max(low / factor, typed))
  return storedOf(desc, desc.unit === "count" ? Math.round(inRange) : inRange)
}
