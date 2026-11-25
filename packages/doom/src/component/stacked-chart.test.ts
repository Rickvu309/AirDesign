import { expect, it } from "vitest"
import { defaultTheme, type Hex, isRefusal, measureWith, resolveColor, themeLibrary } from "../index.js"
import { contrast, validatorDeltaE } from "./testing/palette-checks.js"
import { type ComponentTree, expandComponent } from "./index.js"
import { componentSpec } from "./library.js"

const measure = measureWith({})
const category = (id: string) => ({ id, label: id })
const series = (id: string, color: unknown = null) => ({ id, label: id, color })
const segment = (id: string, category: string, series: string, value: number) => ({
  id,
  category,
  series,
  value,
  color: null,
})

function expand(
  data: unknown,
  variant = {},
  tokens = {},
  theme = defaultTheme,
  focus: readonly string[] = [],
  frame = { x: 0, y: 0, w: 1540, h: 650 },
) {
  const result = expandComponent(componentSpec("stacked")!, {
    theme,
    measure,
    frame,
    data,
    variant,
    tokens,
    focus,
  })
  if (isRefusal(result)) throw new Error(JSON.stringify(result))
  return result
}

const part = (tree: ComponentTree, ...key: string[]) =>
  tree.children.find(({ key: actual }) => actual.length === key.length && actual.every((value, i) => value === key[i]))
const box = (tree: ComponentTree, ...key: string[]) => part(tree, ...key)?.props.box
const chars = (tree: ComponentTree, ...key: string[]) => part(tree, ...key)?.props.text?.chars
const fill = (tree: ComponentTree, ...key: string[]) => part(tree, ...key)?.props.fills?.[0]
const count = (tree: ComponentTree, role: string) => tree.children.filter(({ key }) => key[0] === role).length
const edge = (tree: ComponentTree, ...key: string[]) => {
  const found = box(tree, ...key)
  if (found === undefined) throw new Error(`Expected ${key.join("/")}`)
  return found.y + found.h
}

const themes = Object.values(themeLibrary).map(({ id, theme }) => [id, theme] as const)
const threeSeries = {
  categories: [category("a"), category("b")],
  series: [series("plan"), series("actual"), series("prior")],
  segments: ["a", "b"].flatMap((c, n) =>
    ["plan", "actual", "prior"].map((s, i) => segment(`${c}-${s}`, c, s, 10 + i + n)),
  ),
}
const painted = (tree: ComponentTree, theme: typeof defaultTheme, ...key: string[]) => {
  const paint = fill(tree, ...key)
  if (paint?.kind !== "solid") throw new Error(`Expected a solid fill for ${key.join("/")}`)
  return resolveColor(paint.color, theme)
}

const labelStates = themes.flatMap(([id, theme]) => [true, false].map((labels) => [id, labels, theme] as const))

it.each(labelStates)("tells every series apart at 3:1 on the background in %s, labels %s", (_id, labels, theme) => {
  const tree = expand(threeSeries, { legend: true, labels }, {}, theme)
  const fills = [
    ...new Set(
      tree.children.flatMap(({ key }) =>
        key[0] === "segment" || key[0] === "legend-swatch" ? [painted(tree, theme, ...key)] : [],
      ),
    ),
  ]
  for (const [i, left] of fills.entries()) {
    expect(contrast(left, theme.colors.background as Hex)).toBeGreaterThanOrEqual(3)
    for (const right of fills.slice(i + 1)) expect(validatorDeltaE(left, right)).toBeGreaterThanOrEqual(15)
  }
  const folded = tree.findings.some((finding) => finding.kind === "advice" && finding.code === "series-folded")
  expect(folded).toBe(fills.length < 3)
})

it.each(themes)("tells every series it shows apart, in the plot and the legend, in %s", (_id, theme) => {
  const tree = expand(threeSeries, { legend: true }, {}, theme)
  const shown = tree.children.filter(({ key }) => key[0] === "legend-swatch").map(({ key }) => key.slice(1))
  const swatches = shown.map((id) => painted(tree, theme, "legend-swatch", ...id))
  expect(new Set(swatches).size).toBe(shown.length)
  for (const c of ["a", "b"]) {
    const segments = tree.children.filter(({ key }) => key[0] === "segment" && key[1] === c)
    const fills = segments.map(({ key }) => painted(tree, theme, ...key))
    expect(segments).toHaveLength(shown.length)
    expect(new Set(fills).size).toBe(segments.length)
  }
})

it("sums the series a theme cannot tell apart as Other and says how to show them", () => {
  const theme = themeLibrary.editorial!.theme
  const tree = expand(threeSeries, { legend: true }, {}, theme)
  expect(chars(tree, "legend-label", "plan")).toBe("plan")
  expect(chars(tree, "legend-label", "other", "aggregate")).toBe("Other")
  expect(count(tree, "legend-label")).toBe(2)
  expect(chars(tree, "value", "b", "other", "aggregate")).toBe(String(11 + 12 + 2))
  expect(part(tree, "segment", "a", "a-actual")).toBeUndefined()
  expect(tree.findings).toContainEqual(
    expect.objectContaining({
      kind: "advice",
      code: "series-folded",
      note: "Summed 2 series as Other. Show at most 2 series, or split the chart to show each one.",
    }),
  )
  expect(tree.findings.some(({ kind }) => kind === "many-series")).toBe(false)
})

it("keeps as many series as the theme has greys for and sums the rest", () => {
  const four = {
    ...threeSeries,
    series: [...threeSeries.series, series("target")],
    segments: [...threeSeries.segments, segment("a-target", "a", "target", 4)],
  }
  const tree = expand(four, { legend: true })
  expect(tree.children.filter(({ key }) => key[0] === "legend-label").map(({ key }) => key[1])).toEqual([
    "plan",
    "actual",
    "other",
  ])
  expect(chars(tree, "value", "a", "other", "aggregate")).toBe(String(12 + 4))
})

it("never sums a series with its own colour or the focused one", () => {
  const coloured = {
    ...threeSeries,
    series: [series("plan"), series("actual", { var: "accent4" }), series("prior")],
  }
  const tree = expand(coloured, { legend: true }, {}, themeLibrary.editorial!.theme, ["prior"])
  expect(tree.children.filter(({ key }) => key[0] === "legend-label").map(({ key }) => key[1])).toEqual([
    "plan",
    "actual",
    "prior",
  ])
})

it("parts touching segments with a 2 px background seam", () => {
  const tree = expand({
    categories: [category("a")],
    series: [series("core"), series("support"), series("loss")],
    segments: [
      segment("core", "a", "core", 30),
      segment("support", "a", "support", 20),
      segment("loss", "a", "loss", -10),
    ],
  })
  expect(edge(tree, "segment", "a", "core")).toBe(box(tree, "zero")?.y)
  expect(edge(tree, "segment", "a", "support")).toBe((box(tree, "segment", "a", "core")?.y ?? 0) - 2)
  expect(box(tree, "segment", "a", "loss")?.y).toBe(box(tree, "zero")?.y)
})

const stackOf = (...values: readonly number[]) => ({
  categories: [category("a")],
  series: values.map((_, i) => series(`s${i}`, { var: "accent1" })),
  segments: values.map((value, i) => segment(`s${i}`, "a", `s${i}`, value)),
})
const wide = { x: 0, y: 0, w: 1000, h: 500 }

it.each([
  ["above", 1],
  ["below", -1],
] as const)("keeps a thin segment %s zero visible on a tall one, with no seam between them", (_side, sign) => {
  const tree = expand(stackOf(1000 * sign, 5 * sign), { labels: false }, {}, defaultTheme, [], wide)
  const large = box(tree, "segment", "a", "s0")!
  const small = box(tree, "segment", "a", "s1")!
  expect(small.h).toBeGreaterThanOrEqual(1)
  if (sign > 0) expect(small.y + small.h).toBe(large.y)
  else expect(small.y).toBe(large.y + large.h)
})

it("draws every nonzero segment at least 1 px tall", () => {
  const tree = expand(stackOf(100_000, 1, 1, 100_000), { labels: false }, {}, defaultTheme, [], wide)
  for (const id of ["s0", "s1", "s2", "s3"]) expect(box(tree, "segment", "a", id)!.h).toBeGreaterThanOrEqual(1)
})
