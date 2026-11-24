import type { Chart } from "../index.js"

export type ChartCase = {
  readonly name: string
  readonly w: number
  readonly h: number
  readonly categories: readonly string[]
  readonly series: Chart["series"]
  readonly unit?: string
}

export const chartKinds = ["line", "bar", "column", "stacked", "pie"] as const

const extremes = [-2.5, 0, 987654321012.34, 0.004, 324000000000.25]
const fiveNames = ["Loss", "Zero", "Huge", "Tiny", "Major"]
const numbered = (count: number) => Array.from({ length: count }, (_, at) => `Category ${String(at + 1)}`)
const spread = (count: number) =>
  Array.from({ length: count }, (_, at) => [1200, -300, 45.5, 880, 2500, 15][at % 6]! * (1 + (at % 3)))
const manyValues = numbered(40).map((_, at) => [(at % 7) * 1234.5 - 3000, 987654321012.34, 0.004, -2.5][at % 4]!)
const quarters = ["Q1", "Q2", "Q3", "Q4"]
const small = [120, -30, 450.5, 88, 250]

export const operatingCost = [
  { name: "Personnel", values: [460, 585, 510, 620] },
  { name: "Vendor services", values: [210, 234, 268, 271] },
  { name: "Infrastructure", values: [85, 100, 90, 112] },
  { name: "Marketing", values: [98, 110, 124, 132] },
  { name: "General & administrative", values: [120, 142, 150, 147] },
]

export const revenue = [
  { name: "Recurring revenue", values: [1200, 1350, 1440, 1550] },
  { name: "Services", values: [150, 175, 165, 190] },
]

export const budget = [
  "Employee salaries",
  "Contractor fees",
  "Software subscriptions",
  "Hosting and storage",
  "Insurance premiums",
  "Customer acquisition",
  "Facilities and travel",
  "Professional services",
].map((name, at) => ({ name, values: [80 + at * 8, 130 + at * 7, 90 + at * 11, 112 + at * 12] }))

export const recycling = [
  "Glass bottles",
  "Cardboard boxes",
  "Corrugated paper",
  "Plastic containers",
  "Plastic film",
  "Aluminum cans",
  "Steel cans",
  "Newspaper",
  "Office paper",
  "Clear glass",
  "Mixed glass",
  "Other materials",
]

const sales = (values: readonly number[]) => [{ name: "Sales", values }]
const each = (units: readonly (string | undefined)[], made: (unit: string | undefined) => ChartCase[]) =>
  units.flatMap(made)
const unitOf = (unit: string | undefined) => (unit === undefined ? {} : { unit })

export const chromiumCases: readonly ChartCase[] = [
  ...each([undefined, "thousand USD", "دولار", "$M", "%"], (unit) => [
    { name: "fixture900x460", w: 900, h: 460, categories: fiveNames, series: sales(extremes), ...unitOf(unit) },
  ]),
  ...each([undefined, "thousand USD", "دولار"], (unit) => [
    { name: "narrow360x300", w: 360, h: 300, categories: fiveNames, series: sales(extremes), ...unitOf(unit) },
  ]),
  ...each([undefined, "thousand USD"], (unit) => [
    { name: "tiny240x200", w: 240, h: 200, categories: fiveNames, series: sales(extremes), ...unitOf(unit) },
  ]),
  ...each([undefined, "thousand USD", "دولار"], (unit) => [
    {
      name: "many40",
      w: 900,
      h: 460,
      categories: numbered(40),
      series: [
        { name: "Sales", values: manyValues },
        { name: "Cost", values: manyValues.map((value) => value / 2) },
      ],
      ...unitOf(unit),
    },
  ]),
  ...each([undefined, "thousand USD"], (unit) => [
    {
      name: "twoSeries5",
      w: 900,
      h: 460,
      categories: fiveNames,
      series: [
        { name: "Sales", values: extremes },
        { name: "Cost", values: extremes.map((value) => value * 0.9 - 1) },
      ],
      ...unitOf(unit),
    },
  ]),
  ...each([undefined, "$M", "thousand USD", "دولار"], (unit) => [
    { name: "w640x400", w: 640, h: 400, categories: fiveNames, series: sales(small), ...unitOf(unit) },
    { name: "w480x360", w: 480, h: 360, categories: fiveNames, series: sales(small), ...unitOf(unit) },
    ...[8, 12, 20].map((count) => ({
      name: `cats${String(count)}`,
      w: 900,
      h: 460,
      categories: numbered(count),
      series: sales(spread(count)),
      ...unitOf(unit),
    })),
  ]),
  ...each([undefined, "thousand USD", "دولار", "$M"], (unit) => [
    { name: "operating-cost", w: 900, h: 460, categories: quarters, series: operatingCost, ...unitOf(unit) },
    { name: "revenue-compact", w: 640, h: 400, categories: quarters, series: revenue, ...unitOf(unit) },
  ]),
  {
    name: "pie-small-slices",
    w: 900,
    h: 460,
    categories: ["Small", "Tiny", "Major"],
    series: [{ name: "Revenue", values: [5, 3, 92] }],
    unit: "$M",
  },
  { name: "tiny240x200", w: 240, h: 200, categories: fiveNames, series: sales(extremes), unit: "دولار" },
  {
    name: "twoSeries5",
    w: 900,
    h: 460,
    categories: fiveNames,
    series: [
      { name: "Sales", values: extremes },
      { name: "Cost", values: extremes.map((value) => value * 0.9 - 1) },
    ],
    unit: "دولار",
  },
]

export const compactCases: readonly ChartCase[] = [
  { name: "budget-eight-series", w: 480, h: 360, categories: quarters, series: budget, unit: "thousand USD" },
  {
    name: "recycling-twelve",
    w: 480,
    h: 360,
    categories: recycling,
    series: [{ name: "Recycling", values: [15, 12, 10, 8, 4, 6, 5, 3, 8, 12, 7, 10] }],
    unit: "kg",
  },
]

export const chartOfCase = (kind: (typeof chartKinds)[number], one: ChartCase): Chart => ({
  kind,
  labels: true,
  categories: one.categories,
  series: kind === "pie" ? one.series.slice(0, 1) : one.series,
  ...unitOf(one.unit),
})
