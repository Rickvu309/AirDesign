import type { AgentColor } from "./agent-change.js"
import { type Field, field } from "./agent-fields.js"
import { axisUnitBytes, chartLimits } from "./chart.js"
import {
  type Reader,
  boolean,
  finite,
  formed,
  forms,
  integer,
  list,
  literal,
  mismatch,
  object,
  words,
} from "./read-kit.js"

export type AgentChart = {
  readonly kind: "bar" | "column" | "line" | "pie" | "stacked"
  readonly categories: readonly string[]
  readonly series: readonly {
    readonly name: string
    readonly values: readonly number[]
    readonly color?: AgentColor
    readonly points?: readonly { readonly at: number; readonly color: AgentColor }[]
  }[]
  readonly labels?: boolean
  readonly unit?: string
}

const colorSchema = { $ref: "#/$defs/color" }

const chartSchema = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "categories", "series"],
  properties: {
    kind: { enum: ["bar", "column", "line", "pie", "stacked"] },
    categories: { type: "array", items: { type: "string" } },
    series: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "values"],
        properties: {
          name: { type: "string" },
          values: { type: "array", items: { type: "number" }, description: "One per category." },
          color: colorSchema,
          points: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["at", "color"],
              properties: { at: { type: "integer", minimum: 0 }, color: colorSchema },
            },
            description: "One point's colour, at its category's place from 0. Left out, the points keep their colours.",
          },
        },
      },
    },
    labels: { type: "boolean", description: "Show values where labels fit." },
    unit: {
      type: "string",
      description: `A currency symbol or code, % or one letter attaches to each number ($43.2M, -€2.5, ₹40, CHF 9, 50%, 12K). Any other unit (kg, thousand USD) is printed once at the value axis. AirDesign fits the unit to one line and ${axisUnitBytes} UTF-8 bytes and reports adjustments. A blank unit clears it.`,
    },
  },
}

const unitText = formed((raw) => (typeof raw === "string" ? raw : undefined), "A string.")

const chartReader =
  (readColor: Reader<AgentColor>): Reader<AgentChart> =>
  (raw) => {
    const chart = object(
      {
        kind: literal(["bar", "column", "line", "pie", "stacked"] as const),
        categories: list(words(200), chartLimits.categories, 1),
        series: list(
          object(
            { name: words(200), values: list(finite(-1e12, 1e12), chartLimits.categories) },
            {
              color: readColor,
              points: list(
                object({ at: integer(0, chartLimits.categories - 1), color: readColor }),
                chartLimits.categories,
              ),
            },
          ),
          chartLimits.series,
          1,
        ),
      },
      { labels: boolean, unit: unitText },
    )(raw)
    if (!chart.series.every((series) => series.values.length === chart.categories.length))
      return mismatch("series", forms.series)
    const placed = chart.series.every((series) => {
      const places = (series.points ?? []).map((point) => point.at)
      return places.every((at) => at < chart.categories.length) && new Set(places).size === places.length
    })
    if (!placed) return mismatch("points", forms.points)
    return chart.kind === "pie" && chart.series.some((series) => series.color !== undefined)
      ? mismatch("color", forms.pieColor)
      : chart
  }

export const chartField = (readColor: Reader<AgentColor>): Field<AgentChart> =>
  field(
    {
      ...chartSchema,
      description:
        "Data for a chart. Axes, gridlines and legend come from the deck. Colour one bar later with set on '<chart>#<series>:<category>'.",
    },
    chartReader(readColor),
  )
