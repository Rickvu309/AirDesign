import { describe, expect, it } from "vitest"
import { bytesOf } from "../limits.js"
import type { AgentChange } from "./agent-change.js"
import { compileAgentEdit } from "./agent-edit.js"
import { boardDeckChanges } from "./board-deck.js"
import { agentDeck, minter, runName } from "./agent-fixtures.js"
import { readForAgent } from "./agent-read.js"
import { type NodeId, applyEdit, isRefusal, rev } from "./index.js"
import { agent, ids } from "./sample-deck.js"
import { childrenOf, descendantsOf, get, slidesOf } from "./scene-walk.js"
import { textStyleNames } from "./text.js"

function board(mode: "together" | "per-slide") {
  const mint = minter("b")
  let scene = agentDeck()
  const batches: (readonly AgentChange[])[] = []
  const send = (changes: readonly AgentChange[]): readonly NodeId[] => {
    batches.push(changes)
    const result = compileAgentEdit(scene, changes, { author: agent(runName), once: `board-${batches.length}`, mint })
    if ("refused" in result) throw new Error(`batch ${batches.length}: ${JSON.stringify(result)}`)
    const landed = applyEdit(scene, { ...result.edit, rev: rev(scene.rev + 1) })
    if (isRefusal(landed)) throw new Error(JSON.stringify(landed))
    scene = landed
    return result.added
  }
  const added = send(Array.from({ length: 4 }, () => ({ op: "slide", add: {} })))
  const slides = [ids.slide, ...added]
  const parts = boardDeckChanges(slides)
  if (mode === "together") send(parts.flat())
  else for (const part of parts) send(part)
  return { scene, batches, slides }
}

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

describe.each(["together", "per-slide"] as const)("the board deck brief, sent %s", (mode) => {
  const { scene, batches, slides } = board(mode)

  it("compiles in at most eight batches", () => {
    expect(batches.length).toBeLessThanOrEqual(8)
    expect(slidesOf(scene).map((slide) => slide.id)).toEqual(slides)
    expect(slides).toHaveLength(5)
  })

  it("gives every slide a title and keeps what each slide holds clear of the rest", () => {
    for (const slide of slides) {
      const top = childrenOf(scene, slide)
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
    const names = (slide: NodeId) => childrenOf(scene, slide).map((node) => get(node, "name"))
    expect(names(slides[1]!)).toEqual([undefined, "KPI", "Decision"])
    expect(childrenOf(scene, slides[2]!).some((node) => get(node, "chart")?.kind === "bar")).toBe(true)
    const priorities = childrenOf(scene, slides[3]!)[1]!
    expect(descendantsOf(scene, priorities.id).filter((node) => get(node, "geometry")?.kind === "icon")).toHaveLength(3)
    const roadmap = childrenOf(scene, slides[4]!)[1]!
    expect(get(roadmap, "layout")).toMatchObject({ mode: "grid" })
    expect(childrenOf(scene, roadmap.id)).toHaveLength(19)
  })

  it("uses the deck's named text styles and no size of its own anywhere", () => {
    for (const slide of slides)
      for (const node of descendantsOf(scene, slide)) {
        const text = get(node, "text")
        if (text === undefined) continue
        expect(textStyleNames).toContain(text.style)
        for (const span of text.spans)
          expect(Object.keys(span).filter((key) => ["size", "font", "tracking", "case"].includes(key))).toEqual([])
      }
  })

  it("reads back in under 3,000 tokens, every node on a line of its own", () => {
    const read = readForAgent(scene, "all")
    expect(Math.ceil(bytesOf(read) / 4)).toBeLessThan(3_000)
    const count = slides.reduce((sum, slide) => sum + 1 + descendantsOf(scene, slide).length, 0)
    expect(read.split("\n")).toHaveLength(count)
  })
})
