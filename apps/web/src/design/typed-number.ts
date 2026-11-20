import { textCopy } from "@/copy/text-copy"

export type TypedUnit = { readonly auto?: number; readonly points?: number }

const typed = /^(-?(?:\d+(?:\.\d+)?|\.\d+))\s*(%|pt)?$/

export function typedNumber(text: string, unit: TypedUnit): number | null {
  const trimmed = text.trim().replace(",", ".").toLowerCase()
  if (unit.auto !== undefined && trimmed === textCopy.auto.toLowerCase()) return unit.auto
  const match = typed.exec(trimmed)
  if (match === null) return null
  const value = Number(match[1])
  if (match[2] !== "pt") return value
  return unit.points === undefined ? null : value * unit.points
}
