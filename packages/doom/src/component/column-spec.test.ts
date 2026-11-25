import { describe, expect, it } from "vitest"
import { defaultTheme, fontFace, isRefusal, measureWith } from "../index.js"
import { columnComponent, expandComponent, type ComponentInput, type ComponentNode, type PartKey } from "./index.js"
import column from "./testing/column.json" with { type: "json" }

const inputs = { ...column, theme: defaultTheme, measure: measureWith({}) }
const expand = (input: ComponentInput) => {
  const result = expandComponent(columnComponent, input)
  if (isRefusal(result)) throw new Error(JSON.stringify(result))
  return result
}
const nodes = (input: ComponentInput) => expand(input).children
const part = (nodes: readonly ComponentNode[], ...key: PartKey) =>
  nodes.find((node) => node.key.length === key.length && key.every((segment, index) => node.key[index] === segment))

describe("column chart precision and legends", () => {
  it.each([
    [1250, "1,250", "0"],
    [41, "41", "0"],
    [7.25, "7.3", "0.0"],
  ])("uses one precision for %s and a tiny value in the same chart", (value, expected, rounded) => {
    const tree = expand({
      ...inputs,
      data: {
        rows: [
          { id: "max", label: "Largest", value },
          { id: "tiny", label: "Tiny", value: -0.001 },
        ],
      },
    })
    expect(part(tree.children, "value", "max")?.props.text?.chars).toBe(expected)
    expect(part(tree.children, "value", "tiny")?.props.text?.chars).toBe(rounded)
    expect(tree.findings).toEqual([
      expect.objectContaining({ kind: "rounded-to-zero", key: ["value", "tiny"], value: -0.001 }),
    ])
  })

  it.each([[3, 1, 2], [12, 8, 5], Array.from({ length: 10 }, (_, i) => i + 1)])(
    "keeps whole-number data whole (first value %s)",
    (...values) => {
      const rows = values.map((value, index) => ({ id: `r${index}`, label: `Q${index}`, value }))
      const tree = expand({ ...inputs, data: { rows } })
      expect(tree.children.filter(({ key }) => key[0] === "value").map(({ props }) => props.text?.chars)).toEqual(
        values.map(String),
      )
    },
  )

  it.each([
    [12, 8],
    [-12, -8],
    [12, -8],
  ])("keeps plain data in the series color (%s, %s)", (...values) => {
    const rows = values.map((value, index) => ({ id: `r${index}`, label: `Q${index}`, value }))
    const tree = expand({ ...inputs, data: { rows }, variant: { legend: true }, tokens: { seriesLabel: "Profit" } })
    expect(tree.children.filter(({ key }) => key[0] === "bar").map(({ props }) => props.fills)).toEqual(
      rows.map(() => [{ kind: "solid", color: { var: "accent1" } }]),
    )
    expect(part(tree.children, "legend-swatch", "series")?.props.fills).toEqual([
      { kind: "solid", color: { var: "accent1" } },
    ])
    expect(part(tree.children, "legend-label", "series")?.props.text?.chars).toBe("Profit")
  })

  it.each([
    [
      [9.96, 1.2],
      ["10", "1"],
    ],
    [
      [2.03, 1.98],
      ["2", "2"],
    ],
    [
      [-9.96, -1.2],
      ["−10", "−1"],
    ],
  ])("uses the rounded display values to choose precision for %j", (values, expected) => {
    const rows = values.map((value, index) => ({ id: `r${index}`, label: `Q${index}`, value }))
    const tree = expand({ ...inputs, data: { rows } })
    expect(tree.children.filter(({ key }) => key[0] === "value").map(({ props }) => props.text?.chars)).toEqual(
      expected,
    )
  })

  it("chooses precision in display units and honors explicit digits", () => {
    const input = { ...inputs, data: { rows: [{ id: "r", label: "Row", value: 4100 }] }, tokens: { scale: 100 } }
    expect(part(nodes(input), "value", "r")?.props.text?.chars).toBe("41")
    const themed = { ...input, themeTokens: { "number.digits": 2 } }
    expect(part(nodes(themed), "value", "r")?.props.text?.chars).toBe("41.00")
    expect(part(nodes({ ...themed, tokens: { ...input.tokens, digits: 0 } }), "value", "r")?.props.text?.chars).toBe(
      "41",
    )
  })

  it("flows the sign key as complete swatch and label pairs", () => {
    const input = {
      ...inputs,
      variant: { legend: true, signed: true },
      data: {
        rows: [
          { id: "a", label: "A", value: 41 },
          { id: "b", label: "B", value: -6 },
        ],
      },
      tokens: { positiveLabel: "Growth", negativeLabel: "Decline" },
    }
    const tree = expand(input)
    for (const [id, sign] of [
      ["a", "positive"],
      ["b", "negative"],
    ] as const) {
      expect(part(tree.children, "bar", id)?.props.fills).toEqual([{ kind: "solid", color: { var: sign } }])
      expect(part(tree.children, "legend-swatch", sign)?.props.fills).toEqual(
        part(tree.children, "bar", id)?.props.fills,
      )
      expect(part(tree.children, "legend-label", sign)).toBeDefined()
    }
    const narrow = expand({ ...input, frame: { ...inputs.frame, w: 165 } })
    expect(part(narrow.children, "legend-label", "positive")?.props.box.y).toBeLessThan(
      part(narrow.children, "legend-label", "negative")!.props.box.y,
    )
    const crowded = expand({ ...input, tokens: { ...input.tokens, positiveLabel: "W".repeat(200) } })
    expect(part(crowded.children, "legend-label", "positive")).toBeUndefined()
    expect(part(crowded.children, "legend-swatch", "positive")).toBeUndefined()
    expect(part(crowded.children, "legend-swatch", "negative")).toBeDefined()
    expect(crowded.findings).toContainEqual(expect.objectContaining({ kind: "flow-omitted", omitted: [0] }))
  })

  it("keeps the plot when the frame is too short for a legend row", () => {
    const input = {
      ...inputs,
      frame: { ...inputs.frame, w: 280, h: 240 },
      data: {
        rows: [
          { id: "a", label: "A", value: 41 },
          { id: "b", label: "B", value: -6 },
        ],
      },
    }
    const withLegend = expand({ ...input, variant: { legend: true, signed: true } })
    expect(withLegend.children).toEqual(nodes({ ...input, variant: { signed: true } }))
    expect(withLegend.findings).toContainEqual(expect.objectContaining({ kind: "flow-omitted", omitted: [0, 1] }))
  })
})

it.each([
  ["short", (i: number) => ["I", "J", "L", "T"][i % 4]!, (i: number) => 1 + Math.floor(i / 5)],
  ["region", (i: number) => `Region ${i + 1}`, (i: number) => i + 1],
  ["three digit", () => "I", (i: number) => 100 + i * 13],
  ["years", (i: number) => String(1980 + i), (i: number) => i + 1],
] as const)("switches crowded %s value labels to the axis", (kind, label, value) => {
  const rows = Array.from({ length: 40 }, (_, i) => ({ id: `r${i}`, label: label(i), value: value(i) }))
  const tree = expand({ ...inputs, frame: { ...inputs.frame, w: 713, h: 301 }, data: { rows } })
  expect(tree.children.filter(({ key }) => key[0] === "value")).toHaveLength(0)
  expect(tree.children.filter(({ key }) => key[0] === "tick").length).toBeGreaterThan(0)
  expect(tree.findings).toContainEqual(expect.objectContaining({ kind: "advice", code: "value-label-space" }))
  expect(tree.findings.some((finding) => finding.kind === "advice" && finding.code === "many-columns")).toBe(
    kind === "years",
  )
})

it.each([
  { width: 176, labels: false },
  { width: 180, labels: true },
])("requires 8 px clearance for every label at $width px", ({ width, labels }) => {
  const measure: ComponentInput["measure"] = (text, theme, width, fit) => {
    const result = inputs.measure(text, theme, width, fit)
    return text.style === "label" ? { ...result, w: text.chars.length === 1 ? 15 : 31 } : result
  }
  const tree = expand({
    ...inputs,
    measure,
    frame: { ...inputs.frame, w: width },
    data: {
      rows: [
        { id: "a", label: "A", value: 1 },
        { id: "b", label: "B", value: 10 },
        { id: "c", label: "C", value: 1 },
        { id: "d", label: "D", value: 10 },
      ],
    },
  })
  expect(tree.children.filter(({ key }) => key[0] === "value")).toHaveLength(labels ? 4 : 0)
  expect(tree.children.some(({ key }) => key[0] === "tick")).toBe(!labels)
  if (!labels) {
    const explicitAxis = expand({
      ...inputs,
      measure,
      frame: { ...inputs.frame, w: width },
      data: {
        rows: [
          { id: "a", label: "A", value: 1 },
          { id: "b", label: "B", value: 10 },
          { id: "c", label: "C", value: 1 },
          { id: "d", label: "D", value: 10 },
        ],
      },
      variant: { labels: false },
    })
    expect(explicitAxis.children).toEqual(tree.children)
    expect(explicitAxis.findings).not.toContainEqual(expect.objectContaining({ code: "value-label-space" }))
  }
})

it("keeps the widest axis tick when its measured width falls between pixels", () => {
  const measure: ComponentInput["measure"] = (text, theme, width, fit) => ({
    ...inputs.measure(text, theme, width, fit),
    w: text.chars.length === 1 ? 12.2 : 24.2,
  })
  const tree = expand({
    ...inputs,
    measure,
    data: { rows: [{ id: "row", label: "A", value: 8 }] },
    variant: { labels: false },
  })
  expect(tree.children.filter(({ key }) => key[0] === "tick").map(({ props }) => props.text?.chars)).toEqual([
    "0",
    "5",
    "10",
  ])
  expect(tree.findings).toEqual([])
})

it("accents focused category IDs and keeps every other column in one neutral", () => {
  const tree = expand({
    ...inputs,
    focus: ["message"],
    data: {
      rows: [
        { id: "first", label: "Message", value: 4 },
        { id: "message", label: "Message", value: -2 },
        { id: "last", label: "Last", value: 3 },
      ],
    },
    tokens: { seriesLabel: "Profit" },
    variant: { legend: true, signed: true },
  })
  expect(part(tree.children, "bar", "message")?.props.fills).toEqual([{ kind: "solid", color: { var: "accent1" } }])
  expect(tree.children.filter(({ key }) => key[0] === "legend-swatch").map(({ props }) => props.fills)).toEqual([
    [{ kind: "solid", color: { var: "accent1" } }],
  ])
  const muted = part(tree.children, "bar", "first")?.props.fills
  expect(muted).toEqual([{ kind: "solid", color: { var: "text2", tint: expect.any(Number) } }])
  expect(part(tree.children, "bar", "last")?.props.fills).toEqual(muted)
})

it("asks for a series label when the legend is enabled", () => {
  const tree = expand({ ...inputs, variant: { legend: true } })
  expect(part(tree.children, "legend-label", "series")).toBeUndefined()
  expect(tree.findings).toContainEqual(expect.objectContaining({ kind: "advice", code: "legend-label-missing" }))
  expect(tree.findings).not.toContainEqual(expect.objectContaining({ kind: "flow-omitted" }))
})

it("reports unknown focus and paints the ordinary accent", () => {
  const tree = expand({ ...inputs, focus: ["missing"], data: { rows: [{ id: "a", label: "A", value: 3 }] } })
  expect(part(tree.children, "bar", "a")?.props.fills).toEqual([{ kind: "solid", color: { var: "accent1" } }])
  expect(tree.findings).toContainEqual(
    expect.objectContaining({ kind: "focus-missing", unknown: ["missing"], available: ["a"] }),
  )
})

it("fits 100 focused categories when the last label triggers a shared size change", () => {
  const rows = Array.from({ length: 100 }, (_, i) => ({
    id: `r${i}`,
    label: (i === 99 ? "WWWWWWWWW WWWWWWWW" : "i".repeat(18)) + String(i).padStart(2, "0"),
    value: i - 12345,
  }))
  const face = "DejaVu Sans"
  const metrics = (advances: Readonly<Record<string, number>>) => ({ ascent: 0.93, descent: 0.24, advances })
  const measure = measureWith({
    [fontFace(face, false, false)]: metrics({ W: 2025 / 2048, i: 569 / 2048, " ": 651 / 2048 }),
    [fontFace(face, true, false)]: metrics({ "−": 1716 / 2048, ".": 778 / 2048 }),
  })
  const tree = expand({
    ...inputs,
    theme: { ...defaultTheme, fonts: { heading: face, body: face } },
    tokens: { captionSmall: 18 },
    measure,
    frame: { ...column.frame, w: 18_000 },
    data: { rows },
    focus: rows.map(({ id }) => id),
  })
  const categories = tree.children.filter(({ key }) => key[0] === "category")
  expect(categories).toHaveLength(100)
  expect(new Set(categories.map(({ props }) => props.text?.spans[0]?.size))).toEqual(new Set([18]))
})

it("keeps sign colours when the only focused row has no mark", () => {
  const tree = expand({
    ...inputs,
    focus: ["gap"],
    variant: { signed: true },
    data: {
      rows: [
        { id: "gap", label: "Gap", value: null },
        { id: "loss", label: "Loss", value: -3 },
      ],
    },
  })
  expect(part(tree.children, "bar", "loss")?.props.fills).toEqual([{ kind: "solid", color: { var: "negative" } }])
  expect(tree.findings).toContainEqual(
    expect.objectContaining({ kind: "focus-missing", unknown: ["gap"], available: ["loss"] }),
  )
})
