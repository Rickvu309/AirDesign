import { describe, expect, it } from "vitest"
import { compileIntent } from "./intent-compile.js"
import { agentDeck, build, lastChild, minter } from "./testing/agent-fixtures.js"
import { childrenOf, propOf } from "./doom-walk.js"
import type { TreeNode } from "./doom-tree.js"
import type { Doom } from "./doom.js"
import { measureWith } from "./measure.js"
import type { Resolved } from "./resolved.js"
import { resolveSlide } from "./resolve-slide.js"
import { hex, ids } from "./sample-deck.js"
import { type Theme } from "./theme.js"
import { placement } from "./testing/placement-rules.js"
import { starts } from "./testing/start-rules.js"
import { testTheme } from "./testing/theme.js"

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

const customTheme: Theme = {
  ...testTheme,
  colors: { ...testTheme.colors, accent1: hex(0x155d94), text: hex(0x14293a), text2: hex(0x495d69) },
  fonts: { heading: "Lora", body: "Source Sans 3" },
}

function pasted(theme: Theme): { readonly doom: Doom; readonly root: string } {
  const themed = build(agentDeck(), { op: "deck", theme })
  const doom = build(themed, { op: "paste", piece, into: ids.slide, box: { x: 300, y: 200 } })
  return { doom, root: lastChild(doom, ids.slide).id }
}

const flat = (all: readonly Resolved[]): readonly Resolved[] => all.flatMap((each) => [each, ...flat(each.children)])
const runsOf = (each: Resolved | undefined) => each?.text?.lines.flatMap((line) => line.runs) ?? []

describe("paste copies a kit piece onto a slide as plain layers bound to the deck's theme", () => {
  it("takes each theme's colours and fonts", () => {
    for (const theme of [testTheme, customTheme]) {
      const { doom, root } = pasted(theme)
      const { colors, fonts } = theme
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
    const { doom, root } = pasted(customTheme)
    expect(propOf(doom.nodes.get(root as never), "box")).toMatchObject({ x: 300, y: 200, w: 800, h: 240 })
    expect(childrenOf(doom, root as never).map((child) => propOf(child, "name"))).toEqual(["Title", "Subtitle"])
    const wide = build(agentDeck(), { op: "paste", piece, into: ids.slide, box: { x: 0, y: 0, w: 1200, h: 300 } })
    expect(propOf(lastChild(wide, ids.slide), "box")).toMatchObject({ w: 1200, h: 300 })
  })

  it("holds no link back to the piece", () => {
    const before = JSON.stringify(piece)
    const { doom, root } = pasted(customTheme)
    const copied = [doom.nodes.get(root as never)!, ...childrenOf(doom, root as never)]
    for (const node of copied) {
      expect(Object.keys(node)).not.toContain("origin")
    }
    const title = childrenOf(doom, root as never)[0]!
    build(doom, { op: "set", target: title.id, text: "Changed" })
    expect(JSON.stringify(piece)).toBe(before)
  })

  it("refuses a parent that is not a slide or a frame, and a piece that does not grow", () => {
    expect(
      compileIntent(agentDeck(), { op: "paste", piece, into: ids.deck }, minter(), placement, starts),
    ).toMatchObject({
      refused: "shape",
      field: "into",
    })
    const broken = { ...piece, props: { box: "wide" } } as unknown as TreeNode
    expect(
      compileIntent(agentDeck(), { op: "paste", piece: broken, into: ids.slide }, minter(), placement, starts),
    ).toMatchObject({
      refused: "shape",
      field: "piece",
    })
  })
})
