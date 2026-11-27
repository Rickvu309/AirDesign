import * as doom from "@airdesign/doom"
import { compileIntent, starts, testTheme } from "@airdesign/doom/testing"
import { describe, expect, it } from "vitest"
import { nodeModel } from "./design-model"
import { shownText } from "./design-text-values"
import { hexes } from "./testing/design-adapter-art"
import { grow, landed, spot } from "./testing/doom-fixtures"
import { placement } from "@airdesign/doom/testing"

const words: doom.Text = {
  chars: "Quarterly review",
  spans: [],
  paras: [{}],
  style: "body",
  resize: "widthAndHeight",
  alignV: "top",
}
const built = grow([{ type: "shape", name: "words", props: { box: spot(100, 100, 600, 80), text: words } }])
const title = built.ids.words!
let minted = 0
const mint = () => doom.nodeId(`m:${String((minted += 1))}`)

function agentLands(change: doom.Intent, view: doom.Doom = built.view): doom.Doom {
  const writes = compileIntent(view, change, mint, placement, starts)
  if (doom.isRefusal(writes)) throw new Error(`refused ${JSON.stringify(writes)}`)
  return landed(view, writes)
}

describe("a person keeps no font or theme field, and an agent keeps all of them", () => {
  it("shows the text section with a style and a weight, and no font control", () => {
    const model = nodeModel({ view: built.view, id: title, theme: testTheme, slides: [built.slides[0]!] })
    const fields = model.sections.flatMap((section) => section.strips.flat()).map((control) => control.field)
    expect(fields).toContain("style")
    expect(fields).toContain("weight")
    expect(fields).not.toContain("font")
  })

  it("lets an agent set a font on a layer, and the panel and painter read it back", () => {
    const after = agentLands({ op: "update", target: title, font: "Georgia" } as doom.Intent)
    const text = doom.propOf(after.nodes.get(title), "text")!
    expect(text.spans.map((span) => span.font)).toEqual(["Georgia"])
    expect(shownText(text, doom.deckOf(after).theme).look.font).toEqual({ value: "Georgia", mixed: false })
  })

  it("lets an agent set any theme colour and the heading and body fonts, keeping the rest of the theme", () => {
    const before = doom.deckOf(built.view).theme
    const after = doom.deckOf(
      agentLands({
        op: "variables",
        colors: { accent1: hexes.red, text2: hexes.navy },
        fonts: { heading: "Lora", body: "Inter" },
      } as doom.Intent),
    ).theme
    expect(after.colors).toEqual({ ...before.colors, accent1: hexes.red, text2: hexes.navy })
    expect(after.fonts).toEqual({ heading: "Lora", body: "Inter" })
    expect(after.textStyles).toEqual(before.textStyles)
  })

  it("keeps a saved layer font painting as it did", () => {
    const saved = grow([
      {
        type: "shape",
        name: "words",
        props: { box: spot(100, 100, 600, 80), text: { ...words, spans: [{ end: 16, font: "Georgia" }] } },
      },
    ])
    const text = doom.propOf(saved.view.nodes.get(saved.ids.words!), "text")!
    expect(shownText(text, testTheme).look.font.value).toBe("Georgia")
  })
})
