import { describe, expect, it } from "vitest"
import { compileAgentChange } from "./agent-compile.js"
import { agentDeck, build, lastChild, minter } from "./agent-fixtures.js"
import { childrenOf, propOf } from "./doom-walk.js"
import type { TreeNode } from "./doom-tree.js"
import type { Doom } from "./doom.js"
import { measureWith } from "./measure.js"
import type { Resolved } from "./resolved.js"
import { resolveSlide } from "./resolve-slide.js"
import { ids } from "./sample-deck.js"
import { themeLibrary } from "./theme.js"

const upright = { rotation: 0, flipH: false, flipV: false }
const words = (chars: string, style: "title" | "body", color: "text" | "text2") => ({
  chars,
  spans: [{ end: chars.length, color: { var: color } }],
  paras: [{}],
  style,
  resize: "fixed",
  alignV: "top",
})

const piece: TreeNode = {
  type: "frame",
  name: "Badge",
  props: {
    box: { x: 0, y: 0, w: 800, h: 240, ...upright },
    fills: [{ kind: "solid", color: { var: "accent1" } }],
  } as never,
  children: [
    {
      type: "shape",
      name: "Title",
      props: { box: { x: 40, y: 40, w: 720, h: 80, ...upright }, text: words("Title", "title", "text") } as never,
    },
    {
      type: "shape",
      name: "Subtitle",
      props: { box: { x: 40, y: 140, w: 720, h: 60, ...upright }, text: words("Subtitle", "body", "text2") } as never,
    },
  ],
}

function pasted(theme: "midnight" | "consulting"): { readonly doom: Doom; readonly root: string } {
  const themed = build(agentDeck(), { op: "deck", theme })
  const doom = build(themed, { op: "paste", piece, into: ids.slide, box: { x: 300, y: 200 } })
  return { doom, root: lastChild(doom, ids.slide).id }
}

const flat = (all: readonly Resolved[]): readonly Resolved[] => all.flatMap((each) => [each, ...flat(each.children)])
const runsOf = (each: Resolved | undefined) => each?.text?.lines.flatMap((line) => line.runs) ?? []

describe("paste copies a kit piece onto a slide as plain layers bound to the deck's theme", () => {
  it("takes each theme's colours and fonts", () => {
    for (const name of ["midnight", "consulting"] as const) {
      const { doom, root } = pasted(name)
      const { colors, fonts } = themeLibrary[name]!.theme
      const painted = flat(resolveSlide(doom, ids.slide, measureWith({})))
      const frame = painted.find((each) => each.id === root)
      const [title, subtitle] = childrenOf(doom, root as never).map((child) =>
        painted.find((each) => each.id === child.id),
      )
      expect(frame?.fills[0]).toMatchObject({ kind: "solid", color: colors.accent1 })
      expect(runsOf(title)[0]).toMatchObject({ text: "Title", font: fonts.heading, color: colors.text })
      expect(runsOf(subtitle)[0]).toMatchObject({ text: "Subtitle", font: fonts.body, color: colors.text2 })
    }
  })

  it("places the piece at the box, keeps its own size unless the box gives one, and keeps its layer names", () => {
    const { doom, root } = pasted("midnight")
    expect(propOf(doom.nodes.get(root as never), "box")).toMatchObject({ x: 300, y: 200, w: 800, h: 240 })
    expect(childrenOf(doom, root as never).map((child) => propOf(child, "name"))).toEqual(["Title", "Subtitle"])
    const wide = build(agentDeck(), { op: "paste", piece, into: ids.slide, box: { x: 0, y: 0, w: 1200, h: 300 } })
    expect(propOf(lastChild(wide, ids.slide), "box")).toMatchObject({ w: 1200, h: 300 })
  })

  it("holds no link back to the piece", () => {
    const before = JSON.stringify(piece)
    const { doom, root } = pasted("midnight")
    const copied = [doom.nodes.get(root as never)!, ...childrenOf(doom, root as never)]
    for (const node of copied) {
      expect(Object.keys(node)).not.toContain("origin")
    }
    const title = childrenOf(doom, root as never)[0]!
    build(doom, { op: "set", target: title.id, text: "Changed" })
    expect(JSON.stringify(piece)).toBe(before)
  })

  it("refuses a parent that is not a slide or a frame, and a piece that does not grow", () => {
    expect(compileAgentChange(agentDeck(), { op: "paste", piece, into: ids.deck }, minter())).toMatchObject({
      refused: "shape",
      field: "into",
    })
    const broken = { ...piece, props: { box: "wide" } } as unknown as TreeNode
    expect(compileAgentChange(agentDeck(), { op: "paste", piece: broken, into: ids.slide }, minter())).toMatchObject({
      refused: "shape",
      field: "piece",
    })
  })
})
