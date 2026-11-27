import { newDeckTheme, styles } from "@airdesign/taste"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { UnionControl } from "../design/controls/union"
import { ColorControl } from "../design/controls/color"
import * as doom from "@airdesign/doom"
import { type AgentColor, colorVars, compileAgentChange, starts, testTheme } from "@airdesign/doom/testing"
import type { Desc } from "../design/control-desc"
import { describe, expect, it } from "vitest"
import type { PanelControl } from "../design/panel"
import { pickerSwatches, templateColorColumns, typedColor } from "../design/color-choices"
import { namedByColor } from "../design/color-names"
import { changeWrites } from "./design-changes"
import { nodeModel } from "./design-model"
import { paletteOf } from "./design-palette"
import { neutralColorNames } from "./testing/neutral-color-names"
import { grow, landed, spot } from "./testing/doom-fixtures"
import { placement } from "@airdesign/doom/testing"

const hash = "#"
const theme = testTheme

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
const displayOnly = ["positive", "negative", "total"] as const
const agentColors: readonly AgentColor[] = [...doom.paletteColorVars, `${hash}1f4e79`]

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
  const columns = templateColorColumns(pickerSwatches(paletteOf(view, theme).templateColors))
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

const doomColor = (color: AgentColor): doom.Color =>
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

describe("colour controls and agent colours", () => {
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

  it("a person reaches every palette colour an agent can send", () => {
    const missed: string[] = []
    let next = 0
    const mint = () => doom.nodeId(`m:${String((next += 1))}`)
    for (const [name, fields] of Object.entries(sends))
      for (const field of fields)
        for (const color of agentColors) {
          const writes = compileAgentChange(
            view,
            { op: "set", target: id(name), [field]: color },
            mint,
            placement,
            starts,
          )
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

  it("shows sign roles on existing layers and excludes them from the picker grid", () => {
    const { templateColors } = paletteOf(view, theme)
    const offered = pickerSwatches(templateColors)
    expect(templateColors.filter((swatch) => !offered.includes(swatch)).map((swatch) => swatch.var)).toEqual(
      displayOnly,
    )
  })

  it.each(colorVars)("shows an agent's %s fill by name and renders its actual colour", (role) => {
    const theme = newDeckTheme
    for (const tint of [undefined, 0.2]) {
      const color = tint === undefined ? { var: role } : { var: role, tint }
      const writes = compileAgentChange(
        view,
        { op: "set", target: id("card"), fill: tint === undefined ? role : `${role}+20` },
        () => doom.nodeId("m:1"),
        placement,
        starts,
      )
      if (doom.isRefusal(writes)) throw new Error(writes.refused)
      const after = landed(view, writes)
      const control = nodeModel({ view: after, id: id("card"), theme, slides: [] })
        .sections.flatMap(({ strips }) => strips.flat())
        .find(({ trait, field }) => trait === "fills" && field === "paint")!
      const css = doom.resolveColor(color, theme)
      const baseName =
        Object.entries(neutralColorNames).find(([name]) => name === role)?.[1] ??
        paletteOf(after, theme).templateColors.find((swatch) => swatch.var === role)!.name
      const markup = renderToStaticMarkup(
        createElement(UnionControl, {
          control,
          inner: (props) => createElement(ColorControl, props),
          palette: paletteOf(after, theme),
          onChange: () => {},
        }),
      )
      expect(markup).toContain(`background:${css.toUpperCase()}`)
      expect(markup).toContain(`>${tint === undefined ? baseName : css.slice(1).toUpperCase()}</span>`)
    }
  })

  it("offers a tint written as the theme colour and its tint, so it follows a template color change", () => {
    const templateColors = namedByColor([{ var: "accent1" as const, css: "4472C4" }])
    const [tint] = templateColorColumns(templateColors).flatMap((column) => column.shades)
    expect(tint?.color).toEqual({ var: "accent1", tint: 0.8 })
  })
})

it.each(styles)("gives different colours different names in $name", ({ theme }) => {
  const colors = paletteOf(view, theme).templateColors
  expect(colors).toHaveLength(14)
  expect(pickerSwatches(colors)).toEqual(
    namedByColor(doom.paletteColorVars.map((role) => ({ var: role, css: theme.colors[role].toUpperCase() }))),
  )
  const accent = colors.find(({ var: role }) => role === "accent1")
  const total = colors.find(({ var: role }) => role === "total")
  if (accent?.css === total?.css) expect(total?.name).toBe(accent?.name)
  for (const swatch of colors) {
    expect(colors.filter(({ name }) => name === swatch.name).every(({ css }) => css === swatch.css)).toBe(true)
  }
})
