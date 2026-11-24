import { describe, expect, it } from "vitest"
import type { AgentChange } from "./agent-change.js"
import { compileAgentChange } from "./agent-compile.js"
import { compileAgentEdit } from "./agent-edit.js"
import { agentDeck, apply, build, compiled, firstSlide, lastChild, minter, runName } from "./agent-fixtures.js"
import { placeholderTitle } from "./placeholder-title.js"
import { agent, create, hex, ids } from "./sample-deck.js"
import { childrenOf, propOf } from "./doom-walk.js"
import type { Doom } from "./doom.js"
import { nodeId } from "./ids.js"

const slide = ids.slide
const text = (more: Record<string, unknown> = {}): AgentChange =>
  ({ op: "add", kind: "text", slide, text: "Margin held", ...more }) as AgentChange

describe("add text", () => {
  it("writes a rect shape holding the words, in the largest free area of the slide and clear of what is there", () => {
    const doom = build(agentDeck(), text())
    const made = lastChild(doom, slide)
    expect(made.type).toBe("shape")
    expect(propOf(made, "geometry")).toEqual({ kind: "rect" })
    expect(propOf(made, "text")).toMatchObject({ chars: "Margin held", style: "body", resize: "height" })
    const box = propOf(made, "box")!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.w).toBeLessThanOrEqual(1920)
    expect(box.y).toBeGreaterThanOrEqual(100)
    expect(box.h).toBeGreaterThan(0)
    expect(box.h).toBeLessThan(200)
    expect(box.w).toBeGreaterThan(1000)
  })

  it("puts a text with no box on the left edge of the slide's title, so a title and its subtitle line up", () => {
    let doom = build(
      agentDeck(),
      text({ textStyle: "title", text: "Q3 board update", box: { x: 160, y: 380, w: 1600, h: 160 } }),
      minter("a"),
    )
    doom = build(doom, text({ textStyle: "heading", text: "Revenue grew" }), minter("b"))
    const [title, subtitle] = childrenOf(doom, slide)
      .slice(-2)
      .map((node) => propOf(node, "box")!)
    expect(subtitle!.x).toBe(title!.x)
    expect(subtitle!.x + subtitle!.w).toBeLessThanOrEqual(title!.x + title!.w)
    expect(subtitle!.y).toBeGreaterThanOrEqual(title!.y + title!.h)
  })

  it("takes the next free area for the next add, so two adds do not overlap", () => {
    let doom = build(agentDeck(), text({ textStyle: "title" }), minter("a"))
    doom = build(doom, text({ text: "Second" }), minter("b"))
    const [first, second] = childrenOf(doom, slide)
      .slice(-2)
      .map((node) => propOf(node, "box")!)
    expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.h + 29)
  })

  it("reads markdown, a named text style, alignment and a colour from the look", () => {
    const doom = build(agentDeck(), text({ text: "A **b**", textStyle: "title", align: "center", color: "accent2" }))
    const written = propOf(lastChild(doom, slide), "text")!
    expect(written.style).toBe("title")
    expect(written.paras).toEqual([{ align: "center" }])
    expect(written.spans).toEqual([
      { end: 2, color: { var: "accent2" } },
      { end: 3, bold: true, color: { var: "accent2" } },
    ])
  })

  it("makes the first text in the title style the slide's title, and no later one", () => {
    let doom = build(agentDeck(), text({ textStyle: "title", box: { x: 0, y: 0, w: 900, h: 90 } }), minter("a"))
    doom = build(doom, text({ textStyle: "title", text: "Again", box: { x: 0, y: 200, w: 900, h: 90 } }), minter("b"))
    doom = build(doom, text({ textStyle: "heading", text: "Sub", box: { x: 0, y: 400, w: 900, h: 90 } }), minter("c"))
    expect(
      childrenOf(doom, slide)
        .slice(-3)
        .map((node) => propOf(node, "role")),
    ).toEqual(["title", undefined, undefined])
  })

  it("makes no node when the words are missing, naming the field", () => {
    expect(compileAgentChange(agentDeck(), { op: "add", kind: "text", slide }, minter())).toEqual({
      refused: "shape",
      field: "text",
      fault: "missing",
      form: "A non-empty string.",
      change: "add text",
    })
  })
})

const startTitle = nodeId("t:50")
const withPlaceholder = (chars: string = placeholderTitle): Doom =>
  apply(agentDeck(), [
    ...create(startTitle, "shape", ids.slide),
    { node: startTitle, prop: "role", value: "title" },
    {
      node: startTitle,
      prop: "box",
      value: { x: 160, y: 240, w: 1600, h: 300, rotation: 0, flipH: false, flipV: false },
    },
    {
      node: startTitle,
      prop: "text",
      value: { chars, spans: [], paras: [{}], style: "bigNumber", resize: "fixed", alignV: "bottom" },
    },
  ])

describe("add text on a slide holding the new deck's title placeholder", () => {
  it("fills the placeholder with the words and makes no second text", () => {
    const before = withPlaceholder()
    const doom = build(before, text({ textStyle: "title", text: "Q3 board update" }))
    expect(childrenOf(doom, slide)).toHaveLength(childrenOf(before, slide).length)
    const filled = doom.nodes.get(startTitle)!
    expect(propOf(filled, "text")).toMatchObject({
      chars: "Q3 board update",
      style: "bigNumber",
      resize: "fixed",
      alignV: "bottom",
    })
    expect(propOf(filled, "box")).toMatchObject({ x: 160, y: 240, w: 1600, h: 300 })
    expect(propOf(filled, "role")).toBe("title")
  })

  it("names the filled placeholder as the layer the add made, so the agent has its id", () => {
    const edit = compileAgentEdit(withPlaceholder(), [text({ textStyle: "title", text: "Q3 board update" })], {
      author: agent(runName),
      once: "fill-1",
      mint: minter(),
    })
    if ("refused" in edit) throw new Error(edit.refused)
    expect(edit.added).toEqual([{ id: startTitle, change: 0, kind: "text" }])
  })

  it("carries the agent's markdown and colour into the filled text", () => {
    const doom = build(withPlaceholder(), text({ textStyle: "title", text: "Q3 **board**", color: "accent2" }))
    expect(propOf(doom.nodes.get(startTitle)!, "text")!.spans).toEqual([
      { end: 3, color: { var: "accent2" } },
      { end: 8, bold: true, color: { var: "accent2" } },
    ])
  })

  it("puts the subtitle under the filled title, on its left edge", () => {
    let doom = build(withPlaceholder(), text({ textStyle: "title", text: "Q3 board update" }), minter("a"))
    doom = build(doom, text({ textStyle: "heading", text: "Revenue grew" }), minter("b"))
    const title = propOf(doom.nodes.get(startTitle)!, "box")!
    const subtitle = propOf(lastChild(doom, slide), "box")!
    expect(subtitle.x).toBe(title.x)
    expect(subtitle.y).toBeGreaterThanOrEqual(title.y + title.h)
  })

  it("fills a title left empty too", () => {
    const doom = build(withPlaceholder(""), text({ textStyle: "title", text: "Q3 board update" }))
    expect(propOf(doom.nodes.get(startTitle)!, "text")!.chars).toBe("Q3 board update")
  })

  it("keeps a title a person wrote, and adds the agent's text beside it", () => {
    const before = withPlaceholder("Our plan")
    const doom = build(before, text({ textStyle: "title", text: "Another" }))
    expect(propOf(doom.nodes.get(startTitle)!, "text")!.chars).toBe("Our plan")
    expect(childrenOf(doom, slide)).toHaveLength(childrenOf(before, slide).length + 1)
  })

  it("adds a body text beside the placeholder", () => {
    const before = withPlaceholder()
    const doom = build(before, text())
    expect(propOf(doom.nodes.get(startTitle)!, "text")!.chars).toBe(placeholderTitle)
    expect(childrenOf(doom, slide)).toHaveLength(childrenOf(before, slide).length + 1)
  })
})

describe("add shape", () => {
  it("fills with the first accent unless told otherwise, and carries no text", () => {
    const made = lastChild(
      build(agentDeck(), { op: "add", kind: "shape", slide, box: { x: 0, y: 0, w: 100, h: 100 } }),
      slide,
    )
    expect(propOf(made, "fills")).toEqual([{ kind: "solid", color: { var: "accent1" } }])
    expect(propOf(made, "text")).toBeUndefined()
  })

  it("keeps a stroke-only shape unfilled and writes the outline weight", () => {
    const made = lastChild(
      build(agentDeck(), {
        op: "add",
        kind: "shape",
        slide,
        stroke: "text2",
        strokeWidth: 4,
        radius: 12,
        box: { x: 0, y: 0, w: 100, h: 100 },
      }),
      slide,
    )
    expect(propOf(made, "fills")).toBeUndefined()
    expect(propOf(made, "strokes")).toEqual([{ kind: "solid", color: { var: "text2" } }])
    expect(propOf(made, "stroke")).toEqual({ weight: 4, align: "inside", dash: "solid" })
    expect(propOf(made, "radius")).toBe(12)
  })

  it("centres words inside it and picks a colour that reads on an accent fill", () => {
    const made = lastChild(
      build(agentDeck(), { op: "add", kind: "shape", slide, text: "Decision", box: { x: 0, y: 0, w: 300, h: 80 } }),
      slide,
    )
    expect(propOf(made, "text")).toMatchObject({ resize: "fixed", alignV: "center" })
    expect(propOf(made, "text")?.paras).toEqual([{ align: "center" }])
    expect(propOf(made, "text")?.spans).toEqual([{ end: 8, color: { var: "background" } }])
  })
})

describe("add line", () => {
  it("writes a straight line between the corners of its box, with an arrowhead on request", () => {
    const made = lastChild(
      build(agentDeck(), { op: "add", kind: "line", slide, arrow: true, box: { x: 10, y: 20, w: 300, h: 0 } }),
      slide,
    )
    expect(propOf(made, "geometry")).toEqual({
      kind: "line",
      start: { x: 10, y: 20 },
      end: { x: 310, y: 20 },
      route: "straight",
      arrows: ["none", "arrow"],
    })
    expect(propOf(made, "strokes")).toEqual([{ kind: "solid", color: { var: "text2" } }])
    expect(propOf(made, "stroke")).toMatchObject({ weight: 3, align: "center" })
  })

  it("sets the start arrowhead and a named end, and refuses the start on a shape", () => {
    const made = lastChild(
      build(agentDeck(), {
        op: "add",
        kind: "line",
        slide,
        startArrow: "circle",
        arrow: "triangle",
        box: { x: 10, y: 20, w: 300, h: 0 },
      }),
      slide,
    )
    expect(propOf(made, "geometry")).toMatchObject({ arrows: ["circle", "triangle"] })
    expect(
      compileAgentChange(agentDeck(), { op: "add", kind: "shape", slide, startArrow: "circle" }, minter()),
    ).toMatchObject({ field: "startArrow" })
  })

  it("runs across the free area, level, when it has no box", () => {
    const made = lastChild(build(agentDeck(), { op: "add", kind: "line", slide }), slide)
    const box = propOf(made, "box")!
    expect(box.h).toBe(0)
    expect(box.w).toBeGreaterThan(1000)
  })
})

describe("add frame", () => {
  it("lays out what is inside it in a row or column, with gap, padding, paint and radius", () => {
    const made = lastChild(
      build(agentDeck(), {
        op: "add",
        kind: "frame",
        slide,
        layout: "row",
        gap: 24,
        padding: 16,
        fill: "background2",
        radius: 20,
        effect: "soft",
        box: { x: 0, y: 0, w: 600, h: 200 },
      }),
      slide,
    )
    expect(made.type).toBe("frame")
    expect(propOf(made, "layout")).toEqual({
      mode: "row",
      gap: 24,
      padding: { t: 16, r: 16, b: 16, l: 16 },
      align: "top-left",
    })
    expect(propOf(made, "fills")).toEqual([{ kind: "solid", color: { var: "background2" } }])
    expect(propOf(made, "radius")).toBe(20)
    expect(propOf(made, "effects")).toBe("soft")
  })

  it("refuses words on a frame, naming the field", () => {
    expect(compileAgentChange(agentDeck(), { op: "add", kind: "frame", slide, text: "x" }, minter())).toMatchObject({
      refused: "shape",
      field: "text",
    })
  })
})

describe("add picture and icon", () => {
  it("makes a picture as a rect shape filled by an image paint", () => {
    const made = lastChild(
      build(agentDeck(), {
        op: "add",
        kind: "picture",
        slide,
        fill: { image: "https://x.test/a.png" },
        box: { x: 0, y: 0, w: 400, h: 300 },
      }),
      slide,
    )
    expect(propOf(made, "fills")).toEqual([{ kind: "image", asset: "https://x.test/a.png", fit: "fill" }])
    expect(propOf(made, "geometry")).toEqual({ kind: "rect" })
  })

  it("sizes a picture with no box to its own shape, centred in the free area and no larger than it is", () => {
    const reading = { pictures: new Map([["a".repeat(64), { width: 4000, height: 1000 }]]) }
    const change: AgentChange = { op: "add", kind: "picture", slide, fill: { image: "a".repeat(64) } }
    const writes = compiled(agentDeck(), change, minter(), reading)
    const box = writes.find((write) => write.prop === "box")?.value as { x: number; y: number; w: number; h: number }
    const free = compiled(agentDeck(), change, minter()).find((write) => write.prop === "box")?.value as {
      x: number
      y: number
      w: number
      h: number
    }
    expect(box.w / box.h).toBeCloseTo(4, 1)
    expect(box.w).toBeLessThanOrEqual(free.w)
    expect(box.h).toBeLessThanOrEqual(free.h)
    expect(box.x + box.w / 2).toBeCloseTo(free.x + free.w / 2, 0)
    expect(box.y + box.h / 2).toBeCloseTo(Math.round(free.y + free.h / 2), 0)
  })

  it("keeps a small picture with no box at its own size", () => {
    const reading = { pictures: new Map([["a".repeat(64), { width: 300, height: 200 }]]) }
    const change: AgentChange = { op: "add", kind: "picture", slide, fill: { image: "a".repeat(64) } }
    const writes = compiled(agentDeck(), change, minter(), reading)
    expect(writes.find((write) => write.prop === "box")?.value).toMatchObject({ w: 300, h: 200 })
  })

  it("fills the free area when the picture's size is not known", () => {
    const change: AgentChange = { op: "add", kind: "picture", slide, fill: { image: "a".repeat(64) } }
    const writes = compiled(agentDeck(), change, minter())
    const box = writes.find((write) => write.prop === "box")?.value as { w: number; h: number }
    expect(box.w).toBeGreaterThan(1000)
  })

  it("refuses a picture with no image", () => {
    expect(compileAgentChange(agentDeck(), { op: "add", kind: "picture", slide }, minter())).toMatchObject({
      refused: "shape",
      field: "fill",
    })
  })

  it("makes an icon as a stroked vector, adding the library name and a weight that follows its size", () => {
    const made = lastChild(
      build(agentDeck(), { op: "add", kind: "icon", slide, icon: "arrow-right", box: { x: 0, y: 0, w: 96, h: 96 } }),
      slide,
    )
    expect(propOf(made, "geometry")).toEqual({ kind: "icon", name: "lucide/arrow-right" })
    expect(propOf(made, "strokes")).toEqual([{ kind: "solid", color: { var: "accent1" } }])
    expect(propOf(made, "stroke")).toEqual({ weight: 8, align: "center", dash: "solid" })
  })

  it("sizes an icon on its own when it has no box", () => {
    const box = propOf(
      lastChild(build(agentDeck(), { op: "add", kind: "icon", slide, icon: "lucide/star" }), slide),
      "box",
    )!
    expect(box.w).toBe(96)
    expect(box.h).toBe(96)
  })

  it("refuses an icon with no name", () => {
    expect(compileAgentChange(agentDeck(), { op: "add", kind: "icon", slide }, minter())).toMatchObject({
      field: "icon",
    })
  })
})

describe("add chart", () => {
  it("makes a frame that holds the data, with colours as theme variables", () => {
    const doom = build(agentDeck(), {
      op: "add",
      kind: "chart",
      slide,
      chart: {
        kind: "bar",
        categories: ["Q1", "Q2"],
        series: [
          { name: "Plan", values: [3, 4], color: "accent2" },
          { name: "Actual", values: [2, 5], color: hex(0x112233) },
        ],
        labels: true,
      },
    })
    const made = lastChild(doom, slide)
    expect(made.type).toBe("frame")
    expect(propOf(made, "chart")).toEqual({
      kind: "bar",
      categories: ["Q1", "Q2"],
      series: [
        { name: "Plan", values: [3, 4], color: { var: "accent2" } },
        { name: "Actual", values: [2, 5], color: hex(0x112233) },
      ],
      labels: true,
    })
    expect(propOf(made, "box")!.w).toBeGreaterThan(1000)
  })

  it("refuses a chart with no data", () => {
    expect(compileAgentChange(agentDeck(), { op: "add", kind: "chart", slide }, minter())).toMatchObject({
      field: "chart",
    })
  })
})

describe("where an add lands", () => {
  const frame: AgentChange = {
    op: "add",
    kind: "frame",
    slide,
    name: "Card",
    box: { x: 700, y: 200, w: 400, h: 300 },
  }

  it("goes into a frame on the slide when told, in room taken from that frame", () => {
    const mint = minter("a")
    let doom = build(agentDeck(), frame, mint)
    const card = lastChild(doom, slide).id
    doom = build(doom, { op: "add", kind: "text", slide, into: card, text: "Inside" }, mint)
    const inside = lastChild(doom, card)
    expect(propOf(inside, "parent")?.id).toBe(card)
    const box = propOf(inside, "box")!
    expect(box.x + box.w).toBeLessThanOrEqual(400)
    expect(box.y + box.h).toBeLessThanOrEqual(300)
  })

  it("puts words into a laid-out frame with no box, for the layout to place", () => {
    const mint = minter("a")
    let doom = build(agentDeck(), { ...frame, layout: "column", gap: 10 } as AgentChange, mint)
    const column = lastChild(doom, slide).id
    doom = build(doom, { op: "add", kind: "text", slide, into: column, text: "Row one" }, mint)
    const inside = lastChild(doom, column)
    expect(propOf(inside, "box")).toBeUndefined()
    expect(propOf(inside, "sizing")).toEqual({ w: "fill", h: "hug" })
  })

  it("asks for a box when a shape goes into a laid-out frame whose size nobody wrote", () => {
    const doom = build(agentDeck(), { op: "add", kind: "kpi", slide, items: [{ title: "A", value: "1" }] }, minter("a"))
    const card = childrenOf(doom, lastChild(doom, slide).id)[0]!
    expect(compileAgentChange(doom, { op: "add", kind: "shape", slide, into: card.id }, minter("b"))).toMatchObject({
      refused: "limit",
      field: "box",
    })
    const words = build(doom, { op: "add", kind: "text", slide, into: card.id, text: "Extra" }, minter("c"))
    expect(propOf(lastChild(words, card.id), "text")?.chars).toBe("Extra")
  })

  it("refuses to add into a chart, which draws its own", () => {
    const doom = build(
      agentDeck(),
      {
        op: "add",
        kind: "chart",
        slide,
        chart: { kind: "bar", categories: ["a"], series: [{ name: "s", values: [1] }] },
      },
      minter("a"),
    )
    expect(compileAgentChange(doom, text({ into: lastChild(doom, slide).id }), minter("b"))).toMatchObject({
      refused: "shape",
      field: "into",
    })
  })

  it("refuses a slide that is not there and a frame on another slide, naming the change", () => {
    expect(compileAgentChange(agentDeck(), text({ slide: "z:9" }), minter())).toEqual({
      refused: "missing",
      node: "z:9",
      field: "slide",
      change: "add text",
    })
    expect(compileAgentChange(agentDeck(), text({ into: ids.title }), minter())).toMatchObject({
      refused: "missing",
      field: "into",
    })
  })

  it("refuses a field the kind does not take, naming it", () => {
    expect(compileAgentChange(agentDeck(), text({ rows: [["a"]] }), minter())).toMatchObject({
      refused: "shape",
      field: "rows",
      change: "add text",
    })
    expect(compileAgentChange(agentDeck(), { op: "add", kind: "line", slide, text: "x" }, minter())).toMatchObject({
      field: "text",
    })
  })

  it("says limit, naming the box, when nothing is free", () => {
    const full: AgentChange = { op: "add", kind: "shape", slide, box: { x: 0, y: 0, w: 1920, h: 1080 } }
    const doom = build(agentDeck(), full)
    expect(compileAgentChange(doom, text(), minter("b"))).toMatchObject({ refused: "limit", field: "box" })
    expect(compiled(doom, text({ box: { x: 0, y: 0, w: 10, h: 10 } }), minter("c"))).toBeTruthy()
  })

  it("puts the first slide's free area to use: the sample slide is the one it adds to", () => {
    expect(firstSlide(agentDeck())).toBe(slide)
  })
})
