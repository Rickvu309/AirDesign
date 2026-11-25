import { describe, expect, it } from "vitest"
import { defaultTheme, isRefusal, measureWith } from "../index.js"
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

function expand(raw: unknown, data: unknown, variant = {}, tokens = {}) {
  const spec = readComponentSpec(raw)
  if (isRefusal(spec)) throw new Error(JSON.stringify(spec))
  const result = expandComponent(spec, { theme: defaultTheme, measure, frame, data, variant, tokens })
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

describe("stacked column library", () => {
  it("stacks shuffled rows in the same series order in every column", () => {
    const tree = expand(stacked, {
      categories: [category("a"), category("b")],
      series: [series("Core"), series("Support")],
      segments: [
        segment("support-a", "a", "Support", 5),
        segment("core-b", "b", "Core", 10),
        segment("core-a", "a", "Core", 10),
        segment("support-b", "b", "Support", 5),
      ],
    })
    for (const id of ["a", "b"]) {
      expect(edge(tree, "segment", id, `core-${id}`)).toBe(box(tree, "zero")?.y)
      expect(edge(tree, "segment", id, `support-${id}`)).toBe(box(tree, "segment", id, `core-${id}`)?.y)
    }
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
      { totals: true },
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
    expect(edge(tree, "total", "a")).toBeLessThan(box(tree, "zero")?.y ?? 0)
    expect(count(tree, "legend-label")).toBe(0)
  })

  it("cycles six theme accents and preserves identities across visual options", () => {
    const data = {
      categories: [category("a")],
      series: Array.from({ length: 7 }, (_, i) => series(`s${i}`)),
      segments: Array.from({ length: 7 }, (_, i) => segment(`v${i}`, "a", `s${i}`, i + 5)),
    }
    const tree = expand(stacked, data)
    const plain = expand(stacked, data, { labels: false })
    expect(fill(tree, "segment", "a", "v5")).toEqual({ kind: "solid", color: { var: "accent6" } })
    expect(fill(tree, "segment", "a", "v6")).toEqual(fill(tree, "segment", "a", "v0"))
    expect(count(plain, "value")).toBe(0)
    expect(count(tree, "total")).toBe(0)
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
    expect(tree.findings.find(({ key }) => key[0] === "categories")?.thinned).toBe(100 - count(tree, "category"))
    expect(tree.findings.filter(({ key }) => key[0] === "value")).toHaveLength(100)
    expect(tree.findings.filter(({ key }) => key[0] === "total")).toHaveLength(100)
  })
})

describe("waterfall library", () => {
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
    expect(tree.findings.find(({ key }) => key[0] === "categories")?.thinned).toBe(steps.length - kept.length)
  })

  it("starts a marked opening balance at zero and carries it to the next step", () => {
    const tree = expand(waterfall, { rows: [step("Open", 20, "total"), step("Gain", 12), step("End", 0, "total")] })
    expect(edge(tree, "bar", "Open")).toBe(box(tree, "zero")?.y)
    expect(chars(tree, "value", "Open")).toBe("20")
    expect(chars(tree, "value", "End")).toBe("32")
    expect(fill(tree, "bar", "Open")).toEqual(fill(tree, "bar", "End"))
  })

  it("bridges the running endpoints through a subtotal and breaks after a reset", () => {
    const tree = expand(
      waterfall,
      {
        rows: [
          step("Open", 20),
          step("Loss", -5),
          step("Subtotal", 999, "total"),
          step("Gain", 12),
          step("Reset", 0, "total", "reset"),
          step("Costs", -7),
          step("End", 0, "total"),
        ],
      },
      {},
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
    expect(fill(tree, "bar", "Gain")).not.toEqual(fill(tree, "bar", "Loss"))
    expect(fill(tree, "bar", "Subtotal")).not.toEqual(fill(tree, "bar", "Gain"))
    expect(["Loss", "Subtotal", "Gain", "End"].map((id) => chars(tree, "value", id))).toEqual(["−5", "15", "+12", "−7"])
    expect(chars(tree, "unit")).toBe("Profit, $M")
    expect(tree.children.filter(({ props }) => props.text?.chars.includes("$M"))).toHaveLength(1)
  })

  it("keeps zero and near-zero observations visible without changing accumulated levels", () => {
    const tree = expand(waterfall, {
      rows: [step("Open", -12), step("Flat", 0), step("Tiny", -0.0001), step("End", 0, "total")],
    })
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
      rows: Array.from({ length: 100 }, (_, i) => step(`Step-${i}`, i % 2 === 0 ? 1 : -1)),
    })
    expect(count(tree, "bar")).toBe(100)
    expect(count(tree, "bridge")).toBe(99)
    expect(count(tree, "category")).toBeGreaterThan(1)
    expect(count(tree, "category")).toBeLessThan(100)
    const findings = tree.findings.map(({ key }) => key[0])
    expect(findings).toContain("categories")
    expect(findings.filter((role) => role === "value")).toHaveLength(100)
  })
})
