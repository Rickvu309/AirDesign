import * as doom from "@airdesign/doom"
import { propOf } from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { borderCopy } from "@/copy/border-copy"
import { optionWord } from "@/copy/option-copy"
import type { PanelControl, PanelModel } from "@/design/panel"
import { changeWrites, type ChangeContext } from "./design-changes"
import { nodeModel } from "./design-model"
import { geometryOf } from "./slide-geometry"

const spot = (x: number, y: number, w: number, h: number) => ({
  x,
  y,
  w,
  h,
  rotation: 0,
  flipH: false,
  flipV: false,
})

function grow(children: readonly doom.TreeNode[]) {
  const grown = doom.doomFromTree({ theme: doom.defaultTheme, slides: [{ children }] })
  const measure = doom.measureWith({})
  const geometry = geometryOf(doom.resolveSlide(grown.doom, grown.slides[0]!, measure))
  return { ...grown, view: grown.doom, geometry, measure }
}

function landed(view: doom.Doom, writes: readonly doom.Write[]): doom.Doom {
  const next = doom.applyEdit(view, {
    once: `test-${String(view.rev + 1)}`,
    author: { kind: "person", id: "test" },
    writes: writes.map((write) => {
      const was = view.revs.get(write.node)?.get(write.prop)
      return was === undefined ? write : { ...write, base: was }
    }),
    rev: doom.rev(view.rev + 1),
  })
  if (doom.isRefusal(next)) throw new Error(`refused ${JSON.stringify(next)}`)
  return next
}

const line = {
  kind: "line" as const,
  start: { x: 0, y: 0 },
  end: { x: 200, y: 0 },
  route: "straight" as const,
  arrows: ["none", "arrow"] as const,
}

const built = grow([
  {
    type: "shape",
    name: "rule",
    props: {
      box: spot(100, 100, 200, 0),
      geometry: line,
      strokes: [{ kind: "solid", color: { var: "text2" } }],
      stroke: { weight: 4, align: "center", dash: "solid" },
    },
  },
  {
    type: "shape",
    name: "card",
    props: { box: spot(400, 100, 200, 100), geometry: { kind: "rect" } },
  },
])
const { ids, view, geometry } = built
const id = (name: string) => ids[name]!
const size = doom.deckOf(view).size
const slides = [] as readonly doom.NodeId[]

const modelOf = (name: string): PanelModel => nodeModel({ view, id: id(name), theme: doom.deckOf(view).theme, slides })

function find(model: PanelModel, field: string): PanelControl {
  const found = model.sections
    .flatMap((section) => section.strips.flat())
    .find((control) => control.trait === "border" && control.field === field)
  if (found === undefined) throw new Error(`no border.${field}`)
  return found
}

function written(control: PanelControl, value: unknown): doom.Geometry | undefined {
  const context: ChangeContext = { view, ids: [id("rule")], geometry, size, slides }
  const next = landed(view, changeWrites(context, control, value))
  return propOf(next.nodes.get(id("rule")), "geometry")
}

describe("a line's arrowheads", () => {
  it("names the four arrowheads in plain words", () => {
    expect(optionWord("start", "none")).toBe("None")
    expect(optionWord("end", "arrow")).toBe("Open")
    expect(optionWord("start", "triangle")).toBe("Triangle")
    expect(optionWord("end", "circle")).toBe("Circle")
  })

  it("shows the start and the end on a line, writes one without the other, and a rectangle has neither", () => {
    const model = modelOf("rule")
    const start = find(model, "start")
    const end = find(model, "end")
    expect(start.label).toBe(borderCopy.head)
    expect(end.label).toBe(borderCopy.tail)
    expect(start.desc).toEqual({ kind: "choice", options: ["none", "arrow", "triangle", "circle"] })
    expect(end.desc).toEqual(start.desc)
    expect(start.value).toBe("none")
    expect(end.value).toBe("arrow")
    expect(start.look.form).toBe("list")
    expect(end.look.form).toBe("list")
    expect(written(end, "triangle")).toMatchObject({ arrows: ["none", "triangle"] })
    expect(written(start, "circle")).toMatchObject({ arrows: ["circle", "arrow"] })
    expect(written(end, "stealth")).toMatchObject({ arrows: ["none", "arrow"] })
    expect(() => find(modelOf("card"), "start")).toThrow(/no border.start/)
    expect(() => find(modelOf("card"), "end")).toThrow(/no border.end/)
  })
})
