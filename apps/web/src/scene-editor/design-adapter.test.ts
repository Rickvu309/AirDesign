import { scene } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { panelOfMany, type PanelControl, type PanelModel } from "@/design/panel"
import { changeWrites, type ChangeContext } from "./design-changes"
import { kindOf, nodeModel } from "./design-model"
import { distributeWrites } from "./design-align"
import { fillWrite, shownShadow } from "./design-paint-values"
import { colorRows, idsWithColor, replaceColorWrites } from "./design-selection-colors"
import { oldColorOf, sceneColorOf } from "./design-values"
import { propOf } from "./node-props"
import { hexes } from "./design-adapter-art"
import { grow, landed, spot } from "./scene-fixtures"

const theme = scene.defaultTheme
const words = (chars: string, extra: Partial<scene.Text> = {}): scene.Text => ({
  chars,
  spans: [],
  paras: [{}],
  style: "body",
  resize: "widthAndHeight",
  alignV: "top",
  ...extra,
})

const built = grow([
  { type: "shape", name: "words", props: { box: spot(100, 100, 300, 60), text: words("Hello there") } },
  {
    type: "shape",
    name: "card",
    props: {
      box: spot(100, 300, 200, 100),
      geometry: { kind: "rect" },
      fills: [{ kind: "solid", color: hexes.blue }],
      strokes: [{ kind: "solid", color: { var: "accent2" } }],
      stroke: { weight: 2, align: "inside", dash: "dash" },
      radius: 8,
      opacity: 0.5,
    },
  },
  {
    type: "shape",
    name: "photo",
    props: {
      box: spot(500, 300, 200, 100),
      geometry: { kind: "rect" },
      fills: [{ kind: "image", asset: "a".repeat(64), fit: "fit" }],
    },
  },
  {
    type: "frame",
    name: "panel",
    props: { box: spot(0, 500, 400, 200), fills: [{ kind: "solid", color: { var: "background2" } }] },
    children: [],
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
      strokes: [{ kind: "solid", color: hexes.red }],
      stroke: { weight: 4, align: "center", dash: "solid" },
    },
  },
  {
    type: "shape",
    name: "star",
    props: {
      box: spot(0, 0, 120, 120),
      geometry: { kind: "icon", name: "lucide/star" },
      strokes: [{ kind: "solid", color: { var: "text" } }],
      stroke: { weight: 10, align: "center", dash: "solid" },
    },
  },
])
const { ids, view, geometry } = built
const id = (name: string) => ids[name]!
const size = scene.deckOf(view).size
const slides = [] as readonly scene.NodeId[]

function modelOf(name: string, from = view): PanelModel {
  return nodeModel({ view: from, id: id(name), theme, slides })
}

function find(model: PanelModel, trait: string, field: string): PanelControl {
  const found = model.sections
    .flatMap((section) => section.strips.flat())
    .find((control) => control.trait === trait && control.field === field)
  if (found === undefined) throw new Error(`no ${trait}.${field}`)
  return found
}

function write(names: readonly string[], control: PanelControl, value: unknown, from = view): scene.Scene {
  const context: ChangeContext = { view: from, ids: names.map(id), geometry, size, slides }
  return landed(from, changeWrites(context, control, value))
}

const prop = <K extends scene.PropName>(from: scene.Scene, name: string, key: K) =>
  propOf(from.nodes.get(id(name)), key)

describe("which panel a layer gets", () => {
  it("names the kind from the layer's props", () => {
    expect(kindOf(view, id("words"))).toBe("text")
    expect(kindOf(view, id("card"))).toBe("shape")
    expect(kindOf(view, id("photo"))).toBe("picture")
    expect(kindOf(view, id("star"))).toBe("picture")
    expect(kindOf(view, id("panel"))).toBe("frame")
    expect(kindOf(view, id("rule"))).toBe("connector")
  })
})

describe("colours between Doom and the old panel", () => {
  it("round-trips a hex, a theme colour and a tint", () => {
    for (const color of [
      hexes.blue,
      { var: "accent1" },
      { var: "text2", tint: 0.4 },
      { var: "accent3", tint: -0.25 },
    ] as const)
      expect(sceneColorOf(oldColorOf(color))).toEqual(color)
  })
})

describe("text layer", () => {
  const model = modelOf("words")
  it("reads the old Text section from the layer's text and style", () => {
    const body = theme.textStyles.body
    expect(find(model, "text", "size").value).toBe(body.size * 100)
    expect(find(model, "text", "style").value).toBe("body")
    expect(find(model, "text", "weight").value).toBe("Regular")
    expect(find(model, "text", "align").value).toBe("left")
    expect(find(model, "text", "list").value).toBe("none")
    expect(find(model, "text", "bold").value).toBe(false)
    expect(find(model, "textFill", "value").value).toEqual({ solid: { scheme: "dk1" } })
  })

  it("writes size, weight, toggles, alignment, list, case and colour onto every span", () => {
    const sized = write(["words"], find(model, "text", "size"), 3200)
    expect(prop(sized, "words", "text")?.spans).toEqual([{ end: 11, size: 32 }])
    const bold = write(["words"], find(model, "text", "weight"), "Bold Italic")
    expect(prop(bold, "words", "text")?.spans).toEqual([{ end: 11, bold: true, italic: true }])
    const struck = write(["words"], find(model, "text", "strike"), true)
    expect(prop(struck, "words", "text")?.spans[0]?.strike).toBe(true)
    const centred = write(["words"], find(model, "text", "align"), "center")
    expect(prop(centred, "words", "text")?.paras[0]?.align).toBe("center")
    const listed = write(["words"], find(model, "text", "list"), "bullets")
    expect(prop(listed, "words", "text")?.paras[0]?.list).toBe("bullet")
    expect(
      prop(write(["words"], find(modelOf("words", listed), "text", "list"), "none", listed), "words", "text")?.paras[0]
        ?.list,
    ).toBeUndefined()
    const upper = write(["words"], find(model, "text", "case"), "upper")
    expect(prop(upper, "words", "text")?.spans[0]?.case).toBe("upper")
    const tinted = write(["words"], find(model, "textFill", "value"), { solid: { rgb: "FF0000" } })
    expect(prop(tinted, "words", "text")?.spans[0]?.color).toBe(hexes.red)
  })

  it("writes line height as a multiple and letter spacing in pixels", () => {
    const lined = write(["words"], find(model, "text", "lineHeight"), 150_000)
    expect(prop(lined, "words", "text")?.paras[0]?.lineHeight).toBe(1.5)
    const spaced = write(["words"], find(model, "text", "letterSpacing"), 250)
    expect(prop(spaced, "words", "text")?.spans[0]?.tracking).toBe(2.5)
  })

  it("a text style resets the size and weight a span set", () => {
    const sized = write(["words"], find(model, "text", "size"), 3200)
    const heading = write(["words"], find(modelOf("words", sized), "text", "style"), "heading", sized)
    expect(prop(heading, "words", "text")?.style).toBe("heading")
    expect(prop(heading, "words", "text")?.spans[0]?.size).toBeUndefined()
  })

  it("shows the weight Bold when the style is bold", () => {
    const titled = write(["words"], find(model, "text", "style"), "title")
    expect(find(modelOf("words", titled), "text", "weight").value).toBe(
      theme.textStyles.title.weight >= 600 ? "Bold" : "Regular",
    )
  })
})

describe("shape layer", () => {
  const model = modelOf("card")
  it("reads fill, opacity, corners, border and shadow like the old panel", () => {
    expect(find(model, "fills", "paint").value).toEqual({ solid: { rgb: "336699" } })
    expect(find(model, "opacity", "opacity").value).toBe(50_000)
    expect(find(model, "corners", "corners").value).toBe(8 * 9525)
    expect(find(model, "border", "border").value).toBe("dash")
    expect(find(model, "border", "color").value).toEqual({ scheme: "accent2" })
    expect(find(model, "border", "width").value).toBe(2 * 12_700)
    expect(find(model, "shadow", "shadow").value).toBe("none")
  })

  it("writes the paint, switching between solid, gradient and none", () => {
    const solid = write(["card"], find(model, "fills", "paint"), { solid: { scheme: "accent1" } })
    expect(prop(solid, "card", "fills")).toEqual([{ kind: "solid", color: { var: "accent1" } }])
    const gradient = write(["card"], find(model, "fills", "paint"), {
      gradient: {
        stops: [
          { pos: 0, color: { scheme: "accent1" } },
          { pos: 100_000, color: { rgb: "FFFFFF" } },
        ],
        shade: { linear: { angle: 90 * 60_000, scaled: false } },
        rotateWithShape: true,
      },
    })
    expect(prop(gradient, "card", "fills")).toEqual([
      {
        kind: "gradient",
        shape: "linear",
        angle: 90,
        stops: [
          { at: 0, color: { var: "accent1" } },
          { at: 1, color: hexes.white },
        ],
      },
    ])
    expect(find(modelOf("card", gradient), "fills", "paint").value).toMatchObject({
      gradient: { shade: { linear: { angle: 90 * 60_000 } } },
    })
    expect(prop(write(["card"], find(model, "fills", "paint"), { none: true }), "card", "fills")).toBeUndefined()
  })

  it("writes opacity, corners, border and shadow", () => {
    expect(prop(write(["card"], find(model, "opacity", "opacity"), 25_000), "card", "opacity")).toBe(0.25)
    expect(prop(write(["card"], find(model, "opacity", "opacity"), 100_000), "card", "opacity")).toBeUndefined()
    expect(prop(write(["card"], find(model, "corners", "corners"), 16 * 9525), "card", "radius")).toBe(16)
    expect(prop(write(["card"], find(model, "border", "border"), "none"), "card", "strokes")).toBeUndefined()
    expect(prop(write(["card"], find(model, "border", "border"), "dot"), "card", "stroke")?.dash).toBe("dot")
    expect(prop(write(["card"], find(model, "border", "width"), 6 * 12_700), "card", "stroke")?.weight).toBe(6)
    expect(prop(write(["card"], find(model, "border", "color"), { rgb: "00FF00" }), "card", "strokes")).toEqual([
      { kind: "solid", color: hexes.green },
    ])
    const shadowed = write(["card"], find(model, "shadow", "shadow"), "medium")
    expect(shownShadow(prop(shadowed, "card", "effects")).name).toBe("medium")
    const faded = write(["card"], find(modelOf("card", shadowed), "shadow", "opacity"), 40_000, shadowed)
    expect(shownShadow(prop(faded, "card", "effects"))).toEqual({ name: "medium", opacity: 0.4 })
    expect(
      prop(write(["card"], find(modelOf("card", shadowed), "shadow", "shadow"), "none", shadowed), "card", "effects"),
    ).toBeUndefined()
  })

  it("turning the border on gives a layer with none a visible one", () => {
    const bare = write(["panel"], find(modelOf("panel"), "fills", "paint"), { solid: { rgb: "FFFFFF" } })
    const bordered = write(["panel"], find(modelOf("panel", bare), "border", "border"), "solid", bare)
    expect(prop(bordered, "panel", "strokes")).toEqual([{ kind: "solid", color: { var: "text" } }])
    expect(prop(bordered, "panel", "stroke")?.dash).toBe("solid")
  })

  it("keeps a fill's other layers when it changes the top one", () => {
    const stacked = fillWrite(
      [
        { kind: "solid", color: hexes.grey1 },
        { kind: "solid", color: hexes.grey2 },
      ],
      { solid: { rgb: "333333" } },
    )
    expect(stacked).toEqual([
      { kind: "solid", color: hexes.grey1 },
      { kind: "solid", color: hexes.grey3 },
    ])
  })
})

describe("picture, icon, frame and line", () => {
  it("shows a picture's fit and writes it back on the image fill", () => {
    const model = modelOf("photo")
    expect(find(model, "image", "mode").value).toBe("fit")
    const tiled = write(["photo"], find(model, "image", "mode"), "tile")
    expect(prop(tiled, "photo", "fills")).toEqual([{ kind: "image", asset: "a".repeat(64), fit: "tile" }])
  })

  it("shows an icon's colour and weight and writes them to its stroke", () => {
    const model = modelOf("star")
    expect(find(model, "image", "color").value).toEqual({ scheme: "dk1" })
    expect(find(model, "image", "weight").value).toBe(200)
    const coloured = write(["star"], find(model, "image", "color"), { scheme: "accent1" })
    expect(prop(coloured, "star", "strokes")).toEqual([{ kind: "solid", color: { var: "accent1" } }])
    const heavier = write(["star"], find(model, "image", "weight"), 300)
    expect(prop(heavier, "star", "stroke")?.weight).toBe(15)
  })

  it("shows a frame's fill and corners, and a line's border without a none choice", () => {
    expect(find(modelOf("panel"), "fills", "paint").value).toEqual({ solid: { scheme: "lt2" } })
    expect(find(modelOf("panel"), "corners", "corners").value).toBe(0)
    const line = modelOf("rule")
    expect(find(line, "border", "border").desc).toEqual({ kind: "choice", options: ["solid", "dash", "dot"] })
    expect(find(line, "border", "color").value).toEqual({ rgb: "FF0000" })
    expect(() => find(line, "fills", "paint")).toThrow()
  })
})

describe("several layers", () => {
  it("shows the shared controls, marks differing values mixed and writes every layer", () => {
    const many = panelOfMany([modelOf("card"), modelOf("panel")], "slides")
    expect(many.kind).toBe("many")
    const opacity = find(many, "opacity", "opacity")
    expect(opacity.mixed).toBe(true)
    const next = write(["card", "panel"], opacity, 80_000)
    expect(prop(next, "card", "opacity")).toBe(0.8)
    expect(prop(next, "panel", "opacity")).toBe(0.8)
  })

  it("aligns every selected layer to the selection's edge", () => {
    const many = panelOfMany([modelOf("card"), modelOf("panel")], "slides")
    const aligned = write(["card", "panel"], find(many, "box", "align"), "left")
    expect(prop(aligned, "card", "box")?.x).toBe(prop(aligned, "panel", "box")?.x)
  })
})

describe("selection colours", () => {
  const scope = { slide: built.slides[0]!, ids: [] as readonly scene.NodeId[] }

  it("lists each colour the slide's layers use once, darkest first, with the old panel's colour values", () => {
    const rows = colorRows(view, theme, scope)
    const hexes = rows.map((row) => row.hex)
    expect(new Set(hexes).size).toBe(hexes.length)
    expect(hexes).toContain("336699")
    expect(rows.find((row) => row.hex === "336699")?.color).toEqual({ rgb: "336699" })
    const brightness = (hex: string) =>
      0.2126 * Number.parseInt(hex.slice(0, 2), 16) +
      0.7152 * Number.parseInt(hex.slice(2, 4), 16) +
      0.0722 * Number.parseInt(hex.slice(4, 6), 16)
    expect(hexes.map(brightness)).toEqual([...hexes.map(brightness)].sort((a, b) => a - b))
  })

  it("replaces one colour in fills, strokes and text on every layer that uses it", () => {
    const next = landed(view, replaceColorWrites(view, theme, scope, "336699", { var: "accent3" }))
    expect(prop(next, "card", "fills")).toEqual([{ kind: "solid", color: { var: "accent3" } }])
    expect(prop(next, "card", "strokes")).toEqual(prop(view, "card", "strokes"))
  })

  it("finds the layers that use a colour so the target button can select them", () => {
    expect(idsWithColor(view, theme, scope, "336699")).toEqual([id("card")])
  })

  it("limits the list to the selected layers and what is inside them", () => {
    const only = colorRows(view, theme, { slide: scope.slide, ids: [id("card")] })
    expect(only.map((row) => row.hex)).toContain("336699")
    expect(only.map((row) => row.hex)).not.toContain("FF0000")
  })
})

describe("distribute", () => {
  it("spaces three layers evenly across and writes nothing for two", () => {
    const names = ["card", "photo", "panel"]
    const spaced = landed(view, distributeWrites(view, geometry, names.map(id), "vertical"))
    const tops = names.map((name) => prop(spaced, name, "box")?.y ?? 0).sort((a, b) => a - b)
    const height = (name: string) => prop(spaced, name, "box")?.h ?? 0
    const ordered = names.map((name) => ({ name, y: prop(spaced, name, "box")?.y ?? 0 })).sort((a, b) => a.y - b.y)
    const gap1 = ordered[1]!.y - (ordered[0]!.y + height(ordered[0]!.name))
    const gap2 = ordered[2]!.y - (ordered[1]!.y + height(ordered[1]!.name))
    expect(Math.abs(gap1 - gap2)).toBeLessThan(1)
    expect(tops).toHaveLength(3)
    expect(distributeWrites(view, geometry, [id("photo"), id("card")], "vertical")).toEqual([])
  })
})
