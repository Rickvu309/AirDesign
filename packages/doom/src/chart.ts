import { type Color, readColor } from "./paint.js"
import { type Reader, boolean, dictionary, finite, list, literal, object, reject, words } from "./read-kit.js"

export type Chart = {
  readonly kind: "bar" | "column" | "line" | "pie" | "stacked"
  readonly categories: readonly string[]
  readonly series: readonly { readonly name: string; readonly values: readonly number[]; readonly color?: Color }[]
  readonly labels?: boolean
  readonly unit?: string
  readonly points?: Readonly<Record<string, Color>>
}

export const readAxisUnit: Reader<string> = (raw) => {
  const name = words(24, 1)(raw)
  const trimmed = name.trim()
  return trimmed === "" ? reject() : trimmed
}

const readFrame = object(
  {
    kind: literal(["bar", "column", "line", "pie", "stacked"]),
    categories: list(words(200), 200),
    series: list(object({ name: words(200), values: list(finite(-1e12, 1e12), 200) }, { color: readColor }), 20),
  },
  { labels: boolean, unit: readAxisUnit, points: dictionary(/^[^\s]{1,120}$/, readColor, 400) },
)

export const readChart: Reader<Chart> = (raw) => {
  const chart = readFrame(raw)
  return chart.series.every((series) => series.values.length === chart.categories.length) ? chart : reject()
}
