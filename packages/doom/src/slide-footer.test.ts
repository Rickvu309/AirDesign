import { describe, expect, it } from "vitest"
import type { AgentChange } from "./agent-change.js"
import { compileAgentChange } from "./agent-compile.js"
import { agentDeck, build, minter } from "./agent-fixtures.js"
import { readForAgent } from "./agent-read.js"
import { propOf, slidesOf } from "./doom-walk.js"
import { doomFromTree } from "./doom-tree.js"
import { applyEdit, isRefusal, resolveSlide, rev, type Doom, type NodeId } from "./index.js"
import { footerTop, pageOf, resolveFooter } from "./slide-footer.js"
import { ids } from "./sample-deck.js"
import { measure, plainTheme } from "./testing/doom-fixtures-art.js"

const set = (target: string, look: Record<string, unknown>): AgentChange =>
  ({ op: "set", target, ...look }) as AgentChange

function threeSlides(): { readonly doom: Doom; readonly slides: readonly NodeId[] } {
  return doomFromTree({
    theme: plainTheme,
    slides: [
      { children: [], props: { source: "Source: Company filings" } },
      { children: [] },
      { children: [], props: { skipped: true } },
    ],
  })
}

const wordsOf = (parts: ReturnType<typeof resolveFooter>, part: "source" | "number") =>
  parts
    .find((each) => each.part === part)
    ?.lines.flatMap((line) => line.runs.map((run) => run.text))
    .join("")

describe("the slide footer", () => {
  it("paints the source and the slide's place in the deck, after the content and outside the layers", () => {
    const { doom, slides } = threeSlides()
    const first = resolveFooter(doom, slides[0]!, measure)
    expect(wordsOf(first, "source")).toBe("Source: Company filings")
    expect(wordsOf(first, "number")).toBe("1")
    expect(first.every((part) => part.box.y >= footerTop(1080))).toBe(true)
    expect(resolveSlide(doom, slides[0]!, measure)).toEqual([])
    expect(doom.children.get(slides[0]!) ?? []).toEqual([])
  })

  it("paints only the page number while the source is empty, and numbers a skipped slide by its place", () => {
    const { doom, slides } = threeSlides()
    const second = resolveFooter(doom, slides[1]!, measure)
    expect(second.map((each) => each.part)).toEqual(["number"])
    expect(wordsOf(resolveFooter(doom, slides[2]!, measure), "number")).toBe("3")
  })

  it("renumbers every slide when one moves, with no write to any number", () => {
    const { doom, slides } = threeSlides()
    const [first, second, third] = slides as [NodeId, NodeId, NodeId]
    const firstAt = propOf(doom.nodes.get(first), "parent")!
    const thirdAt = propOf(doom.nodes.get(third), "parent")!
    const moved = applyEdit(doom, {
      once: "move",
      author: { kind: "person", id: "p" },
      writes: [{ node: first, prop: "parent", value: { id: firstAt.id, at: `${thirdAt.at}V` } }],
      rev: rev(doom.rev + 1),
    })
    if (isRefusal(moved)) throw new Error(JSON.stringify(moved))
    expect(slidesOf(moved).map((slide) => slide.id)).toEqual([second, third, first])
    expect([first, second, third].map((slide) => pageOf(moved, slide))).toEqual([3, 1, 2])
    expect(wordsOf(resolveFooter(moved, first, measure), "number")).toBe("3")
  })
})

describe("an agent's source line", () => {
  it("sets the source on a slide, reads it back with the page number, and clears it with empty words", () => {
    const doom = build(agentDeck(), set(ids.slide, { source: "Source: Team analysis" }))
    expect(propOf(doom.nodes.get(ids.slide), "source")).toBe("Source: Team analysis")
    const line = readForAgent(doom, [ids.slide]).split("\n")[0]
    expect(line).toContain('source="Source: Team analysis"')
    expect(line).toContain("page=1")
    const cleared = build(doom, set(ids.slide, { source: "" }))
    expect(readForAgent(cleared, [ids.slide]).split("\n")[0]).not.toContain("source=")
  })

  it("refuses a source on a layer, as the footer belongs to the slide", () => {
    expect(compileAgentChange(agentDeck(), set(ids.card, { source: "x" }), minter())).toMatchObject({
      refused: "shape",
      field: "source",
    })
  })
})
