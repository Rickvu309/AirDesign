import { describe, expect, it } from "vitest"
import { defaultTheme, isRefusal, measureWith, resolveColor } from "../index.js"
import { clusteredChartComponent, expandComponent } from "./index.js"
import type { ComponentInput, ComponentTree } from "./index.js"

const input = {
  frame: { x: 0, y: 0, w: 1600, h: 780 },
  theme: defaultTheme,
  measure: measureWith({}),
}
const orientations = ["column", "bar"]
const sizes = [1, 3, 20].flatMap((series) => [3, 12, 100].map((categories) => ({ series, categories })))

function dataOf(series: number, categories: number) {
  return {
    categories: Array.from({ length: categories }, (_, i) => ({ id: `c${i}`, label: `Market ${i + 1}` })),
    series: Array.from({ length: series }, (_, i) => ({
      id: `s${i}`,
      label: `Series ${i + 1}`,
      values: Array.from({ length: categories }, (_, j) => [-35.5, 0, 1250.25][(i + j) % 3]),
      fill: null,
      fills: [],
    })),
  }
}

function expand(options: ComponentInput): ComponentTree {
  const result = expandComponent(clusteredChartComponent, options)
  if (isRefusal(result)) throw new Error(JSON.stringify(result))
  return result
}

describe.each(orientations)("%s chart", (orientation) => {
  it.each(sizes)("expands $series × $categories signed and zero observations", ({ series, categories }) => {
    const options = {
      ...input,
      data: dataOf(series, categories),
      variant: { orientation, sort: "data" },
      tokens: { unitHeader: "%" },
    }
    const chart = expand(options)
    const parts = chart.children
    const marks = parts.filter(({ key }) => key[0] === "bar")
    const shown = Math.min(3, series)
    const nonZero = options.data.series
      .slice(0, shown)
      .flatMap(({ values }) => values)
      .filter((value) => value !== 0)
    expect(marks).toHaveLength(nonZero.length)
    expect(new Set(marks.map(({ key }) => JSON.stringify(key))).size).toBe(marks.length)
    expect(parts.filter(({ key }) => key[0] === "legend-label")).toHaveLength(shown > 1 ? shown : 0)
    expect(parts.filter(({ props }) => props.text?.chars.includes("%")).map(({ props }) => props.text?.chars)).toEqual([
      "%",
    ])
    const baseline = parts.find(({ key }) => key[0] === "zero")?.props.box
    expect(baseline).toBeDefined()
    for (const {
      key,
      props: { box },
    } of marks) {
      const s = Number(key[2]?.slice(1))
      const c = Number(key[1]?.slice(1))
      const value = options.data.series[s]?.values[c]
      expect(value).toBeDefined()
      if (orientation === "bar") {
        if (value === -35.5) expect(box.x + box.w).toBe(baseline?.x)
        else expect(box.x).toBe(baseline?.x)
        expect(box.w).toBeGreaterThan(0)
      } else {
        if (value === 1250.25) expect(box.y + box.h).toBe(baseline?.y)
        else expect(box.y).toBe(baseline?.y)
        expect(box.h).toBeGreaterThan(0)
      }
    }
    if (categories === 100) {
      expect(chart.findings).toContainEqual(
        expect.objectContaining({ key: ["categories"], thinned: expect.any(Number) }),
      )
      const indices = parts.filter(({ key }) => key[0] === "category").map(({ key }) => Number(key[1]?.slice(1)))
      const step = (indices[1] ?? 0) - (indices[0] ?? 0)
      expect(step).toBeGreaterThan(1)
      expect(indices.every((index, i) => index === i * step)).toBe(true)
    }
    expect(chart.findings.some(({ key }) => key[0] === "many-series")).toBe(series > 3)
    expect(expand(options)).toEqual(chart)
  })
})

it("formats explicit precision and measures direct labels outside bars with explicit colours", () => {
  const data = dataOf(3, 3)
  const chart = expand({
    ...input,
    data: {
      ...data,
      series: data.series.map((series, i) =>
        i === 1 ? { ...series, fill: defaultTheme.colors.accent2, fills: [null, { var: "accent6" }] } : series,
      ),
    },
    variant: { orientation: "bar" },
    tokens: { title: "Share", unitHeader: "%", digits: 2, "number.locale": "de-DE" },
  })
  const part = (...key: string[]) => chart.children.find((node) => node.key.join("/") === key.join("/"))?.props
  const box = (role: string, c: string, s: string) => {
    const found = part(role, c, s)?.box
    if (!found) throw new Error(`Missing ${role} ${c} ${s}`)
    return found
  }
  expect(part("title")?.text?.chars).toBe("Share")
  expect(part("unit")?.text?.chars).toBe("%")
  expect(part("value", "c2", "s0")?.text?.chars).toBe("1.250,25")
  expect(part("value", "c1", "s0")?.text?.chars).toBe("0,00")
  const negative = box("value", "c0", "s0")
  expect(negative.x + negative.w).toBeLessThan(box("bar", "c0", "s0").x)
  const positive = box("bar", "c2", "s0")
  expect(box("value", "c2", "s0").x).toBeGreaterThan(positive.x + positive.w)
  const fill = (role: string, ...key: string[]) => {
    const paint = part(role, ...key)?.fills?.[0]
    return paint?.kind === "solid" ? resolveColor(paint.color, defaultTheme) : undefined
  }
  expect(fill("bar", "c0", "s0")).toBe(defaultTheme.colors.accent1)
  expect(fill("legend-swatch", "s1")).toBe(defaultTheme.colors.accent2)
  expect(fill("bar", "c1", "s1")).toBe(defaultTheme.colors.accent6)
  expect(fill("bar", "c0", "s2")).toBe(resolveColor({ var: "text2", tint: 0.56 }, defaultTheme))
})

it.each([
  [1250.125, "1,250"],
  [74.25, "74"],
  [4.125, "4.1"],
  [4, "4"],
])("shares the precision inferred from %s with zero and keeps units in the header", (value, formatted) => {
  const data = dataOf(1, 3)
  const chart = expand({
    ...input,
    data: { ...data, series: data.series.map((s) => ({ ...s, values: [value, 0, null, 999999] })) },
    tokens: { unitHeader: "$M" },
  })
  const byRole = (role: string) => chart.children.filter(({ key }) => key[0] === role)
  const zeros = ["0", "0.0", "0.00"]
  const decimals = formatted.split(".")[1]?.length ?? 0
  expect(byRole("value").map(({ props }) => props.text?.chars)).toEqual([formatted, zeros[decimals]])
  expect(byRole("bar")).toHaveLength(1)
  expect(byRole("unit")[0]?.props.text?.chars).toBe("$M")
  expect(byRole("tick")).toHaveLength(0)
})

it("keeps mark and legend keys when categories and series are renamed and reordered", () => {
  const data = dataOf(3, 3)
  const tree = expand({ ...input, data })
  const reordered = expand({
    ...input,
    data: {
      categories: data.categories.toReversed().map((row) => ({ ...row, label: "Same label" })),
      series: data.series.toReversed().map((row) => ({ ...row, label: "Same name", values: row.values.toReversed() })),
    },
  })
  const keys = ({ children }: ComponentTree) =>
    children
      .filter(({ key }) => ["bar", "category", "legend-swatch", "legend-label"].includes(key[0]))
      .map(({ key }) => JSON.stringify(key))
      .sort()
  expect(keys(tree)).toEqual(keys(reordered))
})

it("fits horizontal categories at one size and wraps without breaking a word", () => {
  const data = dataOf(1, 3)
  const chart = expand({
    ...input,
    frame: { ...input.frame, w: 650 },
    data: {
      ...data,
      categories: data.categories.map((category, i) =>
        i === 0 ? { ...category, label: "International Client Services" } : category,
      ),
    },
    variant: { orientation: "bar" },
  })
  const labels = chart.children.filter(({ key }) => key[0] === "category")
  expect(labels).toHaveLength(3)
  for (const { props } of labels) expect(props.text?.spans[0]?.size).toBe(18)
  const label = labels.find(({ key }) => key[1] === "c0")
  const words = label?.props.text
  if (words === undefined) throw new Error("Missing category text")
  const lines = input.measure(words, input.theme, label!.props.box.w).lines
  expect(
    lines.map((line) =>
      line.runs
        .map((run) => run.text)
        .join("")
        .trimEnd(),
    ),
  ).toEqual(["International", "Client Services"])
})

it("takes spacing between and within groups from separate tokens", () => {
  const data = dataOf(3, 3)
  const marks = (tokens: ComponentInput["tokens"]) =>
    expand({ ...input, data, tokens }).children.filter(({ key }) => key[0] === "bar")
  const original = marks({})
  const narrower = marks({ seriesShare: 0.5 })
  const tighter = marks({ categoryShare: 0.5 })
  expect(narrower[0]?.props.box.w).toBeLessThan(original[0]?.props.box.w ?? 0)
  expect(tighter[0]?.props.box.x).toBeGreaterThan(original[0]?.props.box.x ?? 0)
  expect(tighter[1]?.props.box.x).toBeLessThan(original[1]?.props.box.x ?? 0)
})

it("bounds series independently of the category limit", () => {
  const result = expandComponent(clusteredChartComponent, { ...input, data: dataOf(21, 3) })
  expect(result).toMatchObject({ refused: "limit", field: "data.series" })
})

it("centers horizontal numeric ticks on their gridlines when the text fits at the edge", () => {
  const chart = expand({ ...input, data: dataOf(3, 3), variant: { orientation: "bar", labels: false } })
  for (const {
    key,
    props: { box },
  } of chart.children.filter(({ key }) => key[0] === "tick")) {
    const grid = chart.children.find((part) => part.key[0] === "grid" && part.key[1] === key[1])
    if (grid !== undefined) expect(Math.abs(box.x + box.w / 2 - grid.props.box.x)).toBeLessThanOrEqual(1)
  }
})

it("keeps an explicit tint alongside the accent and comparison grey", () => {
  const data = dataOf(3, 3)
  const chart = expand({
    ...input,
    data: {
      ...data,
      series: data.series.map((s, i) => (i === 0 ? { ...s, fill: { var: "accent2", tint: 0.15 } } : s)),
    },
  })
  const swatches = chart.children.filter(({ key }) => key[0] === "legend-swatch")
  expect(swatches.map(({ props }) => props.fills?.[0])).toEqual([
    { kind: "solid", color: { var: "accent2", tint: 0.15 } },
    { kind: "solid", color: { var: "text2", tint: 0.24 } },
    { kind: "solid", color: { var: "text2", tint: 0.56 } },
  ])
})

it("right-aligns the bar categories in a gutter sized to their actual text", () => {
  const chart = expand({ ...input, data: dataOf(3, 3), variant: { orientation: "bar" } })
  const labels = chart.children.filter(({ key }) => key[0] === "category")
  const widths = labels.map(({ props }) => {
    if (props.text === undefined) throw new Error("Missing category text")
    expect(props.text.paras[0]?.align).toBe("right")
    return input.measure(props.text, input.theme, null).w
  })
  expect(labels).toHaveLength(3)
  const widest = Math.max(...widths)
  for (const { props } of labels) {
    expect(props.box.w).toBeGreaterThanOrEqual(widest)
    expect(props.box.w).toBeLessThan(widest + 16)
  }
})

it.each(orientations)("finds %s density before painting marks too thin to see", (orientation) => {
  const chart = expand({
    ...input,
    frame: { x: 0, y: 0, w: 420, h: 180 },
    data: dataOf(20, 100),
    variant: { orientation },
  })
  expect(chart.children.filter(({ key }) => key[0] === "bar")).toHaveLength(0)
  expect(chart.findings).toContainEqual(expect.objectContaining({ key: ["marks"], kind: "check" }))
})

it("reports when horizontal density hides value labels", () => {
  const chart = expand({ ...input, data: dataOf(20, 12), variant: { orientation: "bar" } })
  const marks = chart.children.filter(({ key }) => key[0] === "bar")
  expect(marks).toHaveLength(24)
  expect(marks.every(({ props }) => props.box.h >= 2)).toBe(true)
  expect(chart.children.filter(({ key }) => key[0] === "value")).toHaveLength(0)
  expect(chart.findings.filter(({ key }) => key[0] === "value-label-space")).toEqual([
    expect.objectContaining({ kind: "check" }),
  ])
  const labelsOff = expand({ ...input, data: dataOf(20, 12), variant: { orientation: "bar", labels: false } })
  expect(labelsOff.findings.some(({ key }) => key[0] === "value-label-space")).toBe(false)
})

it.each(orientations)("shows every value or a value axis in a crowded %s chart", (orientation) => {
  const data = dataOf(3, 4)
  const options = {
    ...input,
    tokens: { digits: 2 },
    data: { ...data, series: data.series.map((series) => ({ ...series, values: [1250.25, 1086, 1310, 1250] })) },
    variant: { orientation },
  }
  const wide = expand(options)
  expect(wide.children.filter(({ key }) => key[0] === "value")).toHaveLength(12)
  const narrow = expand({ ...options, frame: { ...input.frame, w: 650, h: 430 } })
  expect(narrow.children.filter(({ key }) => key[0] === "value")).toHaveLength(0)
  expect(narrow.children.some(({ key }) => key[0] === "tick")).toBe(true)
  expect(narrow.findings).toContainEqual(expect.objectContaining({ key: ["value-label-space"] }))
})

it("closes both gaps to keep all 300 marks visible in a crowded column chart", () => {
  const data = dataOf(3, 100)
  const chart = expand({
    ...input,
    frame: { ...input.frame, w: 850 },
    data: { ...data, series: data.series.map((series) => ({ ...series, values: series.values.map(() => 1) })) },
  })
  const marks = chart.children.filter(({ key }) => key[0] === "bar")
  expect(marks).toHaveLength(300)
  for (const { props } of marks) expect(props.box.w).toBeGreaterThanOrEqual(2)
  for (const [i, mark] of marks.slice(1).entries()) {
    const { x, w } = marks[i]!.props.box
    expect(mark.props.box.x).toBe(x + w)
  }
  expect(chart.findings.some(({ key }) => key[0] === "marks")).toBe(false)
})

it("shows direct value labels or a value axis", () => {
  const options = { ...input, data: dataOf(3, 4) }
  const roles = ({ children }: ComponentTree) => new Set(children.map(({ key }) => key[0]))
  const direct = roles(expand(options))
  expect(direct.has("value")).toBe(true)
  expect(direct.has("tick")).toBe(false)
  expect(direct.has("grid")).toBe(false)
  const axis = roles(expand({ ...options, variant: { labels: false } }))
  expect(axis.has("value")).toBe(false)
  expect(axis.has("tick")).toBe(true)
  expect(axis.has("grid")).toBe(true)
})

it("sorts bars by the lead series, keeps Other last, and holds column order", () => {
  const base = dataOf(1, 4)
  const data = {
    categories: base.categories.map((row, i) => ({ ...row, label: ["Small", "other markets", "Large", "Middle"][i] })),
    series: base.series.map((series) => ({ ...series, values: [2, 100, 9, 5] })),
  }
  const categories = (variant: ComponentInput["variant"]) =>
    expand({ ...input, data, variant })
      .children.filter(({ key }) => key[0] === "category")
      .map(({ key }) => key[1])
  expect(categories({ orientation: "bar" })).toEqual(["c2", "c3", "c0", "c1"])
  expect(categories({ orientation: "bar", sort: "data" })).toEqual(["c0", "c1", "c2", "c3"])
  expect(categories({ orientation: "column" })).toEqual(["c0", "c1", "c2", "c3"])
})

it("uses sign roles only for a signed series and honors explicit point fills", () => {
  const data = dataOf(1, 4)
  const one = { ...data.series[0]!, values: [1, -2, 3, 4], fills: [null, null, null, { var: "accent6" }] }
  const options = { ...input, data: { ...data, series: [one] }, tokens: { totalCategory: "c2" } }
  const fills = (variant: ComponentInput["variant"]) =>
    expand({ ...options, variant })
      .children.filter(({ key }) => key[0] === "bar")
      .map(({ props }) => props.fills?.[0])
  const solid = (color: unknown) => ({ kind: "solid", color })
  expect(fills({})).toEqual([
    solid({ var: "accent1" }),
    solid({ var: "accent1" }),
    solid({ var: "accent1" }),
    solid({ var: "accent6" }),
  ])
  expect(fills({ signed: true })).toEqual([
    solid({ var: "positive" }),
    solid({ var: "negative" }),
    solid({ var: "total" }),
    solid({ var: "accent6" }),
  ])
})

it("sorts stable keys on ties and keeps unplotted comparison series out of the domain", () => {
  const data = dataOf(4, 3)
  const chart = expand({
    ...input,
    data: {
      ...data,
      series: data.series.map((series, i) => ({ ...series, values: i === 3 ? [90_000, 90_000, 90_000] : [4, 4, 1] })),
    },
    variant: { orientation: "bar", labels: false },
    tokens: { focus: "s2" },
  })
  const categories = chart.children.filter(({ key }) => key[0] === "category")
  const legend = chart.children.filter(({ key }) => key[0] === "legend-swatch")
  expect(categories.map(({ key }) => key[1])).toEqual(["c0", "c1", "c2"])
  expect(legend.map(({ props }) => props.fills?.[0])).toEqual([
    { kind: "solid", color: { var: "text2", tint: 0.24 } },
    { kind: "solid", color: { var: "text2", tint: 0.56 } },
    { kind: "solid", color: { var: "accent1" } },
  ])
  expect(chart.findings).toContainEqual(expect.objectContaining({ kind: "check", key: ["many-series"] }))
  const ticks = chart.children.filter(({ key }) => key[0] === "tick")
  expect(ticks.map(({ props }) => props.text?.chars)).toEqual(["0", "1", "2", "3", "4"])
})

it("derives scaled tick digits from the axis and applies the shared label default separately", () => {
  const data = dataOf(1, 3)
  const options = {
    ...input,
    data: { ...data, series: data.series.map((series) => ({ ...series, values: [250, 500, 920] })) },
    tokens: { scale: 1000 },
  }
  const labels = (chart: ComponentTree, role: string) =>
    chart.children.filter(({ key }) => key[0] === role).map(({ props }) => props.text?.chars)
  const axis = expand({ ...options, variant: { labels: false } })
  expect(labels(axis, "tick")).toEqual(["0.0", "0.2", "0.4", "0.6", "0.8", "1.0"])
  expect(labels(expand(options), "value")).toEqual(["0.3", "0.5", "0.9"])
})

it("shows distinct small tick values on a tiny axis", () => {
  const data = dataOf(1, 3)
  const chart = expand({
    ...input,
    data: { ...data, series: data.series.map((series) => ({ ...series, values: [0.01, 0.02, 0.03] })) },
    variant: { labels: false },
  })
  const ticks = chart.children.filter(({ key }) => key[0] === "tick").map(({ props }) => props.text?.chars)
  expect(ticks).toEqual(["0.00", "0.01", "0.02", "0.03"])
})

it.each([
  [3, 6, 1200, 620],
  [2, 8, 1000, 560],
])("shows an axis when wide values cannot fit in %i × %i series lanes", (series, categories, w, h) => {
  const base = dataOf(series, categories)
  const data = {
    categories: base.categories.map((category, i) => ({ ...category, label: `Q${i + 1}` })),
    series: base.series.map((row, i) => ({
      ...row,
      values: row.values.map((_, j) => 12000 + i * 9111 + j * 4321),
    })),
  }
  const chart = expand({
    ...input,
    data,
    frame: { x: 0, y: 0, w, h },
    tokens: { title: "Revenue by quarter", unitHeader: "$ thousands", source: "Demo figures" },
  })
  expect(chart.children.filter(({ key }) => key[0] === "value")).toHaveLength(0)
  expect(chart.children.some(({ key }) => key[0] === "tick")).toBe(true)
  expect(chart.findings).toContainEqual(expect.objectContaining({ key: ["value-label-space"] }))
})

it("sorts bars by the focus series and recognizes Other as a whole word", () => {
  const base = dataOf(2, 4)
  const chart = expand({
    ...input,
    data: {
      categories: base.categories.map((row, i) => ({
        ...row,
        label: ["Small", "Other markets", "Otherside Ltd", "Middle"][i],
      })),
      series: base.series.map((row, i) => ({ ...row, values: i === 0 ? [5, 6, 8, 9] : [1, 100, 9, 5] })),
    },
    variant: { orientation: "bar" },
    tokens: { focus: "s1" },
  })
  expect(chart.children.filter(({ key }) => key[0] === "category").map(({ key }) => key[1])).toEqual([
    "c2",
    "c3",
    "c0",
    "c1",
  ])
})

it("fits the directly labeled vertical scale to the signed data extent", () => {
  const base = dataOf(1, 3)
  const draw = (values: number[]) =>
    expand({
      ...input,
      data: { ...base, series: base.series.map((row) => ({ ...row, values })) },
    })
  const zero = draw([0, 3, 13]).children.find(({ key }) => key[0] === "zero")!.props.box.y
  const signed = draw([-2, 3, 13])
  const low = signed.children.find(({ key }) => key[0] === "bar" && key[1] === "c0")!.props.box
  const label = signed.children.find(({ key }) => key[0] === "value" && key[1] === "c0")!.props.box
  expect(low.y + low.h + 7).toBe(label.y)
  expect(label.y + label.h).toBe(zero)
})
