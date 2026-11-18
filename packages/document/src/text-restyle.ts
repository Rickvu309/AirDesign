import { readTextValue, writeTextValue, type TextValue } from "./text-value.js"

type Loose = Readonly<Record<string, unknown>>

function shownText(value: string): TextValue {
  return readTextValue(value) ?? (value === "" ? [] : [{ from: 0, runs: [{ from: 0, text: value }] }])
}

const runKeys = ["fill", "color", "size", "font", "bold", "italic", "underline", "strike", "letterSpacing"] as const
const paragraphKeys = ["align", "list", "lineSpacing", "spaceBefore", "spaceAfter"] as const

function picked(input: Loose, keys: readonly string[]): Loose {
  return Object.fromEntries(keys.flatMap((key) => (Object.hasOwn(input, key) ? [[key, input[key]]] : [])))
}

export function restyled(value: string, input: Loose): string {
  const run = picked(input, Object.hasOwn(input, "fill") ? runKeys.filter((key) => key !== "color") : runKeys)
  const paragraph = picked(input, paragraphKeys)
  const text = shownText(value).map((each) => ({
    ...each,
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
