import { linkedOwner } from "./component/instance-ownership.js"
import { describe, expect, it } from "vitest"
import { bytesOf } from "./limits.js"
import type { AgentChange } from "./agent-change.js"
import { compileAgentEdit } from "./agent-edit.js"
import { boardDeckChanges } from "./board-deck.js"
import { agentDeck, apply, minter, runName } from "./agent-fixtures.js"
import { defaultTheme } from "./theme.js"
import { readForAgent } from "./agent-read.js"
import { type NodeId, applyEdit, isRefusal, rev } from "./index.js"
import { agent, ids } from "./sample-deck.js"
import { childrenOf, descendantsOf, propOf, slidesOf } from "./doom-walk.js"
import { textStyleNames } from "./text.js"

function board(mode: "together" | "per-slide") {
  const mint = minter("b")
  let doom = agentDeck()
  const batches: (readonly AgentChange[])[] = []
  const send = (changes: readonly AgentChange[]): readonly NodeId[] => {
    batches.push(changes)
    const result = compileAgentEdit(doom, changes, { author: agent(runName), once: `board-${batches.length}`, mint })
    if ("refused" in result) throw new Error(`batch ${batches.length}: ${JSON.stringify(result)}`)
    const landed = applyEdit(doom, { ...result.edit, rev: rev(doom.rev + 1) })
    if (isRefusal(landed)) throw new Error(JSON.stringify(landed))
    doom = landed
    return result.added.map((each) => each.id)
  }
  const added = send(Array.from({ length: 4 }, () => ({ op: "slide", add: {} })))
  const slides = [ids.slide, ...added]
  const parts = boardDeckChanges(slides)
  if (mode === "together") send(parts.flat())
  else for (const part of parts) send(part)
  return { doom, batches, slides }
}

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
    expect(
      childrenOf(doom, slides[2]!).some((node) => propOf(node, "instance")?.component.id === "clustered-chart"),
    ).toBe(true)
    expect(childrenOf(doom, slides[3]!).filter((node) => propOf(node, "geometry")?.kind === "icon")).toHaveLength(3)
    const roadmap = childrenOf(doom, slides[4]!)[1]!
    expect(propOf(roadmap, "layout")).toMatchObject({ mode: "grid" })
    expect(childrenOf(doom, roadmap.id).filter((node) => propOf(node, "text") !== undefined)).toHaveLength(19)
  })

  it("uses the deck's named text styles and no size of its own anywhere", () => {
    for (const slide of slides)
      for (const node of descendantsOf(doom, slide)) {
        if (linkedOwner(doom.nodes, node.id) !== undefined) continue
        const text = propOf(node, "text")
        if (text === undefined) continue
        expect(textStyleNames).toContain(text.style)
        for (const span of text.spans) {
          expect(Object.keys(span).filter((key) => ["size", "tracking", "case"].includes(key))).toEqual([])
          if (span.font !== undefined) expect(span.font).toBe(defaultTheme.fonts.body)
        }
      }
  })

  it("reads back in under 3,000 tokens, every node on a line of its own", () => {
    const read = readForAgent(doom, "all")
    expect(Math.ceil(bytesOf(read) / 4)).toBeLessThan(3_000)
    const count = slides.reduce((sum, slide) => sum + 1 + descendantsOf(doom, slide).length, 0)
    expect(read.split("\n")).toHaveLength(count)
  })
})

const onTheScale = () => {
  const withScale = apply(agentDeck(), [{ node: ids.deck, prop: "theme", value: defaultTheme }])
  return withScale
}

describe("the board deck on the slide type scale", () => {
  const mint = minter("sc")
  let doom = onTheScale()
  const send = (changes: readonly AgentChange[]): readonly NodeId[] => {
    const result = compileAgentEdit(doom, changes, { author: agent(runName), once: `scale-${doom.rev}`, mint })
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
    return text === undefined ? undefined : defaultTheme.textStyles[text.style].size
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
    const chart = childrenOf(doom, slides[2]!).find((node) => propOf(node, "instance") !== undefined)!
    const words = descendantsOf(doom, chart.id).flatMap(
      (part) => propOf(part, "text")?.spans.flatMap((span) => span.size ?? []) ?? [],
    )
    expect(words.length).toBeGreaterThan(0)
    expect(Math.min(...words)).toBeGreaterThanOrEqual(24)
  })
})
