import { readTextValue, writeTextValue, type TextParagraph, type TextValue } from "./text-value.js"

type Loose = Readonly<Record<string, unknown>>

function shownText(value: string): TextValue {
  return readTextValue(value) ?? (value === "" ? [] : [{ from: 0, runs: [{ from: 0, text: value }] }])
}

const runKeys = [
  "fill",
  "color",
  "size",
  "font",
  "bold",
  "italic",
  "underline",
  "strike",
  "letterSpacing",
  "case",
] as const
const paragraphKeys = ["align", "list", "lineHeight", "spaceBefore", "spaceAfter"] as const

function picked(input: Loose, keys: readonly string[]): Loose {
  return Object.fromEntries(keys.flatMap((key) => (Object.hasOwn(input, key) ? [[key, input[key]]] : [])))
}

function withoutFixedLine(paragraph: TextParagraph): TextParagraph {
  const { lineHeightPoints: _fixed, ...rest } = paragraph
  return rest
}

function withoutPercentLine(paragraph: TextParagraph): TextParagraph {
  const { lineHeight: _percent, ...rest } = paragraph
  return rest
}

export function fixedLineHeight(value: string, points: number): string {
  const text = shownText(value).map((each) => ({ ...withoutPercentLine(each), lineHeightPoints: points }))
  return text.length === 0 ? "" : writeTextValue(text)
}

export function restyled(value: string, input: Loose): string {
  const run = picked(input, Object.hasOwn(input, "fill") ? runKeys.filter((key) => key !== "color") : runKeys)
  const paragraph = picked(input, paragraphKeys)
  const text = shownText(value).map((each) => ({
    ...(Object.hasOwn(paragraph, "lineHeight") ? withoutFixedLine(each) : each),
    ...paragraph,
    runs: each.runs.map((item) => {
      const { color, fill, ...rest } = item
      return {
        ...rest,
        ...(Object.hasOwn(run, "fill") ? {} : color === undefined ? {} : { color }),
        ...(Object.hasOwn(run, "color") ? {} : fill === undefined ? {} : { fill }),
        ...run,
      }
    }),
  })) as TextValue
  return text.length === 0 ? "" : writeTextValue(text)
}
