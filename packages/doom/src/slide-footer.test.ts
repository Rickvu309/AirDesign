import { describe, expect, it } from "vitest"
import { bytesOf } from "./limits.js"
import type { AgentChange } from "./agent-change.js"
import { compileAgentChange } from "./agent-compile.js"
import { readAgentChange } from "./agent-change.js"
import { agentDeck, build, minter } from "./agent-fixtures.js"
import { readForAgent } from "./agent-read.js"
import { propOf, slidesOf } from "./doom-walk.js"
import { doomFromTree } from "./doom-tree.js"
import { applyEdit, defaultTheme, isRefusal, resolveSlide, rev, type Doom, type NodeId } from "./index.js"
import { footerTop, inkOf, pageOf, resolveFooter } from "./slide-footer.js"
import { sourceLine } from "./source-line.js"
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

  it("stores what the shared source policy gives for the raw words, however long or untidy", () => {
    for (const raw of ["  Source: A\n\n B  ", "So\u0000urce", `${"a".repeat(297)}😀`, "é".repeat(500), "\n"]) {
      const read = readAgentChange({ op: "set", target: ids.slide, source: raw })
      if ("refused" in read) throw new Error(JSON.stringify(read))
      const doom = build(agentDeck(), read)
      expect(propOf(doom.nodes.get(ids.slide), "source") ?? "").toBe(sourceLine(raw))
    }
  })

  it("refuses a source on a layer, as the footer belongs to the slide", () => {
    expect(compileAgentChange(agentDeck(), set(ids.card, { source: "x" }), minter())).toMatchObject({
      refused: "shape",
      field: "source",
    })
  })
})

const citation = (bytes: number): string => {
  const words = "Company annual reports, regulatory filings, investor presentations and licensed market data".split(" ")
  let text = "Source:"
  for (let at = 0; bytesOf(`${text} ${words[at % words.length]!}`) <= bytes; at += 1)
    text += ` ${words[at % words.length]!}`
  return sourceLine(text)
}

function slideWith(source: string) {
  const { doom, slides } = doomFromTree({ theme: plainTheme, slides: [{ children: [], props: { source } }] })
  return { doom, slide: slides[0]! }
}

const shown = (part: ReturnType<typeof resolveFooter>[number]) =>
  part.lines.map((line) => line.runs.map((run) => run.text).join(""))

describe("a long source line", () => {
  it("wraps to two lines at most inside the footer band, with every word it shows on the slide", () => {
    const long = citation(253)
    expect(bytesOf(long)).toBeGreaterThan(240)
    const { doom, slide } = slideWith(long)
    const parts = resolveFooter(doom, slide, measure)
    const source = parts.find((part) => part.part === "source")!
    const number = parts.find((part) => part.part === "number")!
    expect(source.lines.length).toBeLessThanOrEqual(2)
    for (const line of source.lines) {
      expect(source.box.y + line.y).toBeGreaterThanOrEqual(footerTop(1080))
      expect(source.box.y + line.y + line.h).toBeLessThanOrEqual(1080)
    }
    const last = source.lines.at(-1)!
    expect(source.box.y + last.y + last.h).toBe(number.box.y + number.lines[0]!.y + number.lines[0]!.h)
  })

  it("ends in an ellipsis when the words run past two lines, and shows only the start of them", () => {
    const long = citation(300)
    const { doom, slide } = slideWith(long)
    const source = resolveFooter(doom, slide, measure).find((part) => part.part === "source")!
    const text = shown(source).join("")
    expect(source.lines).toHaveLength(2)
    expect(text.endsWith("…")).toBe(true)
    expect(long.replace(/\s/g, "").startsWith(text.slice(0, -1).replace(/\s/g, ""))).toBe(true)
    expect(text.length).toBeLessThan(long.length)
  })

  it("fills both lines with the deck's own caption style, whose two lines are taller than a plain theme's", () => {
    const { doom, slides } = doomFromTree({
      theme: defaultTheme,
      slides: [{ children: [], props: { source: citation(300).toUpperCase() } }],
    })
    const source = resolveFooter(doom, slides[0]!, measure).find((part) => part.part === "source")!
    expect(source.lines).toHaveLength(2)
    expect(shown(source).join("").endsWith("…")).toBe(true)
    expect(source.box.y + source.lines[0]!.y).toBeGreaterThanOrEqual(footerTop(1080))
  })

  it("keeps a source that fits two lines whole, with no ellipsis", () => {
    const fits = citation(180)
    const { doom, slide } = slideWith(fits)
    const source = resolveFooter(doom, slide, measure).find((part) => part.part === "source")!
    expect(shown(source).join("")).toBe(fits)
  })

  it("lets a person double-click only where the words are", () => {
    const { doom, slide } = slideWith("Source: Filings")
    const source = resolveFooter(doom, slide, measure).find((part) => part.part === "source")!
    const ink = inkOf(source)!
    expect(ink.x).toBe(source.box.x)
    expect(ink.w).toBeLessThan(source.box.w / 4)
    expect(ink.y + ink.h).toBeLessThanOrEqual(1080)
    const number = resolveFooter(doom, slide, measure).find((part) => part.part === "number")!
    expect(inkOf(number)!.x + inkOf(number)!.w).toBeCloseTo(number.box.x + number.box.w, 5)
  })
})

describe("an agent reading a long source line", () => {
  it("reads all of it back, whatever the slide shows", () => {
    const long = citation(300)
    const doom = build(agentDeck(), set(ids.slide, { source: long }))
    expect(readForAgent(doom, [ids.slide]).split("\n")[0]).toContain(JSON.stringify(long))
  })
})
