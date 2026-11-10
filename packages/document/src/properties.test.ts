import { describe, expect, it } from "vitest"
import { type ExportRoute, type Kind, kinds, properties } from "./properties.js"

type PropertyRow = {
  readonly keys: readonly string[]
  readonly routes: Readonly<Record<string, string>>
}

const table = new Map<string, PropertyRow>([
  ["deck", { keys: ["size"], routes: { size: "presentation.size" } }],
  ["theme", { keys: ["colors", "fonts"], routes: { colors: "theme.colors", fonts: "theme.fonts" } }],
  ["master", { keys: ["background"], routes: { background: "cSld.bg" } }],
  ["layout", { keys: ["background", "name"], routes: { background: "cSld.bg", name: "cNvPr.name" } }],
  ["section", { keys: ["title"], routes: { title: "section.title" } }],
  [
    "slide",
    {
      keys: ["background", "notes", "hidden", "layout"],
      routes: { background: "cSld.bg", notes: "notes.body", hidden: "sld.show", layout: "slide.layoutRel" },
    },
  ],
  [
    "shape",
    {
      keys: ["box", "geometry", "fill", "line", "effects", "text", "body", "placeholder", "role", "name", "alt"],
      routes: {
        box: "xfrm",
        geometry: "prstGeom",
        fill: "spPr.fill",
        line: "ln",
        effects: "effectLst",
        text: "txBody",
        body: "bodyPr",
        placeholder: "nvPr.ph",
        role: "airdesign.role",
        name: "cNvPr.name",
        alt: "cNvPr.descr",
      },
    },
  ],
  [
    "picture",
    {
      keys: ["box", "asset", "crop", "line", "role", "name", "alt"],
      routes: {
        box: "xfrm",
        asset: "blip.embed",
        crop: "srcRect",
        line: "ln",
        role: "airdesign.role",
        name: "cNvPr.name",
        alt: "cNvPr.descr",
      },
    },
  ],
  [
    "connector",
    {
      keys: ["box", "line", "geometry", "name"],
      routes: { box: "xfrm", line: "ln", geometry: "prstGeom", name: "cNvPr.name" },
    },
  ],
  [
    "group",
    {
      keys: ["box", "children", "role", "name", "alt"],
      routes: {
        box: "xfrm",
        children: "grpSpPr.chXfrm",
        role: "airdesign.role",
        name: "cNvPr.name",
        alt: "cNvPr.descr",
      },
    },
  ],
  [
    "table",
    {
      keys: ["box", "columns", "style", "role", "name", "alt"],
      routes: {
        box: "xfrm",
        columns: "tblGrid",
        style: "tblPr.style",
        role: "airdesign.role",
        name: "cNvPr.name",
        alt: "cNvPr.descr",
      },
    },
  ],
  ["row", { keys: ["height"], routes: { height: "tr.h" } }],
  [
    "cell",
    {
      keys: ["text", "fill", "borders", "span"],
      routes: { text: "txBody", fill: "tcPr.fill", borders: "tcPr.borders", span: "tc.span" },
    },
  ],
  [
    "chart",
    {
      keys: ["box", "data", "type", "title", "legend", "axes", "series", "role", "name", "alt"],
      routes: {
        box: "xfrm",
        data: "chart.data",
        type: "chart.type",
        title: "chart.title",
        legend: "chart.legend",
        axes: "chart.axes",
        series: "chart.seriesStyle",
        role: "airdesign.role",
        name: "cNvPr.name",
        alt: "cNvPr.descr",
      },
    },
  ],
  ["kept", { keys: ["box", "name", "alt"], routes: { box: "xfrm", name: "cNvPr.name", alt: "cNvPr.descr" } }],
])

function rowOf(kind: string): PropertyRow {
  const row = table.get(kind)
  if (row === undefined) {
    throw new Error(`missing row ${kind}`)
  }
  return row
}

function readRoute(record: object, key: string): string {
  const entry = Object.getOwnPropertyDescriptor(record, key)?.value
  if (typeof entry !== "object" || entry === null || !("route" in entry) || typeof entry.route !== "string") {
    throw new Error(`missing route ${key}`)
  }
  return entry.route
}

function visit(kind: Kind, seen: Set<string>): void {
  const row = rowOf(kind)
  const actual = properties[kind]
  expect(Object.keys(actual), kind).toEqual([...row.keys])
  for (const key of row.keys) {
    const name = `${kind}.${key}`
    const expected = row.routes[key]
    if (expected === undefined) {
      throw new Error(`missing row ${name}`)
    }
    expect(readRoute(actual, key), name).toBe(expected)
    seen.add(name)
  }
  seen.add(kind)
}

function walk(): void {
  expect([...kinds]).toEqual([
    "deck",
    "theme",
    "master",
    "layout",
    "section",
    "slide",
    "shape",
    "picture",
    "connector",
    "group",
    "table",
    "row",
    "cell",
    "chart",
    "kept",
  ])
  expect(Object.keys(properties)).toEqual([...kinds])
  const shapeText: ExportRoute = properties.shape.text.route
  expect(shapeText, "shape.text").toBe(rowOf("shape").routes.text)
  const seen = new Set<string>()
  for (const kind of kinds) {
    visit(kind, seen)
  }
  for (const kind of table.keys()) {
    if (!seen.has(kind)) {
      throw new Error(`not visited: ${kind}`)
    }
    for (const key of rowOf(kind).keys) {
      const name = `${kind}.${key}`
      if (!seen.has(name)) {
        throw new Error(`not visited: ${name}`)
      }
    }
  }
}

describe("properties", () => {
  it("names an export route for every key", () => {
    walk()
  })
})
