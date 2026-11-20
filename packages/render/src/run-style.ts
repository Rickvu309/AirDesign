import { coveredRuns, type TextRange, type TextRun, type TextValue } from "@airdesign/document"
import { boldWeight, namedFace, regularWeight, styleTypeface, type FontStyle } from "@airdesign/fonts"
import type { FileWeight } from "./run-weight.js"

type Fonts = Readonly<Record<string, string>>

function typefaceOf(run: TextRun, file: FileWeight, fonts: Fonts): string | null {
  return run.font === undefined ? file.typeface : (fonts[run.font] ?? run.font)
}

export function runFontStyle(run: TextRun, file: FileWeight, fonts: Fonts = {}): FontStyle {
  const typeface = typefaceOf(run, file, fonts)
  const named = typeface === null ? undefined : namedFace(typeface)
  const bold = run.bold ?? file.bold
  return { weight: bold ? boldWeight : (named?.weight ?? regularWeight), italic: run.italic ?? file.italic }
}

export function weightState(
  value: TextValue,
  range: TextRange | null,
  file: (paragraph: number, run: number) => FileWeight,
  fonts: Fonts = {},
): FontStyle | "mixed" | null {
  const styles = coveredRuns(value, range).map(({ paragraph, run }) =>
    runFontStyle(run, file(paragraph.from, run.from), fonts),
  )
  const [first] = styles
  if (first === undefined) return null
  return styles.every((style) => style.weight === first.weight && style.italic === first.italic) ? first : "mixed"
}

export function styledRun(run: TextRun, file: FileWeight, wanted: FontStyle, fonts: Fonts = {}): TextRun {
  const typeface = typefaceOf(run, file, fonts)
  const named = typeface === null ? undefined : namedFace(typeface)
  const face = typeface === null ? null : styleTypeface(named?.family ?? typeface, wanted.weight)
  const emboldened = wanted.weight === boldWeight
  return {
    ...run,
    ...(face === null || face === typeface ? {} : { font: face }),
    ...(emboldened === (run.bold ?? file.bold) ? {} : { bold: emboldened }),
    ...(wanted.italic === (run.italic ?? file.italic) ? {} : { italic: wanted.italic }),
  }
}
