import { describe, expect, it } from "vitest"
import { bytesOf } from "../limits.js"
import type { AgentChange } from "./agent-change.js"
import { compileAgentEdit } from "./agent-edit.js"
import { boardDeckChanges } from "./board-deck.js"
import { agentDeck, apply, minter, runName } from "./agent-fixtures.js"
import { defaultTheme } from "./default-theme-art.js"
import { deriveChart } from "./derive-chart.js"
import { measure } from "./doom-fixtures-art.js"
import { readForAgent } from "./agent-read.js"
import { type NodeId, applyEdit, isRefusal, rev } from "./index.js"
import { agent, ids } from "./sample-deck.js"
import { childrenOf, descendantsOf, get, slidesOf } from "./doom-walk.js"
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
      expect(top.some((node) => get(node, "role") === "title")).toBe(true)
      const boxes = top.map((node) => get(node, "box")!)
      for (const box of boxes) {
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.x + box.w).toBeLessThanOrEqual(1920)
        expect(box.y + box.h).toBeLessThanOrEqual(1080)
      }
      for (const [at, box] of boxes.entries())
        for (const other of boxes.slice(at + 1)) if (slide !== ids.slide) expect(overlaps(box, other)).toBe(false)
    }
  })

  it("holds the KPI row with a decision card under it, the chart, three icon cards and the roadmap grid", () => {
    const names = (slide: NodeId) => childrenOf(doom, slide).map((node) => get(node, "name"))
    expect(names(slides[1]!)).toEqual([undefined, "KPI", "Decision"])
    expect(childrenOf(doom, slides[2]!).some((node) => get(node, "chart")?.kind === "bar")).toBe(true)
    const priorities = childrenOf(doom, slides[3]!)[1]!
    expect(descendantsOf(doom, priorities.id).filter((node) => get(node, "geometry")?.kind === "icon")).toHaveLength(3)
    const roadmap = childrenOf(doom, slides[4]!)[1]!
    expect(get(roadmap, "layout")).toMatchObject({ mode: "grid" })
    expect(childrenOf(doom, roadmap.id)).toHaveLength(19)
  })

  it("fills most of the room with the KPI row and keeps the decision card under it, inside the slide", () => {
    const [, row, decision] = childrenOf(doom, slides[1]!).map((node) => get(node, "box")!)
    expect(row!.h).toBeGreaterThanOrEqual(0.55 * (1000 - row!.y))
    expect(decision!.y).toBeGreaterThanOrEqual(row!.y + row!.h)
    expect(decision!.y + decision!.h).toBeLessThanOrEqual(1000)
  })

  it("uses the deck's named text styles and no size of its own anywhere", () => {
    for (const slide of slides)
      for (const node of descendantsOf(doom, slide)) {
        const text = get(node, "text")
        if (text === undefined) continue
        expect(textStyleNames).toContain(text.style)
        for (const span of text.spans)
          expect(Object.keys(span).filter((key) => ["size", "font", "tracking", "case"].includes(key))).toEqual([])
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
    const text = get(node, "text")
    return text === undefined ? undefined : defaultTheme.textStyles[text.style].size
  }
  const sizesOn = (slide: NodeId) => descendantsOf(doom, slide).flatMap((node) => sizeOf(node) ?? [])

  it("writes no text under 24 px on any of the five slides", () => {
    for (const slide of slides) expect(Math.min(...sizesOn(slide))).toBeGreaterThanOrEqual(24)
  })

  it("sets every slide title at 88 px", () => {
    for (const slide of slides.slice(1)) {
      const title = childrenOf(doom, slide).find((node) => get(node, "role") === "title")!
      expect(sizeOf(title)).toBeGreaterThanOrEqual(88)
    }
  })

  it("sets a KPI as a number of 128 px or more over a label and a note of 28 px or more", () => {
    const row = childrenOf(doom, slides[1]!).find((node) => get(node, "name") === "KPI")!
    for (const card of childrenOf(doom, row.id)) {
      const [label, number, note] = childrenOf(doom, card.id).map((node) => sizeOf(node)!)
      expect(number).toBeGreaterThanOrEqual(128)
      expect(label).toBeGreaterThanOrEqual(28)
      expect(note).toBeGreaterThanOrEqual(28)
    }
  })

  it("sets card bullets, the decision card and the roadmap cells at 32 px or more", () => {
    for (const slide of [slides[1]!, slides[3]!, slides[4]!]) {
      const rest = childrenOf(doom, slide).filter(
        (node) => get(node, "role") !== "title" && get(node, "name") !== "KPI",
      )
      for (const frame of rest)
        for (const node of descendantsOf(doom, frame.id)) expect(sizeOf(node) ?? 32).toBeGreaterThanOrEqual(32)
    }
  })

  it("keeps the decision card under the KPIs at the slide type scale, inside the slide", () => {
    const decision = childrenOf(doom, slides[1]!).find((node) => get(node, "name") === "Decision")!
    const card = childrenOf(doom, decision.id)[0]!
    const [heading, points] = childrenOf(doom, card.id).map((node) => sizeOf(node)!)
    expect(heading).toBe(64)
    expect(points).toBe(48)
    const box = get(decision, "box")!
    expect(box.y + box.h).toBeLessThanOrEqual(1000)
  })

  it("sets a chart's words, value labels included, at 24 px or more", () => {
    const chart = childrenOf(doom, slides[2]!).find((node) => get(node, "chart") !== undefined)!
    const words = deriveChart(chart.id, get(chart, "chart")!, get(chart, "box")!, defaultTheme, measure).flatMap(
      (part) => part.text?.lines.flatMap((line) => line.runs.map((run) => run.size)) ?? [],
    )
    expect(words.length).toBeGreaterThan(0)
    expect(Math.min(...words)).toBeGreaterThanOrEqual(24)
  })
})
