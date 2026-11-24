import { describe, expect, it } from "vitest"
import {
  applyEdit,
  defaultTheme,
  doomFromTree,
  isRefusal,
  measureWith,
  orderKeyBetween,
  readEdit,
  rev,
  type Props,
} from "../index.js"
import {
  columnComponent,
  expandComponent,
  readComponentSpec,
  type ComponentSpec,
  type ComponentInput,
  type ComponentNode,
  type ComponentTree,
  type PartKey,
} from "./index.js"
import architecture from "./testing/architecture.json" with { type: "json" }
import column from "./testing/column.json" with { type: "json" }
import waterfall from "./testing/waterfall.json" with { type: "json" }

const measure = measureWith({})
const inputs = { ...column, theme: defaultTheme, measure }
const expand = (spec: ComponentSpec, input: ComponentInput) => {
  const result = expandComponent(spec, input)
  if (isRefusal(result)) throw new Error(JSON.stringify(result))
  return result
}
const read = (raw: unknown) => {
  const spec = readComponentSpec(raw)
  if (isRefusal(spec)) throw new Error(JSON.stringify(spec))
  return spec
}
const nodes = (input: ComponentInput = inputs) => expand(columnComponent, input).children
const part = (nodes: readonly ComponentNode[], ...key: PartKey) =>
  nodes.find((node) => node.key.length === key.length && key.every((segment, index) => node.key[index] === segment))
const bottom = (box: Props["box"] | undefined) => (box?.y ?? NaN) + (box?.h ?? NaN)
const zero = (node: { props: { geometry: Props["geometry"] } } | undefined) => {
  const geometry = node?.props.geometry
  if (geometry?.kind !== "line" || !("y" in geometry.start)) throw new Error("Expected a free line end")
  return geometry.start.y
}

const rectangle = { kind: "rect", key: ["list", "rectangle"], x: 0, y: 0, w: 1, h: 1, fill: defaultTheme.colors.text }
const specOf = (parts: readonly unknown[]) => ({ version: 1, name: "Fixture", collections: {}, parts })
const repeat = (as: string) => ({ over: ["list", ...Array.from({ length: 50 }, (_, i) => String(i))], as })

function land(tree: ComponentTree) {
  const { doom, slides } = doomFromTree({ theme: defaultTheme, slides: [{ children: [] }] })
  const writesOf = (node: ComponentTree | ComponentNode, parent: unknown) => [
    { node: node.id, prop: "type", value: node.type },
    { node: node.id, prop: "parent", value: parent },
    ...Object.entries(node.props).map(([prop, value]) => ({ node: node.id, prop, value })),
  ]
  let at = orderKeyBetween(null, null)
  const writes = writesOf(tree, { id: slides[0], at })
  for (const child of tree.children) {
    at = orderKeyBetween(at, null)
    writes.push(...writesOf(child, { id: tree.id, at }))
  }
  const edit = readEdit({ once: "component", author: { kind: "person", id: "fixture" }, writes }, doom)
  if (isRefusal(edit)) throw new Error(JSON.stringify(edit))
  const result = applyEdit(doom, { ...edit, rev: rev(2) })
  if (isRefusal(result)) throw new Error(JSON.stringify(result))
  return result
}

describe("expandComponent", () => {
  it("places signed bars on either side of zero", () => {
    const rows = column.data.rows.map((row) => (row.id === "q1" ? { ...row, value: -12 } : row))
    const result = nodes({ ...inputs, data: { rows } })
    const baseline = zero(part(result, "zero"))
    expect(part(result, "bar", "q1")?.props.box.y).toBe(baseline)
    expect(bottom(part(result, "bar", "q2")?.props.box)).toBe(baseline)
    expect(part(result, "value", "q1")?.props.text?.chars).toBe("−12")
  })

  it("keeps zero and its label while a missing observation has only its category", () => {
    const result = nodes({
      ...inputs,
      data: {
        rows: [
          { id: "gap", label: "Missing", value: null },
          { id: "zero", label: "Zero", value: 0 },
        ],
      },
    })
    expect(part(result, "bar", "gap")).toBeUndefined()
    expect(part(result, "value", "gap")).toBeUndefined()
    expect(part(result, "category", "gap")?.props.text?.chars).toBe("Missing")
    expect(part(result, "bar", "zero")?.props.box.h).toBe(2)
    expect(part(result, "value", "zero")?.props.text?.chars).toBe("0")
  })

  it("fits labels with measured glyph widths and keeps both bars", () => {
    const theme = {
      ...defaultTheme,
      fonts: { heading: "DejaVu Sans", body: "DejaVu Sans" },
    }
    const advances = { i: 569 / 2048, W: 2025 / 2048 }
    const exact = measureWith({ "DejaVu Sans": { ascent: 1901 / 2048, descent: 483 / 2048, advances } })
    const rows = [
      { id: "narrow", label: "iiii", value: 12 },
      { id: "wide", label: "WWWW", value: 12 },
    ]
    const result = nodes({ ...inputs, theme, measure: exact, frame: { ...column.frame, w: 114 }, data: { rows } })
    expect(part(result, "category", "narrow")?.props.text?.chars).toBe("iiii")
    expect(part(result, "category", "wide")).toBeUndefined()
    expect(part(result, "bar", "narrow")).toBeDefined()
    expect(part(result, "bar", "wide")).toBeDefined()
  })

  it("formats units and precision from tokens without moving the bars", () => {
    const result = nodes({ ...inputs, tokens: { scale: 10, digits: 2, unitPlace: "label", suffix: "B" } })
    expect(part(nodes(), "unit")?.props.text?.chars).toBe("Revenue, $M")
    expect(part(result, "unit")?.props.text?.chars).toBe("Revenue")
    expect(part(result, "value", "q1")?.props.text?.chars).toBe("$1.20B")
    expect(part(result, "bar", "q1")?.props.box).toEqual(part(nodes(), "bar", "q1")?.props.box)
    expect(part(nodes({ ...inputs, variant: { labels: false } }), "value", "q1")).toBeUndefined()
    expect(
      part(nodes({ ...inputs, tokens: { accent: defaultTheme.colors.accent2 } }), "bar", "q1")?.props.fills,
    ).toEqual([{ kind: "solid", color: defaultTheme.colors.accent2 }])
  })

  it("expands empty data to a heading and a baseline", () => {
    expect(nodes({ ...inputs, data: { rows: [] } }).map((node) => node.key)).toEqual([["unit"], ["zero"]])
  })

  it("produces the same nodes for the same inputs and preserves keys across reorder", () => {
    expect(expand(columnComponent, inputs)).toEqual(expand(columnComponent, inputs))
    const reversed = nodes({ ...inputs, data: { rows: [...column.data.rows].reverse() } })
    expect(part(reversed, "bar", "q1")?.key).toEqual(part(nodes(), "bar", "q1")?.key)
    expect(part(reversed, "bar", "q1")?.props.box.x).not.toBe(part(nodes(), "bar", "q1")?.props.box.x)
  })

  it("refuses oversized data", () => {
    const rows = Array.from({ length: 101 }, (_, i) => ({ id: `q${i}`, label: "", value: 0 }))
    expect(expandComponent(columnComponent, { ...inputs, data: { rows } })).toMatchObject({ refused: "limit" })
  })

  it("refuses excessive spec depth and validates operators in unreachable branches", () => {
    let deep: unknown = 1
    for (let i = 0; i < 40; i += 1) deep = ["if", true, deep, 0]
    expect(readComponentSpec(specOf([{ emit: { ...rectangle, w: deep } }]))).toMatchObject({ refused: "limit" })
    const invalid = ["if", true, 1, ["unknown"]]
    expect(readComponentSpec(specOf([{ emit: { ...rectangle, w: invalid } }]))).toMatchObject({ refused: "shape" })
  })

  it("refuses work that exceeds the step budget even when no nodes are emitted", () => {
    const spec = read(
      specOf([
        {
          repeat: repeat("a"),
          children: [{ repeat: repeat("b"), children: [{ repeat: repeat("c"), when: false, emit: rectangle }] }],
        },
      ]),
    )
    expect(expandComponent(spec, { ...inputs, data: {} })).toMatchObject({ refused: "limit" })
  })

  it("refuses a tree above the node limit", () => {
    const spec = read(
      specOf([
        {
          repeat: repeat("a"),
          children: [
            { repeat: repeat("b"), emit: { ...rectangle, key: ["list", "rect", ["get", "a"], ["get", "b"]] } },
          ],
        },
      ]),
    )
    expect(expandComponent(spec, { ...inputs, data: {} })).toMatchObject({ refused: "limit" })
  })

  it("refuses nullable arithmetic, duplicate IDs and unknown typed references", () => {
    const badMath = ["sum", ["list", null]]
    const spec = read(specOf([{ emit: { ...rectangle, w: badMath } }]))
    expect(expandComponent(spec, { ...inputs, data: {} })).toMatchObject({ refused: "shape" })
    const row = column.data.rows[0]
    expect(expandComponent(columnComponent, { ...inputs, data: { rows: [row, row] } })).toMatchObject({
      refused: "shape",
    })
    const fixture = architecture.fixture
    const data = { ...fixture.data, edges: [{ ...fixture.data.edges[0], to: "unknown" }] }
    expect(expandComponent(read(architecture.spec), { ...inputs, data })).toMatchObject({ refused: "shape" })
  })

  it("expands waterfall balances, zero crossings, bridges and reset", () => {
    const fixture = waterfall.fixture
    const { children } = expand(read(waterfall.spec), {
      ...fixture,
      themeTokens: fixture.theme,
      theme: defaultTheme,
      measure,
    })
    const baseline = zero(part(children, "zero"))
    expect(part(children, "value", "subtotal")?.props.text?.chars).toBe("14")
    expect(part(children, "value", "end")?.props.text?.chars).toBe("−7")
    expect(part(children, "bar", "loss")?.props.box.y).toBeLessThan(baseline)
    expect(bottom(part(children, "bar", "loss")?.props.box)).toBeGreaterThan(baseline)
    expect(zero(part(children, "bridge", "win"))).toBe(part(children, "bar", "open")?.props.box.y)
    expect(part(children, "bar", "reset")?.props.box.y).toBe(baseline)
    expect(part(children, "bridge", "subtotal")).toBeUndefined()
  })

  it("resolves an architecture connector before its attached rectangles in paint order", () => {
    const fixture = architecture.fixture
    const tree = expand(read(architecture.spec), {
      ...fixture,
      themeTokens: fixture.theme,
      theme: defaultTheme,
      measure,
    })
    const { children } = tree
    const audit = part(children, "edge", "audit")
    const gateway = part(children, "service", "gateway")
    const archive = part(children, "service", "archive")
    expect(children.indexOf(audit!)).toBeLessThan(children.indexOf(gateway!))
    expect(audit?.props.geometry).toMatchObject({
      kind: "line",
      start: { node: gateway?.id, site: "r" },
      end: { node: archive?.id, site: "t" },
    })
    expect(land(tree).nodes.get(audit!.id)).toMatchObject(audit!.props)
  })
})
