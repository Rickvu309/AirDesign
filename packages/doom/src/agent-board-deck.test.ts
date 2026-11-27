import { describe, expect, it } from "vitest"
import type { AgentChange } from "./agent-change.js"
import { compileAgentEdit } from "./agent-edit.js"
import { board } from "./testing/compiled-board.js"
import { boardDeckChanges } from "./testing/board-deck.js"
import { agentDeck, apply, minter, runName } from "./testing/agent-fixtures.js"
import { type NodeId, applyEdit, isRefusal, rev } from "./index.js"
import { agent, ids } from "./sample-deck.js"
import { childrenOf, descendantsOf, propOf, slidesOf } from "./doom-walk.js"
import { textStyleNames } from "./text.js"
import { placement } from "./testing/placement-rules.js"
import { starts } from "./testing/start-rules.js"
import { testTheme } from "./testing/theme.js"

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

describe.each(["together", "per-slide"] as const)("the board deck brief, sent %s", (mode) => {
  const { doom, batches, slides } = board(mode)

  it("compiles in at most eight batches", () => {
    expect(batches.length).toBeLessThanOrEqual(8)
    expect(slidesOf(doom).map((slide) => slide.id)).toEqual(slides)
    expect(slides).toHaveLength(5)
  })

  it("gives every slide a title and keeps what each slide holds clear of the rest", () => {
    for (const slide of slides) {
      const top = childrenOf(doom, slide)
      expect(top.some((node) => propOf(node, "role") === "title")).toBe(true)
      const boxes = top.map((node) => propOf(node, "box")!)
      for (const box of boxes) {
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.x + box.w).toBeLessThanOrEqual(1920)
        expect(box.y + box.h).toBeLessThanOrEqual(1080)
      }
      for (const [at, box] of boxes.entries())
        for (const other of boxes.slice(at + 1)) if (slide !== ids.slide) expect(overlaps(box, other)).toBe(false)
    }
  })

  it("holds the results grid, a decision card, the chart, three icons and the roadmap grid", () => {
    const names = (slide: NodeId) => childrenOf(doom, slide).map((node) => propOf(node, "name"))
    expect(names(slides[1]!)).toEqual([undefined, "Results", "Decision"])
    expect(names(slides[2]!)).toEqual(
      expect.arrayContaining([
        "Q1 Plan",
        "Q1 Actual",
        "Q2 Plan",
        "Q2 Actual",
        "Q3 Plan",
        "Q3 Actual",
        "Q4 Plan",
        "Q4 Actual",
      ]),
    )
    expect(childrenOf(doom, slides[3]!).filter((node) => propOf(node, "geometry")?.kind === "icon")).toHaveLength(3)
    const roadmap = childrenOf(doom, slides[4]!)[1]!
    expect(propOf(roadmap, "layout")).toMatchObject({ mode: "grid" })
    expect(childrenOf(doom, roadmap.id).filter((node) => propOf(node, "text") !== undefined)).toHaveLength(19)
  })

  it("uses the deck's named text styles and no size of its own anywhere", () => {
    for (const slide of slides)
      for (const node of descendantsOf(doom, slide)) {
        const text = propOf(node, "text")
        if (text === undefined) continue
        expect(textStyleNames).toContain(text.style)
        for (const span of text.spans) {
          expect(Object.keys(span).filter((key) => ["size", "tracking", "case"].includes(key))).toEqual([])
          if (span.font !== undefined) expect(span.font).toBe(testTheme.fonts.body)
        }
      }
  })
})

const onTheScale = () => {
  const withScale = apply(agentDeck(), [{ node: ids.deck, prop: "theme", value: testTheme }])
  return withScale
}

describe("the board deck on the slide type scale", () => {
  const mint = minter("sc")
  let doom = onTheScale()
  const send = (changes: readonly AgentChange[]): readonly NodeId[] => {
    const result = compileAgentEdit(doom, changes, {
      placement,
      starts,
      author: agent(runName),
      once: `scale-${doom.rev}`,
      mint,
    })
    if ("refused" in result) throw new Error(JSON.stringify(result))
    const landed = applyEdit(doom, { ...result.edit, rev: rev(doom.rev + 1) })
    if (isRefusal(landed)) throw new Error(JSON.stringify(landed))
    doom = landed
    return result.added.map((each) => each.id)
  }
  const slides = [ids.slide, ...send(Array.from({ length: 4 }, () => ({ op: "slide", add: {} })))]
  for (const part of boardDeckChanges(slides)) send(part)

  const sizeOf = (node: ReturnType<typeof childrenOf>[number]) => {
    const text = propOf(node, "text")
    return text === undefined ? undefined : testTheme.textStyles[text.style].size
  }
  const sizesOn = (slide: NodeId) => descendantsOf(doom, slide).flatMap((node) => sizeOf(node) ?? [])

  it("writes no text under 24 px on any of the five slides", () => {
    for (const slide of slides) expect(Math.min(...sizesOn(slide))).toBeGreaterThanOrEqual(24)
  })

  it("sets every slide title at 56 px", () => {
    for (const slide of slides.slice(1)) {
      const title = childrenOf(doom, slide).find((node) => propOf(node, "role") === "title")!
      expect(sizeOf(title)).toBe(56)
    }
  })

  it("sets a chart's words, value labels included, at 24 px or more", () => {
    const words = sizesOn(slides[2]!)
    expect(words.length).toBeGreaterThan(0)
    expect(Math.min(...words)).toBeGreaterThanOrEqual(24)
  })
})
