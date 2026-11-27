import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import type { PanelControl, PanelModel } from "@/design/panel"
import { propOf } from "@airdesign/doom"
import { changeWrites, type ChangeContext } from "./design-changes"
import { nodeModel } from "./design-model"
import { shownText } from "./design-text-values"
import { geometryOf } from "@/editing/slide-geometry"
import { testTheme } from "@airdesign/doom/testing"

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
  const grown = doom.doomFromTree({ theme: testTheme, slides: [{ children }] })
  const measure = doom.measureWith({})
  const geometry = geometryOf(doom.resolveSlide(grown.doom, grown.slides[0]!, measure))
  return { ...grown, view: grown.doom, geometry }
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

const theme = testTheme
const words = (chars: string): doom.Text => ({
  chars,
  spans: [],
  paras: [{}],
  style: "body",
  resize: "widthAndHeight",
  alignV: "top",
})

const built = grow([
  { type: "shape", name: "words", props: { box: spot(100, 100, 300, 60), text: words("Hello there") } },
])
const { ids, view, geometry } = built
const id = ids.words!
const size = doom.deckOf(view).size
const slides = [] as readonly doom.NodeId[]

function modelOf(from = view, shown = theme): PanelModel {
  return nodeModel({ view: from, id, theme: shown, slides })
}

function find(model: PanelModel, field: string): PanelControl {
  const found = model.sections
    .flatMap((section) => section.strips.flat())
    .find((control) => control.trait === "text" && control.field === field)
  if (found === undefined) throw new Error(`no text.${field}`)
  return found
}

function write(control: PanelControl, value: unknown, from = view): doom.Doom {
  const context: ChangeContext = { view: from, ids: [id], geometry, size, slides }
  return landed(from, changeWrites(context, control, value))
}

const textOf = (from: doom.Doom) => propOf(from.nodes.get(id), "text")

describe("named font weights", () => {
  const model = modelOf()

  it("shows the weight Bold when the style is bold", () => {
    const titled = write(find(model, "style"), "title")
    expect(find(modelOf(titled), "weight").value).toBe("Bold")
    expect(find(modelOf(titled), "bold").value).toBe(true)
  })

  it("names a style weight of 600 on a plain family Bold, as the canvas paints it, and lists the weights a font has", () => {
    const headed = write(find(model, "style"), "heading")
    const weight = find(modelOf(headed), "weight")
    expect(weight.value).toBe("Bold")
    expect(find(modelOf(headed), "bold").value).toBe(true)
    expect(weight.choices?.map((choice) => choice.value)).toEqual(
      expect.arrayContaining(["Regular", "Medium", "SemiBold", "Bold", "Black"]),
    )
  })

  it("shows a theme font's family and carries its named weight", () => {
    const semibold = { ...theme, fonts: { heading: "Inter SemiBold", body: "Inter" } }
    const titled = write(find(model, "style"), "title")
    const shown = modelOf(titled, semibold)
    expect(shownText(textOf(titled)!, semibold).look.font.value).toBe("Inter")
    expect(find(shown, "weight").value).toBe("SemiBold")
  })

  it("stores a named weight as that face and keeps Bold as the bold flag", () => {
    const semi = write(find(model, "weight"), "SemiBold")
    expect(textOf(semi)?.spans).toEqual([{ end: 11, font: "Inter SemiBold", bold: false, italic: false }])
    expect(find(modelOf(semi), "weight").value).toBe("SemiBold")
    expect(shownText(textOf(semi)!, theme).look.font.value).toBe("Inter")
    const bolded = write(find(modelOf(semi), "bold"), true, semi)
    expect(textOf(bolded)?.spans).toEqual([{ end: 11, font: "Inter SemiBold", bold: true, italic: false }])
    expect(find(modelOf(bolded), "weight").value).toBe("Bold")
    const back = write(find(modelOf(bolded), "bold"), false, bolded)
    expect(textOf(back)?.spans).toEqual([{ end: 11, font: "Inter SemiBold", bold: false, italic: false }])
    expect(find(modelOf(back), "weight").value).toBe("SemiBold")
  })
})
