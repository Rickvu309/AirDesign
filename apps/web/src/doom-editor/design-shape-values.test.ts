import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import type { PanelControl, PanelModel } from "@/design/panel"
import { propOf } from "@/editing/node-props"
import { grow, landed, spot } from "@/testing/doom-fixtures"
import { changeWrites, type ChangeContext } from "./design-changes"
import { nodeModel } from "./design-model"

const built = grow([
  {
    type: "shape",
    name: "card",
    props: {
      box: spot(100, 100, 200, 100),
      geometry: { kind: "rect" },
      fills: [{ kind: "solid", color: { var: "accent1" } }],
    },
  },
  {
    type: "shape",
    name: "badge",
    props: {
      box: spot(700, 100, 200, 200),
      geometry: { kind: "preset", name: "star5", adjust: [30_000] },
      fills: [{ kind: "solid", color: { var: "accent1" } }],
    },
  },
])
const { ids, view, geometry } = built
const id = (name: string) => ids[name]!
const size = doom.deckOf(view).size
const slides = [] as readonly doom.NodeId[]

const modelOf = (name: string, from = view): PanelModel =>
  nodeModel({ view: from, id: id(name), theme: doom.deckOf(from).theme, slides })

function find(model: PanelModel, trait: string, field: string): PanelControl {
  const found = model.sections
    .flatMap((section) => section.strips.flat())
    .find((control) => control.trait === trait && control.field === field)
  if (found === undefined) throw new Error(`no ${trait}.${field}`)
  return found
}

function write(names: readonly string[], control: PanelControl, value: unknown, from = view): doom.Doom {
  const context: ChangeContext = { view: from, ids: names.map(id), geometry, size, slides }
  return landed(from, changeWrites(context, control, value))
}

const prop = <K extends doom.PropName>(from: doom.Doom, name: string, key: K) => propOf(from.nodes.get(id(name)), key)

describe("the Shape section", () => {
  it("shows a drawn preset and its named adjust values, the ones it holds and the defaults it does not", () => {
    const model = modelOf("badge")
    expect(find(model, "geometry", "preset").value).toBe("star5")
    expect(find(model, "geometry", "preset").desc).toEqual({ kind: "choice", options: doom.shapeNames })
    expect(find(model, "geometry", "adjust").value).toEqual({ ...doom.adjustDefaults("star5"), adj: 30_000 })
    expect(() => find(modelOf("card"), "geometry", "adjust")).toThrow()
  })

  it("writes the shape it shows: a rectangle, an ellipse or a preset, and keeps the adjust values in the preset's order", () => {
    const preset = find(modelOf("badge"), "geometry", "preset")
    expect(prop(write(["badge"], preset, "ellipse"), "badge", "geometry")).toEqual({ kind: "ellipse" })
    expect(prop(write(["card"], find(modelOf("card"), "geometry", "preset"), "triangle"), "card", "geometry")).toEqual({
      kind: "preset",
      name: "triangle",
    })
    const { hf, vf } = doom.adjustDefaults("star5")
    expect(
      prop(write(["badge"], find(modelOf("badge"), "geometry", "adjust"), { adj: 19_000 }), "badge", "geometry"),
    ).toEqual({ kind: "preset", name: "star5", adjust: [19_000, hf, vf] })
  })

  it("offers only outlines Doom draws, never a connector", () => {
    expect(doom.shapeNames).not.toContain("line")
    expect(doom.shapeNames.some((name) => /^(bent|curved|straight)Connector/.test(name))).toBe(false)
  })
})
