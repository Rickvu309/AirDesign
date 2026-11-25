import { describe, expect, it } from "vitest"
import { defaultTheme, isRefusal, measureWith, resolveColor } from "../index.js"
import { expandComponent, type ComponentSpec } from "./index.js"
import { lineComponent, pieComponent, donutComponent } from "./library.js"

function expand(spec: ComponentSpec, data: unknown, variant = {}, frame = { x: 0, y: 0, w: 1100, h: 620 }) {
  const tree = expandComponent(spec, { data, frame, variant, theme: defaultTheme, measure: measureWith({}) })
  if (isRefusal(tree)) throw new Error(JSON.stringify(tree))
  return tree
}

function lineData(series: number, points: number) {
  return {
    categories: Array.from({ length: points }, (_, i) => ({ id: `p${i}`, label: `Period ${i + 1}` })),
    series: Array.from({ length: series }, (_, i) => ({
      id: `s${i}`,
      label: `Series ${i + 1}`,
      values: Array.from({ length: points }, (_, p) => (p % 2 === 0 ? -p - i : p + i)),
    })),
  }
}

describe("line component", () => {
  it.each([1, 3, 8].flatMap((series) => [2, 12, 100].map((points) => [series, points])))(
    "paints %i series of %i points on the shared scale",
    (series, points) => {
      const children = expand(lineComponent, lineData(series, points)).children
      expect(children.filter(({ key }) => key[0] === "trace")).toHaveLength(series)
      const markers = children.filter(({ key }) => key[0] === "markers")
      expect(
        markers.reduce(
          (n, { props }) => n + (props.geometry.kind === "path" ? props.geometry.d.split("M").length - 1 : 0),
          0,
        ),
      ).toBe(series * points)
      expect(children.some(({ key }) => key[0] === "zero")).toBe(true)
      expect(new Set(children.map(({ key }) => JSON.stringify(key))).size).toBe(children.length)
    },
  )

  it("labels two series at their endpoints even when they coincide", () => {
    const data = lineData(2, 4)
    const marker = { var: "accent5", tint: 0.25 }
    const series = [
      {
        id: "forecast",
        label: "Forecast",
        values: [0, 2.25, -1.2, 10],
        color: { var: "accent3" },
        markers: [null, null, marker],
      },
      { id: "measured", label: "Measured", values: [1, -1, 3, 8] },
    ]
    const { children } = expand(lineComponent, { ...data, series }, { labels: true })
    expect(children.filter(({ key }) => key[0] === "end-label").map(({ props }) => props.text?.chars)).toEqual([
      "Forecast",
      "Measured",
    ])
    expect(children.find(({ key }) => key[0] === "end-label")?.props.text?.spans[0]?.color).toEqual({ var: "text" })
    expect(children.find(({ key }) => key[0] === "end-swatch")?.props.strokes?.[0]).toMatchObject({
      color: { var: "accent3" },
    })
    const traces = children.filter(({ key }) => key[0] === "trace")
    expect(traces[0]?.props.strokes?.[0]).toMatchObject({ color: { var: "accent3" } })
    expect(traces.map(({ props }) => props.stroke?.weight)).toEqual([4, 2])
    expect(
      children.some(
        ({ key, props }) =>
          key[0] === "markers" &&
          props.fills?.[0]?.kind === "solid" &&
          typeof props.fills[0].color === "object" &&
          props.fills[0].color.var === marker.var,
      ),
    ).toBe(true)
    expect(children.some(({ key }) => key[0] === "value")).toBe(true)
    const tied = expand(lineComponent, {
      ...data,
      series: series.map((s) => ({ ...s, values: [0, 2, 1, 10] })),
    }).children
    expect(tied.filter(({ key }) => key[0] === "legend")).toHaveLength(0)
    expect(tied.filter(({ key }) => key[0] === "end-label")).toHaveLength(2)
  })

  it("thins colliding fallback category labels and reports the omissions", () => {
    const data = lineData(4, 12)
    const series = data.series.map((row) => ({ ...row, values: data.series[0]!.values }))
    const categories = data.categories.map(({ id }, i) => ({ id, label: `Reporting Period ${i + 1}` }))
    const { children, findings } = expand(lineComponent, { categories, series })
    const boxes = children.filter(({ key }) => key[0] === "category").map(({ props }) => props.box)
    expect(children.some(({ key }) => key[0] === "legend")).toBe(true)
    expect(boxes.length).toBeLessThan(categories.length)
    expect(boxes.every((box, i) => i === 0 || box.x >= boxes[i - 1]!.x + boxes[i - 1]!.w)).toBe(true)
    expect(findings).toContainEqual(
      expect.objectContaining({ key: ["categories"], thinned: categories.length - boxes.length }),
    )
  })

  it("uses one accent and a bounded grey ramp and flags dense lines", () => {
    const { children, findings } = expand(lineComponent, lineData(8, 12))
    const colors = children.flatMap(({ key, props }) => {
      const stroke = props.strokes?.[0]
      return key[0] === "trace" && stroke?.kind === "solid" ? [resolveColor(stroke.color, defaultTheme)] : []
    })
    expect(new Set(colors).size).toBe(3)
    expect(colors[0]).toBe(defaultTheme.colors.accent1)
    expect(colors.slice(1)).toEqual([colors[1], colors[2], colors[1], colors[2], colors[1], colors[2], colors[1]])
    expect(findings).toContainEqual(expect.objectContaining({ kind: "many-series", count: 8, capacity: 3 }))
    expect(findings).toContainEqual(expect.objectContaining({ key: ["series-density"] }))
  })

  it("moves the accent to the named focus series", () => {
    const tree = expandComponent(lineComponent, {
      data: lineData(3, 4),
      frame: { x: 0, y: 0, w: 1100, h: 620 },
      focus: ["s1"],
      theme: defaultTheme,
      measure: measureWith({}),
    })
    if (isRefusal(tree)) throw new Error(JSON.stringify(tree))
    const colorOf = (series: string) =>
      tree.children.find(({ key }) => key[0] === "trace" && key[1] === series)?.props.strokes?.[0]
    expect(colorOf("s1")).toMatchObject({ color: { var: "accent1" } })
    expect(colorOf("s0")).toMatchObject({ color: { var: "text2", tint: expect.any(Number) } })
    expect(colorOf("s2")).toMatchObject({ color: { var: "text2", tint: expect.any(Number) } })
  })

  it("reports density when optional values are enabled on all 800 points", () => {
    const { children, findings } = expand(lineComponent, lineData(8, 100), { labels: true })
    expect(children.some(({ key }) => key[0] === "value")).toBe(true)
    expect(findings).toContainEqual(expect.objectContaining({ key: ["value-density"] }))
  })

  it("uses category IDs for traces and keeps signed observations on either side of zero", () => {
    const data = lineData(1, 3)
    const series = [{ id: "s", label: "Series", values: [-2, 0, 4] }]
    const input = { ...data, series }
    const tree = expand(lineComponent, input)
    expect(expand(lineComponent, input)).toEqual(tree)
    const trace = tree.children.find(({ key }) => key[0] === "trace")
    expect(trace?.key).toEqual(["trace", "s", "p0"])
    const zero = tree.children.find(({ key }) => key[0] === "zero")
    if (
      trace?.props.geometry.kind !== "path" ||
      zero?.props.geometry.kind !== "line" ||
      !("y" in zero.props.geometry.start)
    )
      throw new Error("Expected a path and a zero line")
    const values = trace.props.geometry.d.split(/[ML]/).slice(1)
    const points = values.map((value) => Number(value.split(" ")[1]) * trace.props.box.h)
    expect(points[0]).toBeGreaterThan(zero.props.geometry.start.y)
    expect(points[1]).toBeCloseTo(zero.props.geometry.start.y, 0)
    expect(points[2]).toBeLessThan(zero.props.geometry.start.y)
  })

  it("uses a marker for one observation and leaves a gap for a missing value", () => {
    const single = expand(lineComponent, lineData(1, 1)).children
    expect(single.some(({ key }) => key[0] === "trace")).toBe(false)
    expect(single.filter(({ key }) => key[0] === "markers")).toHaveLength(1)
    const data = lineData(1, 5)
    const series = [{ id: "s", label: "Series", values: [-1, 0, null, 1, 2] }]
    expect(expand(lineComponent, { ...data, series }).children.filter(({ key }) => key[0] === "trace")).toHaveLength(2)
  })
})

const mix = (values: number[]) => ({
  series: [{ id: "mix" }],
  rows: values.map((value, i) => ({
    id: `r${i}`,
    label: `Category ${i + 1}`,
    value,
    ...(i === 1 ? { color: { var: "accent6" } } : {}),
  })),
})

describe.each([
  ["pie", pieComponent],
  ["donut", donutComponent],
] as const)("%s component", (_, spec) => {
  it.each(Array.from({ length: 12 }, (_, i) => i + 1))(
    "draws %i ungrouped wedges with a bounded palette and percentages that sum to 100",
    (count) => {
      const { children } = expand(spec, mix(Array.from({ length: count }, () => 10)), { groupSmall: false })
      const slices = children.filter(({ key }) => key[0] === "slice")
      expect(slices).toHaveLength(count)
      expect(slices.every(({ props }) => props.geometry.kind === "path" && props.geometry.fillStroke)).toBe(true)
      const colors = slices.flatMap(({ props }) => {
        const fill = props.fills?.[0]
        return fill?.kind === "solid" ? [resolveColor(fill.color, defaultTheme)] : []
      })
      expect(new Set(colors).size).toBe(Math.min(count, 4))
      if (count > 1) expect(slices[1]?.props.fills?.[0]).toMatchObject({ color: { var: "accent6" } })
      const labels = children.filter(({ key }) => key[0] === "legend")
      expect(labels).toHaveLength(count)
      expect(
        labels.reduce((total, { props }) => total + Number(props.text?.chars.split("·")[1]?.replace("%", "")), 0),
      ).toBeCloseTo(100, 10)
    },
  )

  it("fits every grouped legend entry on a half slide", () => {
    const { children, findings } = expand(
      spec,
      mix([30, 28, 26, 24, 22, 20, 18, 16, 14, 12, 10, 8]),
      {},
      {
        x: 0,
        y: 0,
        w: 700,
        h: 480,
      },
    )
    const labels = children.filter(({ key }) => key[0] === "legend")
    const swatches = children.filter(({ key }) => key[0] === "swatch")
    expect(labels).toHaveLength(6)
    expect(swatches).toHaveLength(labels.length)
    expect(findings.some(({ kind }) => kind === "flow-omitted")).toBe(false)
    expect(labels.some(({ props }) => props.text?.chars.includes("Other"))).toBe(true)
  })

  it("omits a swatch when its legend label cannot fit", () => {
    const data = mix([6, 4, 2])
    data.rows[0]!.label = "W".repeat(120)
    const { children, findings } = expand(spec, data, {}, { x: 0, y: 0, w: 700, h: 480 })
    expect(children.filter(({ key }) => key[0] === "legend").map(({ key }) => key[1])).toEqual(["r1", "r2"])
    expect(children.filter(({ key }) => key[0] === "swatch").map(({ key }) => key[1])).toEqual(["r1", "r2"])
    expect(findings).toContainEqual(expect.objectContaining({ kind: "flow-omitted", omitted: [0] }))
  })

  it("uses the configured precision for both wedges and legend", () => {
    const tree = expandComponent(spec, {
      data: mix([1, 1, 1]),
      frame: { x: 0, y: 0, w: 1250, h: 650 },
      tokens: { digits: 1 },
      theme: defaultTheme,
      measure: measureWith({}),
    })
    if (isRefusal(tree)) throw new Error(JSON.stringify(tree))
    const labels = tree.children.filter(({ key }) => key[0] === "percentage").map(({ props }) => props.text?.chars)
    expect(labels).toContain("Category 1  ·  33.4%")
    expect(
      tree.children
        .filter(({ key }) => key[0] === "legend")
        .map(({ props }) => props.text?.chars.split("·")[1]?.trim()),
    ).toEqual(["33.4%", "33.3%", "33.3%"])
  })

  it("sorts clockwise by value and leaves Other last", () => {
    const data = mix([8, 3, 12, 2])
    data.rows[2]!.label = "Other"
    const { children } = expand(spec, data)
    expect(children.filter(({ key }) => key[0] === "slice").map(({ key }) => key[1])).toEqual(["r0", "r1", "r3", "r2"])
  })

  it("paints one accent and a grey ramp by default and flags seven separate slices", () => {
    const data = mix([8, 7, 6, 5, 4, 3, 2])
    const rows = data.rows.map(({ id, label, value }) => ({ id, label, value }))
    const { children, findings } = expand(spec, { ...data, rows }, { groupSmall: false })
    const slices = children.filter(({ key }) => key[0] === "slice")
    expect(slices).toHaveLength(7)
    expect(slices[0]?.props.fills?.[0]).toMatchObject({ color: { var: "accent1" } })
    for (const { props } of slices.slice(1))
      expect(props.fills?.[0]).toMatchObject({ color: { var: "text2", tint: expect.any(Number) } })
    expect(findings).toContainEqual(expect.objectContaining({ kind: "many-series", count: 7, capacity: 3 }))
    expect(findings).toContainEqual(expect.objectContaining({ key: ["many-slices"] }))
  })

  it("groups smaller values before expanding a 100-row chart", () => {
    const data = mix(Array.from({ length: 100 }, (_, i) => i + 1))
    const { children, findings } = expand(spec, data)
    const keys = children.filter(({ key }) => key[0] === "slice").map(({ key }) => key)
    expect(keys).toEqual([
      ["slice", "r99"],
      ["slice", "r98"],
      ["slice", "r97"],
      ["slice", "r96"],
      ["slice", "r95"],
      ["slice", "other", "aggregate"],
    ])
    expect(children.find(({ key }) => key[0] === "legend" && key[1] === "other")?.props.text?.chars).toContain("Other")
    expect(findings).toContainEqual(expect.objectContaining({ key: ["grouped"] }))
    const other = children.find(({ key }) => key[0] === "slice" && key[1] === "other")
    expect(other?.props.fills?.[0]).toMatchObject({ color: { var: "text2", tint: expect.any(Number) } })
    const ungrouped = expand(spec, data, { groupSmall: false })
    const colors = ungrouped.children.flatMap(({ key, props }) => {
      const fill = props.fills?.[0]
      return key[0] === "slice" && fill?.kind === "solid" ? [resolveColor(fill.color, defaultTheme)] : []
    })
    expect(colors).toHaveLength(100)
    expect(new Set(colors).size).toBe(4)
  })

  it("focuses a plotted slice and leaves grouped Other muted", () => {
    const data = mix([8, 7, 6, 5, 4, 3, 2, 1])
    const rows = data.rows.map(({ id, label, value }) => ({ id, label, value }))
    const inputs = {
      data: { ...data, rows },
      frame: { x: 0, y: 0, w: 1100, h: 620 },
      theme: defaultTheme,
      measure: measureWith({}),
    }
    const focused = expandComponent(spec, { ...inputs, focus: ["r2", "r7"] })
    if (isRefusal(focused)) throw new Error(JSON.stringify(focused))
    const fillOf = (id: string) =>
      focused.children.find(({ key }) => key[0] === "slice" && key[1] === id)?.props.fills?.[0]
    expect(fillOf("r2")).toMatchObject({ color: { var: "accent1" } })
    expect(fillOf("other")).toMatchObject({ color: { var: "text2", tint: expect.any(Number) } })
    expect(focused.findings).toContainEqual(
      expect.objectContaining({ kind: "focus-missing", unknown: ["r7"], available: ["r0", "r1", "r2", "r3", "r4"] }),
    )
  })

  it("reports repeated explicit colours", () => {
    const data = mix([1, 1, 1])
    const rows = data.rows.map((row) => ({ ...row, color: { var: "accent6" } }))
    const { findings } = expand(spec, { ...data, rows })
    expect(findings).toContainEqual(expect.objectContaining({ key: ["repeated-colors"] }))
  })

  it("leads out tiny slices and reports labels it cannot place", () => {
    const { children, findings } = expand(spec, mix([90, ...Array.from({ length: 11 }, () => 0.4)]), {
      groupSmall: false,
    })
    expect(children.some(({ key }) => key[0] === "leader")).toBe(true)
    expect(findings.some(({ key }) => key[0] === "percentage")).toBe(true)
    expect(children.some(({ key, props }) => key[0] === "percentage" && props.text?.chars?.endsWith("%"))).toBe(true)
  })

  it("reports shares below path precision and still lists them", () => {
    const { children, findings } = expand(spec, mix([1e15, 1, 1e15]))
    expect(children.filter(({ key }) => key[0] === "slice")).toHaveLength(2)
    expect(findings).toContainEqual(expect.objectContaining({ key: ["slice", "r1"] }))
    expect(children.find(({ key }) => key[0] === "legend" && key[1] === "r1")?.props.text?.chars).toContain("0%")
  })

  it("reports negatives and extra series, and gives zero a legend row without a wedge", () => {
    const invalid = expand(spec, { ...mix([2, 1, 0, -4]), series: [{ id: "mix" }, { id: "unused" }] })
    expect(invalid.children).toHaveLength(0)
    expect(invalid.findings.map(({ key }) => key[0])).toEqual(["series", "negative"])
    const valid = expand(spec, mix([2, 1, 0]))
    expect(valid.children.filter(({ key }) => key[0] === "slice")).toHaveLength(2)
    expect(valid.children.find(({ key }) => key[0] === "legend" && key[1] === "r2")?.props.text?.chars).toContain("0%")
  })
})
