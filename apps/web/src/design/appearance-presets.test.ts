import { elementId, type ScopedElement } from "@airdesign/document"
import { expect, it } from "vitest"
import { panelOf } from "./panel"

const view: ScopedElement = {
  node: elementId("258.2"),
  facts: { kind: "shape", text: false, grouped: false, animated: false },
  kept: [],
  value: null,
  box: { x: 0, y: 0, cx: 914400, cy: 914400 },
}

function panel(fields: Readonly<Record<string, unknown>> = {}) {
  return panelOf(view, {
    reads: {},
    moves: true,
    fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { value, own: true }])),
  })
}

function preset(trait: string, fields: Readonly<Record<string, unknown>> = {}) {
  const control = panel(fields)
    .sections.find((section) => section.trait === trait)
    ?.strips.flat()[0]
  expect(control).toBeDefined()
  if (control === undefined) throw new Error(trait)
  return control
}

it("orders shape appearance before its shut detail sections", () => {
  expect(
    panel()
      .sections.map(({ trait, open }) => [trait, open])
      .slice(0, 8),
  ).toEqual([
    ["alignment", true],
    ["fill", true],
    ["opacity", true],
    ["border", true],
    ["shadow", true],
    ["geometry", false],
    ["line", false],
    ["effects", false],
  ])
})

it("writes each border preset and recognizes only exact supported appearances", () => {
  const border = preset("border")
  expect(border.change("none")).toEqual({ target: { node: view.node }, line: { fill: { none: true } } })
  for (const dash of ["solid", "dash", "dot"]) {
    const change = border.change(dash)
    expect(change).toEqual({ target: { node: view.node }, line: { fill: { solid: { scheme: "tx1" } }, dash } })
    expect(preset("border", { "line.fill": { solid: { rgb: "123456" } }, "line.dash": dash }).value).toBe(dash)
  }
  expect(preset("border", { "line.fill": { none: true } }).value).toBe("none")
  expect(preset("border", { "line.fill": { gradient: {} }, "line.dash": "solid" }).value).toBeUndefined()
  expect(preset("border", { "line.fill": { solid: {} }, "line.dash": "dashDot" }).value).toBeUndefined()
})

it("writes fixed outer shadow strengths, recognizes each and leaves custom shadows unpressed", () => {
  const shadow = preset("shadow")
  expect(shadow.change("none")).toEqual({ target: { node: view.node }, effects: { shadow: { none: true } } })
  for (const strength of ["subtle", "medium", "strong"]) {
    const change = shadow.change(strength)
    expect(change.effects?.shadow).toHaveProperty("outer")
    expect(preset("shadow", { "effects.shadow": change.effects?.shadow }).value).toBe(strength)
  }
  expect(preset("shadow", { "effects.shadow": { none: true } }).value).toBe("none")
  expect(preset("shadow", { "effects.shadow": { outer: { blur: 999 } } }).value).toBeUndefined()
})

it("shows the Line color and width only for the supplied solid Border screenshot", () => {
  for (const dash of ["solid", "dash", "dot"]) {
    const connector = { ...view, facts: { ...view.facts, kind: "connector" as const } }
    const sections = panelOf(connector, {
      reads: {},
      moves: true,
      fields: {
        "line.fill": { value: { solid: { rgb: "000000" } }, own: true },
        "line.dash": { value: dash, own: true },
      },
    }).sections
    const fields = sections
      .find(({ trait }) => trait === "border")
      ?.strips.flat()
      .map(({ field }) => field)
    expect(fields).toEqual(dash === "solid" ? ["border", "fill.solid", "width"] : ["border"])
  }
})
