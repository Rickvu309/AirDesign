import { describe, expect, it } from "vitest"
import type { AgentChange } from "./agent-change.js"
import { compileAgentEdit } from "./agent-edit.js"
import { agentDeck, apply, minter, runName } from "./agent-fixtures.js"
import { defaultTheme } from "./default-theme-art.js"
import { measure } from "./doom-fixtures-art.js"
import { descendantsOf, propOf } from "./doom-walk.js"
import { type NodeId, applyEdit, isRefusal, nodeId, rev } from "./index.js"
import type { Resolved } from "./resolved.js"
import { resolveSlide } from "./resolve-slide.js"
import { agent, ids } from "./sample-deck.js"

const titleBox = { x: 120, y: 70, w: 1680, h: 160 }

const titles = [
  "Q3 was a strong quarter: revenue up 12% with a 31% operating margin",
  "Revenue grew 12% to $48.2M, adding about $5.2M on last year's Q3",
  "Growth did not cost profitability: operating margin held at 31%",
  "Three priorities will drive Q4: footprint, cash and channel",
  "Cutting DSO by 12 days is the clearest cash lever; we ask the board to endorse all three Q4 priorities",
]

const priorities = [
  {
    title: "Expand cold-chain",
    icon: "snowflake",
    points: ["Open two new regions", "Extend temperature-controlled capacity"],
  },
  { title: "Cut DSO", icon: "banknote", points: ["From 52 to 40 days", "Release working capital"] },
  {
    title: "Launch shipper portal",
    icon: "layout-dashboard",
    points: ["Self-serve for shippers", "Lower cost to serve"],
  },
]

const kpis = [
  { title: "Q3 revenue", value: "$48.2M", note: "Up 12% year on year" },
  { title: "Operating margin", value: "31%", note: "Q3 operating margin" },
  { title: "Q4 priorities", value: "3", note: "Cold-chain, DSO, shipper portal" },
]

function boardUpdate() {
  const mint = minter("q")
  let doom = apply(agentDeck(), [{ node: ids.deck, prop: "theme", value: defaultTheme }])
  const send = (changes: readonly AgentChange[]): readonly NodeId[] => {
    const result = compileAgentEdit(doom, changes, { author: agent(runName), once: `q3-${doom.rev}`, mint })
    if ("refused" in result) throw new Error(JSON.stringify(result))
    const landed = applyEdit(doom, { ...result.edit, rev: rev(doom.rev + 1) })
    if (isRefusal(landed)) throw new Error(JSON.stringify(landed))
    doom = landed
    return result.added.map((each) => each.id)
  }
  const slides = send(titles.map(() => ({ op: "slide", add: {} })))
  send(
    titles.map((text, at) => ({
      op: "add",
      kind: "text",
      slide: slides[at]!,
      textStyle: "title",
      text,
      box: titleBox,
    })),
  )
  send([
    { op: "add", kind: "kpi", slide: slides[0]!, box: { x: 120, y: 280, w: 1680, h: 420 }, items: kpis },
    { op: "add", kind: "cards", slide: slides[3]!, box: { x: 120, y: 260, w: 1680, h: 700 }, items: priorities },
  ])
  return { doom, slides }
}

const flat = (nodes: readonly Resolved[]): readonly Resolved[] =>
  nodes.flatMap((node) => [node, ...flat(node.children)])

describe("the audit's Q3 board update, written by an agent on the default theme", () => {
  const { doom, slides } = boardUpdate()
  const painted = (slide: NodeId) => flat(resolveSlide(doom, slide, measure))
  const textOf = (node: Resolved) => propOf(doom.nodes.get(nodeId(node.id))!, "text")
  const chars = (node: Resolved) => textOf(node)?.chars ?? ""

  it("sets each action title on one or two lines inside the title box the agent drew", () => {
    for (const slide of slides) {
      const title = painted(slide).find((node) => textOf(node)?.style === "title")!
      expect(title.text!.lines.length, chars(title)).toBeLessThanOrEqual(2)
      const bottom = Math.max(...title.text!.lines.map((line) => line.y + line.h))
      expect(bottom, chars(title)).toBeLessThanOrEqual(titleBox.h)
    }
  })

  it("keeps every card heading and KPI tile word whole, hyphenated ones too", () => {
    for (const slide of [slides[0]!, slides[3]!]) {
      const words = painted(slide).filter((node) => {
        const text = textOf(node)
        return text !== undefined && text.style !== "title" && text.style !== "body"
      })
      expect(words.length).toBeGreaterThan(0)
      for (const node of words) {
        const all = chars(node)
        for (const line of node.text!.lines.slice(0, -1)) {
          const between = `${all[line.end - 1] ?? ""}${all[line.end] ?? ""}`
          expect(/\s/.test(between), `${all} breaks after "${all.slice(line.start, line.end)}"`).toBe(true)
        }
      }
    }
  })

  it("lets the agent's whole deck use the theme's own sizes only", () => {
    for (const slide of slides)
      for (const node of descendantsOf(doom, slide))
        for (const span of propOf(node, "text")?.spans ?? []) expect(span.size).toBeUndefined()
  })
})
