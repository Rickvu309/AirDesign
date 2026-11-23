import * as doom from "@airdesign/doom"
import type { Desc } from "./design/control-desc"
import { describe, expect, it } from "vitest"
import type { PanelControl } from "./design/panel"
import { templateColorColumns, typedColor } from "./design/color-choices"
import { namedByColor } from "./design/color-names"
import { changeWrites } from "./doom-editor/design-changes"
import { nodeModel } from "./doom-editor/design-model"
import { swatchesOf } from "./doom-editor/design-palette"
import { grow, landed, spot } from "@/testing/doom-fixtures"

const hash = "#"
const theme = doom.defaultTheme

const built = grow([
  {
    type: "shape",
    name: "words",
    props: {
      box: spot(100, 100, 300, 60),
      text: { chars: "Hello", spans: [], paras: [{}], style: "body", resize: "widthAndHeight", alignV: "top" },
    },
  },
  {
    type: "shape",
    name: "card",
    props: {
      box: spot(100, 300, 200, 100),
      geometry: { kind: "rect" },
      fills: [{ kind: "solid", color: { var: "background2" } }],
      strokes: [{ kind: "solid", color: { var: "text2" } }],
      stroke: { weight: 2, align: "inside", dash: "solid" },
    },
  },
  {
    type: "shape",
    name: "rule",
    props: {
      box: spot(0, 0, 100, 0),
      geometry: {
        kind: "line",
        start: { x: 0, y: 0 },
        end: { x: 100, y: 0 },
        route: "straight",
        arrows: ["none", "none"],
      },
      strokes: [{ kind: "solid", color: { var: "text2" } }],
      stroke: { weight: 4, align: "center", dash: "solid" },
    },
  },
  {
    type: "shape",
    name: "star",
    props: {
      box: spot(0, 0, 120, 120),
      geometry: { kind: "icon", name: "lucide/star" },
      strokes: [{ kind: "solid", color: { var: "text2" } }],
      stroke: { weight: 10, align: "center", dash: "solid" },
    },
  },
  {
    type: "frame",
    name: "panel",
    props: { box: spot(0, 500, 400, 200), fills: [{ kind: "solid", color: { var: "background2" } }] },
    children: [],
  },
])
const { view, geometry } = built
const size = doom.deckOf(view).size
const id = (name: string) => built.ids[name]!

type Field = "fill" | "stroke" | "color"
const sends: Readonly<Record<string, readonly Field[]>> = {
  words: ["color"],
  card: ["fill", "stroke"],
  rule: ["stroke"],
  star: ["stroke"],
  panel: ["fill"],
}
const propOfField: Readonly<Record<Field, "fills" | "strokes" | "text">> = {
  fill: "fills",
  stroke: "strokes",
  color: "text",
}
const agentColors: readonly doom.AgentColor[] = [...(Object.keys(theme.colors) as doom.ColorVar[]), `${hash}1f4e79`]

function colored(desc: Desc): boolean {
  switch (desc.kind) {
    case "color":
      return true
    case "union":
      return Object.values(desc.cases).some(colored)
    case "record":
      return Object.values(desc.fields).some(colored)
    case "list":
    case "named":
      return colored(desc.item)
    default:
      return false
  }
}

function colorControls(name: string): readonly PanelControl[] {
  return nodeModel({ view, id: id(name), theme, slides: [] })
    .sections.flatMap((section) => section.strips.flat())
    .filter((control) => colored(control.desc))
}

const sent = (control: PanelControl, color: doom.Color) => (control.desc.kind === "color" ? color : { solid: color })

function personColors(): readonly doom.Color[] {
  const columns = templateColorColumns(namedByColor(swatchesOf(theme)))
  const tint = columns
    .flatMap((column) => column.shades)
    .find((shade) => typeof shade.color !== "string" && (shade.color.tint ?? 0) > 0)
  return [...columns.map((column) => column.swatch.color), tint!.color, typedColor(`${hash}1F4E79`)!]
}

function colorsIn(value: unknown): readonly string[] {
  if (Array.isArray(value)) return value.flatMap(colorsIn)
  if (typeof value !== "object" || value === null) return []
  const own = "color" in value ? [JSON.stringify(value.color)] : []
  return [...own, ...Object.values(value).flatMap(colorsIn)]
}

const doomColor = (color: doom.AgentColor): doom.Color =>
  color.startsWith(hash) ? (color.toLowerCase() as doom.Hex) : { var: color as doom.ColorVar }

function shows(after: doom.Doom, name: string, prop: string, color: doom.Color): boolean {
  const value = (after.nodes.get(id(name)) as unknown as Record<string, unknown>)[prop]
  return colorsIn(value).includes(JSON.stringify(color))
}

function personLands(name: string, control: PanelControl, color: doom.Color): doom.Doom | null {
  const context = { view, ids: [id(name)], geometry, size, slides: [] }
  const writes = changeWrites(context, control, sent(control, color))
  return writes.length === 0 ? null : landed(view, writes)
}

describe("a person reaches every colour an agent can send", () => {
  it("offers a template colour, a tint and a typed hex in every colour control of Doom's panel, and each lands", () => {
    const missed: string[] = []
    for (const name of Object.keys(sends))
      for (const control of colorControls(name))
        for (const color of personColors()) {
          const after = personLands(name, control, color)
          const landedIt =
            after !== null && ["fills", "strokes", "text"].some((prop) => shows(after, name, prop, color))
          if (!landedIt) missed.push(`${name} ${control.trait}.${control.field} ${JSON.stringify(color)}`)
        }
    expect(missed).toEqual([])
  })

  it("lands every colour an agent sends to a layer from Doom's panel too, on the same property", () => {
    const missed: string[] = []
    let next = 0
    const mint = () => doom.nodeId(`m:${String((next += 1))}`)
    for (const [name, fields] of Object.entries(sends))
      for (const field of fields)
        for (const color of agentColors) {
          const writes = doom.compileAgentChange(view, { op: "set", target: id(name), [field]: color }, mint)
          const prop = propOfField[field]
          const wanted = doomColor(color)
          if (doom.isRefusal(writes) || !shows(landed(view, writes), name, prop, wanted)) {
            missed.push(`agent ${name} ${field} ${color}`)
            continue
          }
          const reached = colorControls(name).some((control) =>
            personColors().some((choice) => {
              if (JSON.stringify(choice) !== JSON.stringify(wanted) && !color.startsWith(hash)) return false
              const typed = color.startsWith(hash) ? typedColor(color)! : choice
              const after = personLands(name, control, typed)
              return after !== null && shows(after, name, prop, wanted)
            }),
          )
          if (!reached) missed.push(`${name} ${field} ${color}`)
        }
    expect(missed).toEqual([])
  })

  it("offers a tint written as the theme colour and its tint, so it follows a template color change", () => {
    const templateColors = namedByColor([{ var: "accent1" as const, css: "4472C4" }])
    const [tint] = templateColorColumns(templateColors).flatMap((column) => column.shades)
    expect(tint?.color).toEqual({ var: "accent1", tint: 0.8 })
  })
})
