import { describe, expect, it } from "vitest"
import { build, more, richDeck } from "./agent-fixtures.js"
import { readForAgent } from "./agent-read.js"
import { hex, ids } from "./sample-deck.js"
import type { AgentChange } from "./agent-change.js"

const change = (value: Record<string, unknown>) => value as AgentChange
const lines = (text: string) => text.split("\n")

describe("readForAgent", () => {
  const doom = build(
    build(
      richDeck(),
      change({
        op: "set",
        target: ids.card,
        fill: "accent2",
        stroke: hex(0xaabbcc).toUpperCase(),
        strokeWidth: 3,
        radius: 12,
        effect: "soft",
        name: "Revenue card",
        layout: "column",
        gap: 10,
        padding: 20,
      }),
    ),
    change({
      op: "set",
      target: ids.title,
      text: "Revenue **up**\n\n- a\n- b",
      textStyle: "heading",
      color: "accent1",
      align: "center",
    }),
  )
  const read = lines(readForAgent(doom, "all"))

  it("lists no layouts: a slide add takes no layout", () => {
    expect(read.some((line) => line.startsWith("layouts"))).toBe(false)
  })

  it("prints one line per node, in slide order and tree order, indented under its parent", () => {
    const ids_ = read.map((line) => line.trim().split(" ")[0])
    expect(ids_).toEqual([
      "slide",
      ids.card,
      ids.title,
      ids.side,
      ids.caption,
      more.chart,
      more.line,
      more.icon,
      "slide",
      more.titled,
    ])
    expect(read[0]).toBe(`slide ${ids.slide} "Slide 1"`)
    expect(read[1]!.startsWith("  ")).toBe(true)
    expect(read[2]!.startsWith("    ")).toBe(true)
  })

  it("says what each node is in the words the agent writes, with its place and size", () => {
    expect(read[1]).toBe(
      `  ${ids.card} frame @100,0 200x100 name="Revenue card" fill=accent2 stroke=${hex(0xaabbcc)} strokeWidth=3 radius=12 effect=soft layout=column gap=10 padding=20`,
    )
    expect(read[2]).toBe(
      `    ${ids.title} text 200x100 style=heading resize=height align=center color=accent1 text="Revenue **up**\\n\\n- a\\n- b"`,
    )
  })

  it("leaves out what is the default: the plain ink colour and a padding of nothing", () => {
    const plain = readForAgent(
      build(richDeck(), change({ op: "add", kind: "kpi", slide: more.slide2, items: [{ title: "A", value: "1" }] })),
      [more.slide2],
    )
    expect(plain).not.toContain("color=text ")
    expect(plain).not.toContain("padding=0")
    expect(plain).toContain("layout=row gap=29")
  })

  it("names a chart, a line, an icon and a role", () => {
    const chart = read.find((line) => line.includes(more.chart))!
    expect(chart).toContain(`${more.chart} chart @100,300 800x500 chart={"kind":"bar","categories":["Q1","Q2"]`)
    expect(read.find((line) => line.includes(more.line))).toBe(`  ${more.line} line @100,200 300x0`)
    expect(read.find((line) => line.includes(more.icon))).toBe(`  ${more.icon} icon @900,200 96x96 icon=star`)
    expect(read.find((line) => line.includes(more.titled))).toContain(`${more.titled} text:title @50,50 600x90`)
  })

  it("reads only the slides asked for, and says so for an id that is no slide", () => {
    expect(lines(readForAgent(doom, [more.slide2]))).toEqual([
      `slide ${more.slide2} "Slide 2"`,
      expect.stringContaining(more.titled),
    ])
    expect(readForAgent(doom, ["z:9" as never])).toContain("z:9 missing")
  })

  it("shows the solved box of a laid-out child, and leaves its place out when none was solved", () => {
    expect(read[2]).not.toContain("@")
    const solved = new Map([[ids.title, { x: 11, y: 12, w: 13, h: 14, rotation: 0, flipH: false, flipV: false }]])
    expect(lines(readForAgent(doom, [ids.slide], solved))[2]).toContain("@11,12 13x14")
  })
})
