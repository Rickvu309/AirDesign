import { describe, expect, it } from "vitest"
import {
  applyEdit,
  defaultTheme,
  doomFromTree,
  fontFace,
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
const dejavu = { ...defaultTheme, fonts: { heading: "DejaVu Sans", body: "DejaVu Sans" } }
const metrics = (digits: number, extra: Readonly<Record<string, number>>) => ({
  ascent: 1901 / 2048,
  descent: 483 / 2048,
  advances: Object.fromEntries(
    [...Array.from("0123456789", (char) => [char, digits] as const), ...Object.entries(extra)].map(([char, width]) => [
      char,
      width / 2048,
    ]),
  ),
})
const exact = measureWith({
  [fontFace("DejaVu Sans", false, false)]: metrics(1303, { F: 1178, Y: 1251, E: 1294, W: 2025, i: 569, " ": 651 }),
  [fontFace("DejaVu Sans", true, false)]: metrics(1425, { "−": 1716, ".": 778 }),
})
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
const widestList = ["list", ...Array.from({ length: 64 }, (_, i) => i)]
const measuredText = {
  kind: "text",
  key: ["list", "label"],
  x: 0,
  y: 0,
  w: 1,
  h: 1,
  chars: ["concat", "W".repeat(200), "W".repeat(200)],
  style: "body",
  color: defaultTheme.colors.text,
  align: "left",
  alignV: "top",
  fit: "omit",
}

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

  it("keeps all text boxes apart for a signed column with DejaVu Sans widths", () => {
    const rows = [12.4, 18.9, -6.2, null, 0, 24.1].map((value, i) => ({
      id: `fy${21 + i}`,
      label: `FY${21 + i}`,
      value,
    }))
    const result = nodes({ ...inputs, theme: dejavu, measure: exact, data: { rows }, tokens: { digits: 1 } })
    expect(part(result, "value", "fy23")?.props.text?.chars).toBe("−6.2")
    expect(part(result, "category", "fy23")?.props.text?.chars).toBe("FY23")
    const labels = result.filter((node) => node.props.text !== undefined)
    for (const [
      i,
      {
        key,
        props: { box: a },
      },
    ] of labels.entries())
      for (const {
        key: other,
        props: { box: b },
      } of labels.slice(i + 1))
        expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h, `${key} vs ${other}`).toBe(
          false,
        )
  })

  it("formats units and precision from tokens without moving the bars", () => {
    const base = { ...inputs, tokens: { title: "Sales", unitHeader: "$M", prefix: "$" } }
    const result = nodes({ ...base, tokens: { ...base.tokens, scale: 10, digits: 2, unitPlace: "label", suffix: "B" } })
    expect(part(nodes(base), "unit")?.props.text?.chars).toBe("Sales, $M")
    expect(part(result, "unit")?.props.text?.chars).toBe("Sales")
    expect(part(result, "value", "q1")?.props.text?.chars).toBe("$1.20B")
    expect(part(result, "bar", "q1")?.props.box).toEqual(part(nodes(), "bar", "q1")?.props.box)
    expect(part(nodes({ ...inputs, variant: { labels: false } }), "value", "q1")).toBeUndefined()
    expect(
      part(nodes({ ...inputs, tokens: { accent: defaultTheme.colors.accent2 } }), "bar", "q1")?.props.fills,
    ).toEqual([{ kind: "solid", color: defaultTheme.colors.accent2 }])
  })

  it("uses grouping and locale from theme tokens with instance overrides", () => {
    const data = { rows: [{ id: "r", label: "Row", value: -12345.6 }] }
    const input = { ...inputs, data, tokens: { digits: 2 } }
    expect(part(nodes(input), "value", "r")?.props.text?.chars).toBe("−12,345.60")
    const localized = { ...input, themeTokens: { "number.locale": "de-DE", "number.group": true } }
    expect(part(nodes(localized), "value", "r")?.props.text?.chars).toBe("−12.345,60")
    expect(
      part(nodes({ ...localized, tokens: { ...input.tokens, "number.group": false } }), "value", "r")?.props.text
        ?.chars,
    ).toBe("−12345,60")
  })

  it("expands empty data without assuming a subject or unit", () => {
    const tree = expand(columnComponent, { ...inputs, data: { rows: [] } })
    expect(tree.props.name).toBe("Chart")
    expect(tree.children.map((node) => node.key)).toEqual([["zero"]])
    expect(columnComponent.quantities).toBeUndefined()
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

  it("bounds nested maps and scope lookup across wide scopes", () => {
    const bindings = (prefix: string) => Array.from({ length: 32 }, (_, i) => [`${prefix}${i}`, i])
    const nested = ["map", widestList, "a", ["map", widestList, "b", ["map", widestList, "c", 1]]]
    let parts: unknown[] = [{ emit: { ...rectangle, w: ["count", nested] } }]
    for (let i = 0; i < 30; i += 1) parts = [{ let: bindings(`v${i}x`), children: parts }]
    const spec = read({ ...specOf(parts), let: bindings("root") })
    expect(expandComponent(spec, { ...inputs, data: {} })).toMatchObject({
      refused: "limit",
      field: expect.stringContaining(".emit.w"),
      form: expect.stringContaining("work"),
    })

    const lookups = ["map", widestList, "row", ["map", widestList, "cell", ["get", "root0"]]]
    parts = [{ emit: { ...rectangle, w: ["count", lookups] } }]
    for (let i = 0; i < 20; i += 1) parts = [{ let: [[`local${i}`, i]], children: parts }]
    expect(expandComponent(read({ ...specOf(parts), let: [["root0", 1]] }), { ...inputs, data: {} })).toMatchObject({
      refused: "limit",
      field: expect.stringContaining(".emit.w"),
    })
  })

  it("bounds measure calls and their text even when every label is omitted", () => {
    const spec = read(
      specOf([
        {
          repeat: { over: widestList, as: "a" },
          children: [
            {
              repeat: { over: widestList, as: "b" },
              children: [{ repeat: { over: widestList, as: "c" }, emit: measuredText }],
            },
          ],
        },
      ]),
    )
    let calls = 0
    let chars = 0
    const measure: ComponentInput["measure"] = (text, theme, width) => {
      calls += 1
      chars += text.chars.length
      return exact(text, theme, width)
    }
    const result = expandComponent(spec, { ...inputs, data: {}, measure })
    expect(calls).toBeGreaterThan(0)
    expect(calls).toBeLessThanOrEqual(80)
    expect(chars).toBeLessThanOrEqual(32_000)
    expect(result).toMatchObject({
      refused: "limit",
      field: expect.stringContaining(".emit."),
    })
  })

  it("refuses division by zero at its expression path", () => {
    const spec = read(specOf([{ emit: { ...rectangle, w: ["add", 1, ["div", 0, 0]] } }]))
    expect(expandComponent(spec, { ...inputs, data: {} })).toMatchObject({
      refused: "shape",
      field: "parts[0].emit.w[2]",
      form: "The divisor must be nonzero.",
    })
  })

  it("names an unknown value and a duplicate key at their spec paths", () => {
    const unknown = read(specOf([{ emit: { ...rectangle, w: ["get", "missing"] } }]))
    expect(expandComponent(unknown, { ...inputs, data: {} })).toMatchObject({
      refused: "shape",
      field: "parts[0].emit.w",
      form: 'Unknown value "missing".',
    })
    const duplicate = read(specOf([{ emit: rectangle }, { emit: rectangle }]))
    expect(expandComponent(duplicate, { ...inputs, data: {} })).toMatchObject({
      refused: "shape",
      field: "parts[1].emit.key",
      form: 'Duplicate emitted key ["rectangle"].',
    })
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
