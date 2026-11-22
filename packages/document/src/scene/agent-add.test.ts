import { describe, expect, it } from "vitest"
import type { AgentChange } from "./agent-change.js"
import { compileAgentChange } from "./agent-compile.js"
import { agentDeck, build, compiled, firstSlide, lastChild, minter } from "./agent-fixtures.js"
import { hex, ids } from "./sample-deck.js"
import { childrenOf, get } from "./scene-walk.js"

const slide = ids.slide
const text = (more: Record<string, unknown> = {}): AgentChange =>
  ({ op: "add", kind: "text", slide, text: "Margin held", ...more }) as AgentChange

describe("add text", () => {
  it("writes a rect shape holding the words, in the largest free area of the slide and clear of what is there", () => {
    const scene = build(agentDeck(), text())
    const made = lastChild(scene, slide)
    expect(made.type).toBe("shape")
    expect(get(made, "geometry")).toEqual({ kind: "rect" })
    expect(get(made, "text")).toMatchObject({ chars: "Margin held", style: "body", resize: "height" })
    const box = get(made, "box")!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.w).toBeLessThanOrEqual(1920)
    expect(box.y).toBeGreaterThanOrEqual(100)
    expect(box.h).toBeGreaterThan(0)
    expect(box.h).toBeLessThan(200)
    expect(box.w).toBeGreaterThan(1000)
  })

  it("puts a text with no box on the left edge of the slide's title, so a title and its subtitle line up", () => {
    let scene = build(
      agentDeck(),
      text({ textStyle: "title", text: "Q3 board update", box: { x: 160, y: 380, w: 1600, h: 160 } }),
      minter("a"),
    )
    scene = build(scene, text({ textStyle: "heading", text: "Revenue grew" }), minter("b"))
    const [title, subtitle] = childrenOf(scene, slide)
      .slice(-2)
      .map((node) => get(node, "box")!)
    expect(subtitle!.x).toBe(title!.x)
    expect(subtitle!.x + subtitle!.w).toBeLessThanOrEqual(title!.x + title!.w)
    expect(subtitle!.y).toBeGreaterThanOrEqual(title!.y + title!.h)
  })

  it("takes the next free area for the next add, so two adds do not overlap", () => {
    let scene = build(agentDeck(), text({ textStyle: "title" }), minter("a"))
    scene = build(scene, text({ text: "Second" }), minter("b"))
    const [first, second] = childrenOf(scene, slide)
      .slice(-2)
      .map((node) => get(node, "box")!)
    expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.h + 29)
  })

  it("keeps an explicit box as given and fixes the text to it", () => {
    const scene = build(agentDeck(), text({ box: { x: 10, y: 20, w: 300, h: 80 } }))
    const made = lastChild(scene, slide)
    expect(get(made, "box")).toMatchObject({ x: 10, y: 20, w: 300, h: 80, rotation: 0 })
    expect(get(made, "text")?.resize).toBe("fixed")
  })

  it("reads markdown, a named text style, alignment and a colour from the look", () => {
    const scene = build(agentDeck(), text({ text: "A **b**", textStyle: "title", align: "center", color: "accent2" }))
    const written = get(lastChild(scene, slide), "text")!
    expect(written.style).toBe("title")
    expect(written.paras).toEqual([{ align: "center" }])
    expect(written.spans).toEqual([
      { end: 2, color: { var: "accent2" } },
      { end: 3, bold: true, color: { var: "accent2" } },
    ])
  })

  it("makes the first text in the title style the slide's title, and no later one", () => {
    let scene = build(agentDeck(), text({ textStyle: "title", box: { x: 0, y: 0, w: 900, h: 90 } }), minter("a"))
    scene = build(scene, text({ textStyle: "title", text: "Again", box: { x: 0, y: 200, w: 900, h: 90 } }), minter("b"))
    scene = build(scene, text({ textStyle: "heading", text: "Sub", box: { x: 0, y: 400, w: 900, h: 90 } }), minter("c"))
    expect(
      childrenOf(scene, slide)
        .slice(-3)
        .map((node) => get(node, "role")),
    ).toEqual(["title", undefined, undefined])
  })

  it("makes no node when the words are missing, naming the field", () => {
    expect(compileAgentChange(agentDeck(), { op: "add", kind: "text", slide }, minter())).toEqual({
      refused: "shape",
      field: "text",
      change: "add text",
    })
  })
})

describe("add shape", () => {
  it("fills with the first accent unless told otherwise, and carries no text", () => {
    const made = lastChild(
      build(agentDeck(), { op: "add", kind: "shape", slide, box: { x: 0, y: 0, w: 100, h: 100 } }),
      slide,
    )
    expect(get(made, "fills")).toEqual([{ kind: "solid", color: { var: "accent1" } }])
    expect(get(made, "text")).toBeUndefined()
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
    expect(get(made, "fills")).toBeUndefined()
    expect(get(made, "strokes")).toEqual([{ kind: "solid", color: { var: "text2" } }])
    expect(get(made, "stroke")).toEqual({ weight: 4, align: "inside", dash: "solid" })
    expect(get(made, "radius")).toBe(12)
  })

  it("centres words inside it and picks a colour that reads on an accent fill", () => {
    const made = lastChild(
      build(agentDeck(), { op: "add", kind: "shape", slide, text: "Decision", box: { x: 0, y: 0, w: 300, h: 80 } }),
      slide,
    )
    expect(get(made, "text")).toMatchObject({ resize: "fixed", alignV: "center" })
    expect(get(made, "text")?.paras).toEqual([{ align: "center" }])
    expect(get(made, "text")?.spans).toEqual([{ end: 8, color: { var: "background" } }])
  })
})

describe("add line", () => {
  it("writes a straight line between the corners of its box, with an arrowhead on request", () => {
    const made = lastChild(
      build(agentDeck(), { op: "add", kind: "line", slide, arrow: true, box: { x: 10, y: 20, w: 300, h: 0 } }),
      slide,
    )
    expect(get(made, "geometry")).toEqual({
      kind: "line",
      start: { x: 10, y: 20 },
      end: { x: 310, y: 20 },
      route: "straight",
      arrows: ["none", "arrow"],
    })
    expect(get(made, "strokes")).toEqual([{ kind: "solid", color: { var: "text2" } }])
    expect(get(made, "stroke")).toMatchObject({ weight: 3, align: "center" })
  })

  it("runs across the free area, level, when it has no box", () => {
    const made = lastChild(build(agentDeck(), { op: "add", kind: "line", slide }), slide)
    const box = get(made, "box")!
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
    expect(get(made, "layout")).toEqual({
      mode: "row",
      gap: 24,
      padding: { t: 16, r: 16, b: 16, l: 16 },
      align: "top-left",
    })
    expect(get(made, "fills")).toEqual([{ kind: "solid", color: { var: "background2" } }])
    expect(get(made, "radius")).toBe(20)
    expect(get(made, "effects")).toBe("soft")
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
    expect(get(made, "fills")).toEqual([{ kind: "image", asset: "https://x.test/a.png", fit: "fill" }])
    expect(get(made, "geometry")).toEqual({ kind: "rect" })
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
    expect(get(made, "geometry")).toEqual({ kind: "icon", name: "lucide/arrow-right" })
    expect(get(made, "strokes")).toEqual([{ kind: "solid", color: { var: "accent1" } }])
    expect(get(made, "stroke")).toEqual({ weight: 8, align: "center", dash: "solid" })
  })

  it("sizes an icon on its own when it has no box", () => {
    const box = get(
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
    const scene = build(agentDeck(), {
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
    const made = lastChild(scene, slide)
    expect(made.type).toBe("frame")
    expect(get(made, "chart")).toEqual({
      kind: "bar",
      categories: ["Q1", "Q2"],
      series: [
        { name: "Plan", values: [3, 4], color: { var: "accent2" } },
        { name: "Actual", values: [2, 5], color: hex(0x112233) },
      ],
      labels: true,
    })
    expect(get(made, "box")!.w).toBeGreaterThan(1000)
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
    let scene = build(agentDeck(), frame, mint)
    const card = lastChild(scene, slide).id
    scene = build(scene, { op: "add", kind: "text", slide, into: card, text: "Inside" }, mint)
    const inside = lastChild(scene, card)
    expect(get(inside, "parent")?.id).toBe(card)
    const box = get(inside, "box")!
    expect(box.x + box.w).toBeLessThanOrEqual(400)
    expect(box.y + box.h).toBeLessThanOrEqual(300)
  })

  it("puts words into a laid-out frame with no box, for the layout to place", () => {
    const mint = minter("a")
    let scene = build(agentDeck(), { ...frame, layout: "column", gap: 10 } as AgentChange, mint)
    const column = lastChild(scene, slide).id
    scene = build(scene, { op: "add", kind: "text", slide, into: column, text: "Row one" }, mint)
    const inside = lastChild(scene, column)
    expect(get(inside, "box")).toBeUndefined()
    expect(get(inside, "sizing")).toEqual({ w: "fill", h: "hug" })
  })

  it("asks for a box when a shape goes into a laid-out frame whose size nobody wrote", () => {
    const scene = build(
      agentDeck(),
      { op: "add", kind: "kpi", slide, items: [{ title: "A", value: "1" }] },
      minter("a"),
    )
    const card = childrenOf(scene, lastChild(scene, slide).id)[0]!
    expect(compileAgentChange(scene, { op: "add", kind: "shape", slide, into: card.id }, minter("b"))).toMatchObject({
      refused: "limit",
      field: "box",
    })
    const words = build(scene, { op: "add", kind: "text", slide, into: card.id, text: "Extra" }, minter("c"))
    expect(get(lastChild(words, card.id), "text")?.chars).toBe("Extra")
  })

  it("refuses to add into a chart, which draws its own", () => {
    const scene = build(
      agentDeck(),
      {
        op: "add",
        kind: "chart",
        slide,
        chart: { kind: "bar", categories: ["a"], series: [{ name: "s", values: [1] }] },
      },
      minter("a"),
    )
    expect(compileAgentChange(scene, text({ into: lastChild(scene, slide).id }), minter("b"))).toMatchObject({
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
    const scene = build(agentDeck(), full)
    expect(compileAgentChange(scene, text(), minter("b"))).toMatchObject({ refused: "limit", field: "box" })
    expect(compiled(scene, text({ box: { x: 0, y: 0, w: 10, h: 10 } }), minter("c"))).toBeTruthy()
  })

  it("puts the first slide's free area to use: the sample slide is the one it adds to", () => {
    expect(firstSlide(agentDeck())).toBe(slide)
  })
})
