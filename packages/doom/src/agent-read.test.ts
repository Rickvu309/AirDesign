import { describe, expect, it } from "vitest"
import { apply, build } from "./agent-fixtures.js"
import { more, richDeck } from "./testing/rich-deck.js"
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
      more.frame,
      more.line,
      more.icon,
      "slide",
      more.titled,
    ])
    expect(read[0]).toBe(`slide ${ids.slide} "Slide 1" group=${ids.row}`)
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

  it("names a shape's outline in the word the agent sets, and says nothing for a rectangle", () => {
    const starred = build(doom, change({ op: "set", target: ids.caption, shape: "star5" }))
    expect(readForAgent(starred, "all")).toContain(" shape=star5")
    expect(readForAgent(build(doom, change({ op: "set", target: ids.caption, shape: "rect" })), "all")).not.toContain(
      "shape=",
    )
  })

  it("summarizes a path and shows its commands on request", () => {
    const d = "M0 0L1 1"
    const withPath = apply(doom, [
      { node: ids.caption, prop: "geometry", value: { kind: "path", d, fillStroke: true } },
    ])
    const line = lines(readForAgent(withPath, "all")).find((line) => line.trim().startsWith(ids.caption))
    expect(line).toMatch(new RegExp(`${ids.caption} path @-?\\d+,-?\\d+ \\d+x\\d+`))
    expect(line).toContain("fillStroke=true")
    expect(line).not.toContain("d=")
    expect(readForAgent(withPath, "all", undefined, ids.caption)).toContain(`d="${d}"`)
  })

  it("leaves out what is the default: the plain ink colour and a padding of nothing", () => {
    const plain = readForAgent(
      build(richDeck(), change({ op: "add", kind: "frame", slide: more.slide2, layout: "row" })),
      [more.slide2],
    )
    expect(plain).not.toContain("color=text ")
    expect(plain).not.toContain("padding=0")
    expect(plain).toContain("layout=row gap=29")
  })

  it("names a frame, a line, an icon and a role", () => {
    const frame = read.find((line) => line.includes(more.frame))!
    expect(frame).toContain(`${more.frame} frame`)
    expect(read.find((line) => line.includes(more.line))).toBe(`  ${more.line} line @100,200 300x0`)
    expect(read.find((line) => line.includes(more.icon))).toBe(`  ${more.icon} icon @900,200 96x96 icon=star`)
    expect(read.find((line) => line.includes(more.titled))).toContain(`${more.titled} text:title @50,50 600x90`)
  })

  it("reads only the slides asked for, and says so for an id that is no slide", () => {
    expect(lines(readForAgent(doom, [more.slide2]))).toEqual([
      `slide ${more.slide2} "Slide 2" group=${ids.row}`,
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

describe("readForAgent of a line", () => {
  it("names the layer and side each attached end follows, and a route that is not straight", () => {
    const doom = build(
      richDeck(),
      change({ op: "set", target: more.line, from: { layer: ids.card, side: "bottom" }, route: "curve", arrow: true }),
    )
    const line = lines(readForAgent(doom, "all")).find((each) => each.includes(more.line))
    expect(line).toContain(`from=${ids.card}:bottom route=curve arrow`)
  })

  it("rounds fractional attachments and omits a centered attachment", () => {
    const doom = apply(richDeck(), [
      {
        node: more.line,
        prop: "geometry",
        value: {
          kind: "line",
          start: { node: ids.card, site: "b", along: 0.5205479452054794 },
          end: { node: ids.title, site: "t", along: 0.5 },
          route: "straight",
          arrows: ["none", "none"],
        },
      },
    ])
    const line = lines(readForAgent(doom, "all")).find((each) => each.includes(more.line))
    expect(line).toContain(`from=${ids.card}:bottom@0.52 to=${ids.title}:top`)
    expect(line).not.toContain(`to=${ids.title}:top@`)
  })

  it("reads a start arrowhead and a named end arrowhead back as the fields that set them", () => {
    const doom = build(richDeck(), change({ op: "set", target: more.line, startArrow: "circle", arrow: "triangle" }))
    const line = lines(readForAgent(doom, "all")).find((each) => each.includes(more.line))
    expect(line).toContain("startArrow=circle")
    expect(line).toContain("arrow=triangle")
  })
})
