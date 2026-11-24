import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import type { Desc } from "../design/control-desc"
import { optionWord } from "../copy/option-copy"
import { choiceLayout, controlKinds, controlOf } from "../design/panel-arrangement"
import { controlViews } from "../design/control-views"
import { nodeModel } from "./design-model"
import { grow, spot } from "./testing/doom-fixtures"

const specs = Object.keys(import.meta.glob("../../../../tests/browser/control-*.spec.ts")).map(
  (path) => /control-([a-z]+)\.spec\.ts$/.exec(path)?.[1] ?? path,
)

const notInDoomPanel: readonly string[] = ["adjust", "count", "percent", "preset"]

const words: doom.Text = { chars: "Hi", spans: [], paras: [{}], style: "body", resize: "widthAndHeight", alignV: "top" }
const solid = [{ kind: "solid" as const, color: { var: "accent1" as const } }]

const built = grow([
  { type: "shape", name: "words", props: { box: spot(0, 0, 300, 60), text: words } },
  {
    type: "shape",
    name: "card",
    props: { box: spot(0, 100, 200, 100), geometry: { kind: "rect" }, fills: solid, strokes: solid, text: words },
  },
  {
    type: "shape",
    name: "rule",
    props: {
      box: spot(0, 300, 100, 0),
      geometry: {
        kind: "line",
        start: { x: 0, y: 0 },
        end: { x: 100, y: 0 },
        route: "straight",
        arrows: ["none", "none"],
      },
      strokes: solid,
      stroke: { weight: 4, align: "center", dash: "solid" },
    },
  },
  {
    type: "shape",
    name: "star",
    props: {
      box: spot(0, 400, 120, 120),
      geometry: { kind: "icon", name: "lucide/star" },
      strokes: solid,
      stroke: { weight: 10, align: "center", dash: "solid" },
    },
  },
  {
    type: "shape",
    name: "photo",
    props: {
      box: spot(300, 0, 200, 100),
      geometry: { kind: "rect" },
      fills: [{ kind: "image", asset: "a".repeat(64), fit: "fill" }],
    },
  },
])

function inside(desc: Desc): readonly Desc[] {
  if (desc.kind === "union") return Object.values(desc.cases).flatMap((item) => [item, ...inside(item)])
  if (desc.kind === "record") return Object.values(desc.fields).flatMap((item) => [item, ...inside(item)])
  if (desc.kind === "list" || desc.kind === "named") return [desc.item, ...inside(desc.item)]
  return []
}

const controls = Object.values(built.ids)
  .flatMap((id) => nodeModel({ view: built.view, id, theme: doom.defaultTheme, slides: [built.slides[0]!] }).sections)
  .flatMap((section) => section.strips.flat())

function kindsInUse(): readonly string[] {
  const descs = controls
    .flatMap((control) => [control.desc, ...inside(control.desc)])
    .filter((desc) => desc.kind !== "mark")
  return [...new Set(descs.map(controlOf).filter((kind) => kind !== null))].sort()
}

function choices(desc: Desc, field: string): readonly (readonly [string, readonly string[]])[] {
  switch (desc.kind) {
    case "choice":
      return [[field, desc.options]]
    case "record":
      return Object.entries(desc.fields).flatMap(([name, item]) => choices(item, `${field}.${name}`))
    case "union":
      return Object.entries(desc.cases).flatMap(([name, item]) => choices(item, `${field}.${name}`))
    default:
      return []
  }
}

describe("every control kind a field uses", () => {
  it("has one component and one browser spec of its name, inside a union, a record or a list too", () => {
    const used = kindsInUse()
    expect(used.filter((kind) => !Object.hasOwn(controlViews, kind))).toEqual([])
    expect(used.filter((kind) => !specs.includes(kind) && !notInDoomPanel.includes(kind))).toEqual([])
  })

  it("has one component and one browser spec of its name for every kind, the action rows too", () => {
    expect(controlKinds.filter((kind) => !Object.hasOwn(controlViews, kind))).toEqual([])
    expect(controlKinds.filter((kind) => !specs.includes(kind) && !notInDoomPanel.includes(kind))).toEqual([])
  })

  it("lists a kind as missing from Doom's design panel only while it has no browser spec", () => {
    expect(notInDoomPanel.filter((kind) => specs.includes(kind))).toEqual([])
  })

  it("names no spec or component for a kind outside the closed list", () => {
    const known: readonly string[] = controlKinds
    expect(specs.filter((kind) => !known.includes(kind))).toEqual([])
    expect(Object.keys(controlViews).filter((kind) => !known.includes(kind))).toEqual([])
  })

  it("puts every segmented word inside its segment", () => {
    const segmented = controls.flatMap((control) =>
      choices(control.desc, control.field).filter(([name, options]) => choiceLayout(name, options) !== "list"),
    )
    expect(segmented.length).toBeGreaterThan(0)
    for (const [field, options] of segmented)
      for (const option of options) expect(optionWord(field, option).length).toBeLessThanOrEqual(12)
  })

  it("maps a length, a type size, a flag, a colour, a choice and words to their controls", () => {
    const descs: readonly Desc[] = [
      { kind: "number", unit: "emu", min: 0, max: 100 },
      { kind: "number", unit: "hundredth-point", min: 100, max: 400_000 },
      { kind: "flag" },
      { kind: "color" },
      { kind: "choice", options: ["left", "right"] },
      { kind: "words", max: 64 },
    ]
    expect(descs.map(controlOf)).toEqual(["length", "length", "toggle", "color", "choice", "text"])
  })
})
