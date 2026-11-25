import { describe, expect, it } from "vitest"
import { defaultTheme, isRefusal, measureWith, resolveColor, themeLibrary } from "../index.js"
import { type ComponentTree, expandComponent, readComponentSpec } from "./index.js"
import stacked from "./library/stacked.json" with { type: "json" }
import waterfall from "./library/waterfall.json" with { type: "json" }

const frame = { x: 0, y: 0, w: 1540, h: 650 }
const measure = measureWith({})
const category = (id: string, label = id) => ({ id, label })
const series = (id: string, color: unknown = null) => ({ id, label: id, color })
const segment = (id: string, category: string, series: string, value: number, color: unknown = null) => ({
  id,
  category,
  series,
  value,
  color,
})
const step = (id: string, value: number, mode = "delta", after = "carry") => ({ id, label: id, mode, after, value })

function expand(raw: unknown, data: unknown, variant = {}, tokens = {}, theme = defaultTheme) {
  const spec = readComponentSpec(raw)
  if (isRefusal(spec)) throw new Error(JSON.stringify(spec))
  const result = expandComponent(spec, { theme, measure, frame, data, variant, tokens })
  if (isRefusal(result)) throw new Error(JSON.stringify(result))
  return result
}

const part = (tree: ComponentTree, ...key: string[]) =>
  tree.children.find(({ key: actual }) => actual.length === key.length && actual.every((value, i) => value === key[i]))
const box = (tree: ComponentTree, ...key: string[]) => part(tree, ...key)?.props.box
const chars = (tree: ComponentTree, ...key: string[]) => part(tree, ...key)?.props.text?.chars
const fill = (tree: ComponentTree, ...key: string[]) => part(tree, ...key)?.props.fills?.[0]
const edge = (tree: ComponentTree, ...key: string[]) => {
  const found = box(tree, ...key)
  if (found === undefined) throw new Error(`Expected ${key.join("/")}`)
  return found.y + found.h
}
const count = (tree: ComponentTree, role: string) => tree.children.filter(({ key }) => key[0] === role).length
const thinnedCategories = (tree: ComponentTree) => {
  const finding = tree.findings.find(({ key }) => key[0] === "categories")
  return finding?.kind === "text-fit" ? finding.thinned : undefined
}

describe("stacked column library", () => {
  it("stacks shuffled rows in the same series order in every column", () => {
    const data = {
      categories: [category("a"), category("b")],
      series: [series("Core"), series("Support")],
      segments: [
        segment("support-a", "a", "Support", 5),
        segment("core-b", "b", "Core", 10),
        segment("core-a", "a", "Core", 10),
        segment("support-b", "b", "Support", 5),
      ],
    }
    const tree = expand(stacked, data)
    for (const id of ["a", "b"]) {
      expect(edge(tree, "segment", id, `core-${id}`)).toBe(box(tree, "zero")?.y)
      expect(edge(tree, "segment", id, `support-${id}`)).toBe(box(tree, "segment", id, `core-${id}`)?.y)
    }
    expect(chars(tree, "total", "a")).toBe("15")
    expect(chars(tree, "series-label", "Core")).toBe("Core")
    expect(box(tree, "series-label", "Core")?.x).toBeGreaterThan(box(tree, "segment", "b", "core-b")?.x ?? Infinity)
    expect(count(tree, "legend-swatch")).toBe(0)
    const repeated = expand(stacked, { ...data, segments: [...data.segments, segment("tiny", "b", "Core", 0.01)] })
    expect(count(repeated, "series-label")).toBe(0)
    expect(count(repeated, "legend-swatch")).toBe(2)
  })

  it("flows measured legend labels together with their swatches", () => {
    const names = ["Professional services", "Subscriptions", "Hardware", "Training", "Other"]
    const data = {
      categories: [category("a")],
      series: names.map((label, i) => ({ ...series(`s${i}`), label })),
      segments: [segment("sales", "a", "s0", 1.4)],
    }
    const tree = expand(stacked, data, { legend: true }, { title: "Revenue by line", unitHeader: "$M" })
    expect(names.map((_, i) => chars(tree, "legend-label", `s${i}`))).toEqual(names)
    expect(names.map((_, i) => fill(tree, "legend-swatch", `s${i}`)).every(Boolean)).toBe(true)
    expect(chars(tree, "value", "a", "sales")).toBe("1.4")
    expect(edge(tree, "legend-label", "s0")).toBeLessThan(box(tree, "total", "a")?.y ?? 0)
    const longData = { ...data, series: data.series.map((row) => ({ ...row, label: row.label.repeat(8) })) }
    const crowded = expand(stacked, longData)
    const legendKeys = (role: string) => crowded.children.filter(({ key }) => key[0] === role).map(({ key }) => key[1])
    expect(legendKeys("legend-swatch")).toEqual(legendKeys("legend-label"))
    expect(legendKeys("legend-label").length).toBeLessThan(names.length)
    expect(crowded.findings.some(({ kind }) => kind === "flow-omitted")).toBe(true)
  })

  it("keeps separate signed offsets and honors the legacy series and point colors", () => {
    const tree = expand(
      stacked,
      {
        categories: [category("march", "March"), category("april", "April"), category("may", "May")],
        series: [series("Core"), series("Support"), series("Other", { var: "accent4" })],
        segments: [
          segment("core-mar", "march", "Core", 28),
          segment("support-mar", "march", "Support", -9),
          segment("other-mar", "march", "Other", 7),
          segment("core-apr", "april", "Core", -13),
          segment("support-apr", "april", "Support", -5.75),
          segment("other-apr", "april", "Other", 17),
          segment("core-may", "may", "Core", 41),
          segment("support-may", "may", "Support", 15),
          segment("other-may", "may", "Other", -25, defaultTheme.colors.link),
        ],
      },
      { legend: true },
      { unitHeader: "hours", digits: 2 },
    )
    const zero = box(tree, "zero")?.y
    expect(edge(tree, "segment", "march", "core-mar")).toBe(zero)
    expect(box(tree, "segment", "march", "support-mar")?.y).toBe(zero)
    expect(edge(tree, "segment", "march", "other-mar")).toBe(box(tree, "segment", "march", "core-mar")?.y)
    expect(box(tree, "segment", "april", "support-apr")?.y).toBe(edge(tree, "segment", "april", "core-apr"))
    expect(chars(tree, "value", "april", "support-apr")).toBe("−5.75")
    expect(chars(tree, "total", "april")).toBe("Net −1.75")
    expect(edge(tree, "total", "april")).toBeLessThan(box(tree, "segment", "april", "other-apr")?.y ?? 0)
    expect(chars(tree, "unit")).toBe("hours")
    expect(count(tree, "legend-label")).toBe(3)
    expect(fill(tree, "legend-swatch", "Other")).toEqual({ kind: "solid", color: { var: "accent4" } })
    expect(fill(tree, "segment", "may", "other-may")).toEqual({ kind: "solid", color: defaultTheme.colors.link })
  })

  it("handles all-negative stacks, exact zero, and a label too short to fit", () => {
    const tree = expand(
      stacked,
      {
        categories: [category("a")],
        series: [series("core")],
        segments: [
          segment("main", "a", "core", -15),
          segment("zero", "a", "core", 0),
          segment("tiny", "a", "core", -0.0001),
        ],
      },
      { totals: true },
    )
    expect(box(tree, "segment", "a", "main")?.y).toBe(box(tree, "zero")?.y)
    expect(box(tree, "segment", "a", "zero")).toBeUndefined()
    expect(chars(tree, "value", "a", "zero")).toBeUndefined()
    expect(chars(tree, "value", "a", "tiny")).toBeUndefined()
    expect(tree.findings.map(({ key }) => key)).toContainEqual(["value", "a", "tiny"])
    expect(chars(tree, "total", "a")).toBe("−15")
    expect(edge(tree, "total", "a")).toBeLessThan(box(tree, "zero")?.y ?? 0)
    expect(count(tree, "legend-label")).toBe(0)
  })

  it("uses one accent, reports dense stacks and preserves identities across visual options", () => {
    const data = {
      categories: [category("a")],
      series: Array.from({ length: 7 }, (_, i) => series(`s${i}`)),
      segments: Array.from({ length: 7 }, (_, i) => segment(`v${i}`, "a", `s${i}`, i + 5)),
    }
    const tree = expand(stacked, data)
    const plain = expand(stacked, data, { labels: false, totals: false })
    expect(fill(tree, "segment", "a", "v0")).toEqual({ kind: "solid", color: { var: "accent1" } })
    expect(fill(tree, "segment", "a", "v6")).toMatchObject({ kind: "solid", color: { var: "text2" } })
    expect(tree.findings).toContainEqual(expect.objectContaining({ kind: "advice", code: "many-segments" }))
    expect(count(plain, "value")).toBe(0)
    expect(count(plain, "total")).toBe(0)
    expect(plain.children.filter(({ key }) => key[0] === "segment").map(({ key }) => key)).toEqual(
      tree.children.filter(({ key }) => key[0] === "segment").map(({ key }) => key),
    )
  })

  it("expands 100 categories and evenly thins crowded category captions", () => {
    const categories = Array.from({ length: 100 }, (_, i) => category(`c${i}`, `Category ${i}`))
    const data = { categories, series: [series("a")], segments: categories.map(({ id }) => segment(id, id, "a", 10)) }
    const tree = expand(stacked, data, { totals: true })
    expect(count(tree, "segment")).toBe(100)
    expect(count(tree, "category")).toBeGreaterThan(1)
    expect(thinnedCategories(tree)).toBe(100 - count(tree, "category"))
    expect(tree.findings.filter(({ key }) => ["value", "total"].includes(key[0] ?? ""))).toHaveLength(0)
    expect(
      tree.findings.filter((finding) => finding.kind === "advice" && finding.code === "labels-omitted"),
    ).toHaveLength(1)
  })
})

function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const channel = (start: number) => {
      const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
  }
  const first = luminance(a)
  const second = luminance(b)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

describe("waterfall library", () => {
  it.each([
    ["fallback", defaultTheme] as const,
    ...Object.values(themeLibrary).map(({ id, theme }) => [id, theme] as const),
  ])("uses distinct totals, steps and focus in %s", (_id, theme) => {
    const tree = expand(
      waterfall,
      { rows: [step("Open", 100, "total"), step("Price", 5), step("Volume", -3), step("Close", 102, "total")] },
      {},
      { focus: "Price" },
      theme,
    )
    const paintFor = (id: string) => {
      const paint = fill(tree, "bar", id)
      if (paint?.kind !== "solid") throw new Error(`Expected a solid bar for ${id}`)
      return resolveColor(paint.color, theme)
    }
    const total = paintFor("Open")
    const focus = paintFor("Price")
    const stepGrey = paintFor("Volume")
    expect.soft(contrast(focus, total)).toBeGreaterThanOrEqual(1.5)
    expect.soft(contrast(focus, stepGrey)).toBeGreaterThanOrEqual(1.5)
    expect.soft(contrast(total, theme.colors.background)).toBeCloseTo(11.7, 0)
    const score = (accent: string) => Math.min(contrast(accent, total), contrast(accent, stepGrey))
    const { accent1, accent2, accent3, accent4, accent5, accent6 } = theme.colors
    expect(score(focus)).toBe(Math.max(...[accent1, accent2, accent3, accent4, accent5, accent6].map(score)))
  })

  it("keeps an explicitly requested focus color", () => {
    const highlight = { var: "accent1" }
    const tree = expand(
      waterfall,
      { rows: [step("Open", 100, "total"), step("Price", 5), step("Close", 105, "total")] },
      {},
      { focus: "Price", highlight },
    )
    expect(fill(tree, "bar", "Price")).toEqual({ kind: "solid", color: highlight })
  })

  it("keeps a final delta and asks for a closing total", () => {
    const tree = expand(waterfall, { rows: [step("Open", 100, "total"), step("Price", 5), step("Volume", -3)] })
    expect(chars(tree, "value", "Volume")).toBe("−3")
    expect(tree.findings).toContainEqual(
      expect.objectContaining({ kind: "advice", code: "missing-closing-total", note: "Add a closing total row." }),
    )
    expect(part(tree, "bridge", "Volume")?.props.strokes?.[0]).toEqual({ kind: "solid", color: { var: "text2" } })
  })

  it("keeps both ends on the baseline and highlights a focused step among neutral steps", () => {
    const tree = expand(
      waterfall,
      {
        rows: [step("Open", 20, "total"), step("Gain", 5), step("Loss", -3), step("End", 999, "total")],
      },
      {},
      { focus: "Gain" },
    )
    for (const id of ["Open", "End"]) expect(edge(tree, "bar", id)).toBe(box(tree, "zero")?.y)
    expect(chars(tree, "value", "End")).toBe("22")
    expect(fill(tree, "bar", "Open")).toEqual(fill(tree, "bar", "End"))
    expect(fill(tree, "bar", "Gain")).not.toEqual(fill(tree, "bar", "Loss"))
    expect(tree.findings).toContainEqual(
      expect.objectContaining({ kind: "advice", code: "total-mismatch", note: "End: Use the running balance for this total." }),
    )
  })

  it("keeps the opening, subtotal and closing captions while evenly thinning steps", () => {
    const rows = Array.from({ length: 30 }, (_, i) => {
      if (i === 0) return step("Opening balance", 50, "total")
      if (i === 15) return step("Subtotal", 0, "total")
      if (i === 29) return step("Closing balance", 0, "total")
      return step(`Driver ${i}`, i % 2 === 0 ? 1 : -1)
    }).map((row, i) => ({ ...row, id: `r${i}` }))
    const tree = expand(waterfall, { rows })
    expect(chars(tree, "category", "r0")).toBe("Opening balance")
    expect(chars(tree, "category", "r15")).toBe("Subtotal")
    expect(chars(tree, "category", "r29")).toBe("Closing balance")

    const steps = rows.filter(({ mode }) => mode === "delta")
    const kept = steps.flatMap(({ id }, i) => (chars(tree, "category", id) === undefined ? [] : [i]))
    expect(kept.length).toBeGreaterThanOrEqual(8)
    expect(kept.length).toBeLessThan(steps.length)
    expect(new Set(kept.slice(1).map((index, i) => index - kept[i]!)).size).toBe(1)
    expect(thinnedCategories(tree)).toBe(steps.length - kept.length)
  })

  it("starts a marked opening balance at zero and carries it to the next step", () => {
    const tree = expand(waterfall, {
      rows: [step("Open", 2, "total"), step("Gain", 1.4), step("End", 3.3999, "total")],
    })
    expect(edge(tree, "bar", "Open")).toBe(box(tree, "zero")?.y)
    expect(chars(tree, "value", "Open")).toBe("2.0")
    expect(chars(tree, "value", "End")).toBe("3.4")
    expect(tree.findings.some(({ kind }) => kind === "advice")).toBe(false)
    expect(fill(tree, "bar", "Open")).toEqual(fill(tree, "bar", "End"))
  })

  it("bridges the running endpoints through a subtotal and breaks after a reset", () => {
    const tree = expand(
      waterfall,
      {
        rows: [
          step("Open", 20, "total"),
          step("Loss", -5),
          step("Subtotal", 999, "total"),
          step("Gain", 12),
          step("Reset", 0, "total", "reset"),
          step("Costs", -7),
          step("End", 0, "total"),
        ],
      },
      { signed: true },
      { title: "Profit", unitHeader: "$M" },
    )
    const zero = box(tree, "zero")?.y
    expect(edge(tree, "bar", "Open")).toBe(zero)
    expect(box(tree, "bridge", "Loss")?.y).toBe(box(tree, "bar", "Open")?.y)
    expect(box(tree, "bridge", "Subtotal")?.y).toBe(edge(tree, "bar", "Loss"))
    expect(edge(tree, "bar", "Subtotal")).toBe(zero)
    expect(edge(tree, "bar", "Gain")).toBe(box(tree, "bridge", "Gain")?.y)
    expect(box(tree, "bar", "Costs")?.y).toBe(zero)
    expect(box(tree, "bridge", "Costs")).toBeUndefined()
    expect(box(tree, "bridge", "End")?.y).toBe(edge(tree, "bar", "Costs"))
    expect(fill(tree, "bar", "Gain")).toEqual({ kind: "solid", color: { var: "positive" } })
    expect(fill(tree, "bar", "Loss")).toEqual({ kind: "solid", color: { var: "negative" } })
    expect(fill(tree, "bar", "Subtotal")).toEqual({ kind: "solid", color: { var: "total" } })
    expect(["Loss", "Subtotal", "Gain", "End"].map((id) => chars(tree, "value", id))).toEqual(["−5", "15", "+12", "−7"])
    expect(chars(tree, "title")).toBe("Profit")
    expect(chars(tree, "unit")).toBe("$M")
    expect(tree.children.filter(({ props }) => props.text?.chars.includes("$M"))).toHaveLength(1)
  })

  it("keeps zero and near-zero observations visible without changing accumulated levels", () => {
    const tree = expand(
      waterfall,
      {
        rows: [step("Open", -12, "total"), step("Flat", 0), step("Tiny", -0.0001), step("End", 0, "total")],
      },
      {},
      { digits: 0 },
    )
    const level = edge(tree, "bar", "Open")
    expect(box(tree, "bridge", "Flat")?.y).toBe(level)
    expect(box(tree, "bridge", "Tiny")?.y).toBe(level)
    expect(box(tree, "bridge", "End")?.y).toBe(level)
    expect(box(tree, "bar", "Flat")?.h).toBe(2)
    expect(box(tree, "bar", "Tiny")?.h).toBe(2)
    expect(chars(tree, "value", "Flat")).toBe("0")
    expect(chars(tree, "value", "Tiny")).toBe("0")
    expect(box(tree, "bar", "End")?.y).toBe(box(tree, "zero")?.y)
  })

  it("expands and thins 100 steps without losing a connector or mark", () => {
    const tree = expand(waterfall, {
      rows: Array.from({ length: 100 }, (_, i) =>
        step(`Step-${i}`, i % 2 === 0 ? 1 : -1, i === 0 || i === 99 ? "total" : "delta"),
      ),
    })
    expect(count(tree, "bar")).toBe(100)
    expect(count(tree, "bridge")).toBe(99)
    expect(count(tree, "category")).toBeGreaterThan(1)
    expect(count(tree, "category")).toBeLessThan(100)
    const findings = tree.findings.map(({ key }) => key[0])
    expect(findings).toContain("categories")
    expect(findings.filter((role) => role === "value")).toHaveLength(0)
    expect(
      tree.findings.filter((finding) => finding.kind === "advice" && finding.code === "labels-omitted"),
    ).toHaveLength(1)
  })
})
