import { textCopy } from "@/copy/text-copy"

export type TypedUnit = { readonly auto?: number; readonly points?: number; readonly fixed?: boolean }

export type FixedLine = { readonly points: number }

const typed = /^(-?(?:\d+(?:\.\d+)?|\.\d+))\s*(%|pt)?$/

function matched(text: string): RegExpExecArray | null {
  return typed.exec(text.trim().replace(",", ".").toLowerCase())
}

export function typedNumber(text: string, unit: TypedUnit): number | null {
  const trimmed = text.trim().replace(",", ".").toLowerCase()
  if (unit.auto !== undefined && trimmed === textCopy.auto.toLowerCase()) return unit.auto
  const match = matched(text)
  if (match === null) return null
  const value = Number(match[1])
  if (match[2] !== "pt") return value
  return unit.points === undefined ? null : value * unit.points
}

export function typedFixed(text: string, unit: TypedUnit, fixedNow: boolean): number | null {
  if (unit.fixed !== true) return null
  const match = matched(text)
  if (match === null || (match[2] !== "pt" && (match[2] !== undefined || !fixedNow))) return null
  return Math.round(Number(match[1]) * 100)
}

export function fixedLine(value: unknown): FixedLine | null {
  if (typeof value !== "object" || value === null || !("points" in value)) return null
  return typeof value.points === "number" ? { points: value.points } : null
}
