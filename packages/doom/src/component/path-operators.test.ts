import { describe, expect, it } from "vitest"
import { defaultTheme, isRefusal, measureWith } from "../index.js"
import {
  expandComponent,
  readComponentSpec,
  type ComponentInput,
  type ComponentNode,
  type ComponentSpec,
} from "./index.js"
import { wedge } from "./path-operators.js"
import paths from "./testing/paths.json" with { type: "json" }

const inputs = {
  data: {},
  frame: { x: 0, y: 0, w: 1920, h: 1080 },
  theme: defaultTheme,
  measure: measureWith({}),
}
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
const part = (nodes: readonly ComponentNode[], key: string) => nodes.find((node) => node.key[0] === key)
const rectangle = { key: ["list", "path"], x: 0, y: 0, w: 1, h: 1, fill: defaultTheme.colors.text }
const specOf = (parts: readonly unknown[]) => ({ version: 1, name: "Fixture", collections: {}, parts })
const repeat = { over: ["list", ...Array.from({ length: 50 }, (_, i) => String(i))], as: "row" }

describe("component paths", () => {
  it("emits pie, donut and stroke-only polyline paths with stable keys and coordinates", () => {
    const spec = read(paths)
    const tree = expand(spec, inputs)
    const pie = part(tree.children, "pie")
    const donut = part(tree.children, "donut")
    const polyline = part(tree.children, "polyline")
    expect(pie?.props.geometry).toEqual({
      kind: "path",
      fillStroke: true,
      d: "M0.9045084972 0.7938926261A0.5 0.5 0 1 1 0.5 0L0.5 0.5Z",
    })
    expect(donut?.props.geometry).toEqual({
      kind: "path",
      fillStroke: true,
      d: "M0.9045084972 0.7938926261A0.5 0.5 0 1 1 0.5 0L0.5 0.21A0.29 0.29 0 1 0 0.7346149284 0.6704577232Z",
    })
    expect(polyline?.props).toMatchObject({
      geometry: { kind: "path", d: "M0 0.8L0.35 0.2L0.65 0.65L1 0.1" },
      strokes: [{ kind: "solid", color: paths.defaults.ink.toLowerCase() }],
      stroke: { weight: 14, align: "center", dash: "solid" },
    })
    expect(polyline?.props.fills).toBeUndefined()
    expect(tree.children.filter((node) => node.key[0] === "marker")).toHaveLength(3)
    expect(expand(spec, inputs)).toEqual(tree)
  })

  it("reverses the inner arc and shares the radial endpoints of adjacent wedges", () => {
    const emitWedge = (key: string, from: number, to: number) => ({
      emit: {
        kind: "path",
        key: ["list", key],
        x: 0,
        y: 0,
        w: 200,
        h: 200,
        fill: defaultTheme.colors.text,
        d: ["wedge", ["point", 0.5, 0.5], 0.25, 0.5, from, to],
      },
    })
    const tree = expand(read(specOf([emitWedge("first", 0, 0.25), emitWedge("second", 0.25, 1)])), inputs)
    expect(part(tree.children, "first")?.props.geometry).toEqual({
      kind: "path",
      d: "M1 0.5A0.5 0.5 0 0 1 0.5 1L0.5 0.75A0.25 0.25 0 0 0 0.75 0.5Z",
    })
    expect(part(tree.children, "second")?.props.geometry).toEqual({
      kind: "path",
      d: "M0.5 1A0.5 0.5 0 1 1 1 0.5L0.75 0.5A0.25 0.25 0 1 0 0.5 0.75Z",
    })
  })

  it("closes full discs and rings even when the sweep rounds away from one turn", () => {
    for (const direction of [1, -1]) {
      for (let i = -1000; i <= 1000; i++) {
        const start = i / 1000
        for (const [inner, arcs] of [
          [0, 2],
          [0.29, 4],
        ] as const) {
          for (const delta of [-5e-10, 0, 5e-10]) {
            const d = wedge([{ x: 0.5, y: 0.5 }, inner, 0.5, start, start + direction * (1 + delta)], () => {})
            expect(d.match(/A/g), `start ${start}, direction ${direction}, delta ${delta}`).toHaveLength(arcs)
            expect(d).not.toContain("L")
          }
        }
      }
    }
  })

  it("snaps near-full wedges and splits almost-complete arcs into stable pieces", () => {
    const center = { x: 0.5, y: 0.5 }
    for (const direction of [1, -1]) {
      const start = 0.125
      const full = wedge([center, 0.29, 0.5, start, start + direction], () => {})
      for (const delta of [4e-9, 4e-8, 4e-7]) {
        expect(wedge([center, 0.29, 0.5, start, start + direction * (1 - delta)], () => {})).toBe(full)
      }
      const partial = wedge([center, 0.29, 0.5, start, start + direction * (1 - 1e-5)], () => {})
      expect(partial).toMatch(/^M[^L]*A[^L]*A[^L]*L[^L]*A[^L]*A[^L]*Z$/)
    }
  })

  it("refuses invalid path operands and charges repeated path output", () => {
    const expandPath = (d: unknown) =>
      expandComponent(read(specOf([{ emit: { ...rectangle, kind: "path", d } }])), inputs)
    expect(expandPath(["polyline", ["list", ["point", 0, 0]]])).toMatchObject({
      refused: "shape",
      field: "parts[0].emit.d",
    })
    expect(expandPath(["wedge", ["point", 0.5, 0.5], 0.6, 0.5, 0, 0.5])).toMatchObject({
      refused: "shape",
      field: "parts[0].emit.d",
    })
    expect(expandPath(["wedge", ["point", 0.5, 0.5], 0, 0.5, 0, 1.5])).toMatchObject({
      refused: "shape",
      field: "parts[0].emit.d",
      form: expect.stringContaining("one"),
    })
    const points = ["list", ...Array.from({ length: 64 }, () => ["point", -12.123456789, 12.987654321])]
    const spec = read({
      ...specOf([
        {
          repeat,
          emit: { ...rectangle, key: ["list", "path", ["get", "row"]], kind: "path", d: ["get", "trace"] },
        },
      ]),
      let: [["trace", ["polyline", points]]],
    })
    expect(expandComponent(spec, inputs)).toMatchObject({
      refused: "limit",
      field: "parts[0].emit.d",
    })
  })
})
