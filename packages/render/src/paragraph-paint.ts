import {
  lastListLevel,
  spacingNames,
  type Color,
  type ElementLink,
  type ParagraphAlign,
  type ParagraphSpacing,
  type RunFormat,
  type TextFill,
  type TextList,
} from "@airdesign/document"

export type RunPaint = RunFormat & {
  readonly link?: ElementLink
  readonly size?: number
  readonly fill?: TextFill
  readonly color?: Color
  readonly font?: string
  readonly letterSpacing?: number
}
export type ParagraphPaint = {
  readonly align?: ParagraphAlign
  readonly list?: TextList
  readonly level?: number
  readonly number?: number
  readonly firstRun?: RunPaint & { readonly from: number }
} & ParagraphSpacing

export function paragraphPaint(dataset: DOMStringMap): ParagraphPaint {
  const { align, list, level } = dataset
  let paint: ParagraphPaint = {
    ...(align === "left" || align === "center" || align === "right" ? { align } : {}),
    ...(list === "none" || list === "bullets" || list === "numbers" ? { list } : {}),
    ...(level !== undefined && /^\d$/.test(level) && Number(level) <= lastListLevel ? { level: Number(level) } : {}),
  }
  for (const name of spacingNames) {
    const kept = dataset[name]
    if (kept !== undefined && /^\d+$/.test(kept)) paint = { ...paint, [name]: Number(kept) }
  }
  return paint
}
