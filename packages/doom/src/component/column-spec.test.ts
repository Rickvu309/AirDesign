import { describe, expect, it } from "vitest"
import { defaultTheme, isRefusal, measureWith } from "../index.js"
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
    const tree = expand({ ...inputs, data: { rows }, variant: { legend: true } })
    expect(tree.children.filter(({ key }) => key[0] === "bar").map(({ props }) => props.fills)).toEqual(
      rows.map(() => [{ kind: "solid", color: { var: "accent1" } }]),
    )
    expect(part(tree.children, "legend-swatch", "series")?.props.fills).toEqual([
      { kind: "solid", color: { var: "accent1" } },
    ])
    expect(part(tree.children, "legend-label", "series")?.props.text?.chars).toBe("Series")
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
