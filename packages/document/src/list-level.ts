import type { TextList } from "./text-value.js"

const levelStep = 457_200
const hangs: Readonly<Record<TextList, number>> = { none: 0, bullets: 285_750, numbers: 457_200 }
const numberings = ["arabicPeriod", "alphaLcPeriod", "romanLcPeriod"] as const

export type ListIndent = { readonly marginLeft: number; readonly indent: number }

const bulletEms = 0.9
const pointEmu = 12_700

export function listIndent(level: number, list: TextList, size?: number): ListIndent {
  const hang = list === "bullets" && size !== undefined ? Math.round((size / 100) * pointEmu * bulletEms) : hangs[list]
  return { marginLeft: level * levelStep + hang, indent: hang === 0 ? 0 : -hang }
}

export function levelNumbering(level: number): (typeof numberings)[number] {
  return numberings[level % numberings.length] ?? "arabicPeriod"
}
