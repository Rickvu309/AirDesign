import type { TextList } from "./text-value.js"

const levelStep = 457_200
const hangs: Readonly<Record<TextList, number>> = { none: 0, bullets: 285_750, numbers: 457_200 }
const numberings = ["arabicPeriod", "alphaLcPeriod", "romanLcPeriod"] as const

export type ListIndent = { readonly marginLeft: number; readonly indent: number }

export function listIndent(level: number, list: TextList): ListIndent {
  const hang = hangs[list]
  return { marginLeft: level * levelStep + hang, indent: hang === 0 ? 0 : -hang }
}

export function levelNumbering(level: number): (typeof numberings)[number] {
  return numberings[level % numberings.length] ?? "arabicPeriod"
}
