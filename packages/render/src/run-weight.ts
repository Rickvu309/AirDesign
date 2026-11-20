import type { TextRun } from "@airdesign/document"
import {
  boldWeight,
  listedStyles,
  namedFace,
  regularWeight,
  steppedWeight,
  styleTypeface,
  type ServedFace,
} from "@airdesign/fonts"

export type FileWeight = { readonly typeface: string | null; readonly bold: boolean; readonly italic: boolean }

export function weightedRun(
  run: TextRun,
  file: FileWeight,
  step: 1 | -1,
  faces: (family: string) => readonly ServedFace[] | undefined,
  fonts: Readonly<Record<string, string>> = {},
): TextRun {
  const typeface = run.font === undefined ? file.typeface : (fonts[run.font] ?? run.font)
  if (typeface === null) return run
  const named = namedFace(typeface)
  const family = named?.family ?? typeface
  const bold = run.bold ?? file.bold
  const current = { weight: bold ? boldWeight : (named?.weight ?? regularWeight), italic: run.italic ?? file.italic }
  const next = steppedWeight(current, listedStyles(family, faces), step)
  if (next === null) return run
  const face = styleTypeface(family, next.weight)
  const emboldened = next.weight === boldWeight
  return { ...run, ...(face === typeface ? {} : { font: face }), ...(emboldened === bold ? {} : { bold: emboldened }) }
}
