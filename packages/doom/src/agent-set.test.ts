import { describe, expect, it } from "vitest"
import { readAgentChange, type AgentChange } from "./agent-change.js"
import { compileAgentChange } from "./agent-compile.js"
import { agentDeck, build, compiled, minter, more, richDeck, started } from "./agent-fixtures.js"
import { type Doom, type Write, applyEdit, isRefusal, rev } from "./index.js"
import { agent, ids, land, once, person, revOf, sampleDeck, textOf } from "./sample-deck.js"
import { propOf } from "./doom-walk.js"

const set = (target: string, look: Record<string, unknown>): AgentChange =>
  ({ op: "set", target, ...look }) as AgentChange
const applyAs = (doom: Doom, writes: readonly Write[]) =>
  applyEdit(doom, { once: once(), author: agent("run-1"), writes, rev: rev(doom.rev + 1) })
const refusal = (doom = richDeck(), change: AgentChange) => compileAgentChange(doom, change, minter())

describe("set by node id", () => {
  it("replaces the words with markdown and keeps the box's resizing, the style and the colour", () => {
    let doom = build(agentDeck(), set(ids.title, { text: "Plain", textStyle: "heading", color: "accent2" }))
    doom = build(doom, set(ids.title, { text: "Now **bold**" }))
    expect(propOf(doom.nodes.get(ids.title)!, "text")).toMatchObject({
      chars: "Now bold",
      style: "heading",
      resize: "height",
      spans: [
        { end: 4, color: { var: "accent2" } },
        { end: 8, bold: true, color: { var: "accent2" } },
      ],
    })
  })

  it("changes only the style when only the style is named", () => {
    const doom = build(agentDeck(), set(ids.title, { textStyle: "caption" }))
    expect(propOf(doom.nodes.get(ids.title)!, "text")).toMatchObject({ chars: "Revenue", style: "caption" })
  })

  it("makes the words the named style whole, as the panel does, so a person's size cannot cancel it", () => {
    const sized = { ...textOf("Revenue"), spans: [{ end: 7, size: 31, font: "Inter", italic: true }] }
    const typed = land(sampleDeck(), [
      { node: ids.title, prop: "text", value: sized, base: revOf(sampleDeck(), ids.title, "text")! },
    ])
    const doom = build(started(typed), set(ids.title, { textStyle: "heading" }))
    const text = propOf(doom.nodes.get(ids.title)!, "text")!
    expect(text.style).toBe("heading")
    expect(text.spans).toEqual([{ end: 7, italic: true }])
  })

  it("fades a shadow the way the panel does, and links or clips the layer", () => {
    const faded = build(agentDeck(), set(ids.card, { effect: "lifted", effectOpacity: 0.4 }))
    expect(propOf(faded.nodes.get(ids.card)!, "effects")).toEqual([
      { kind: "dropShadow", color: { var: "text" }, opacity: 0.4, x: 0, y: 12, blur: 32, spread: 0 },
    ])
    const linked = build(agentDeck(), set(ids.title, { link: "example.com/plan" }))
    expect(propOf(linked.nodes.get(ids.title)!, "link")).toBe("https://example.com/plan")
    const cleared = build(linked, set(ids.title, { link: "none" }))
    expect(propOf(cleared.nodes.get(ids.title)!, "link")).toBeUndefined()
    const clipped = build(richDeck(), set(more.chart, { clip: true }))
    expect(propOf(clipped.nodes.get(more.chart)!, "clip")).toBe(true)
  })

  it("writes paint, outline, radius, effect, opacity, name, hidden and box", () => {
    const doom = build(
      agentDeck(),
      set(ids.card, {
        fill: "accent3",
        stroke: "text",
        strokeWidth: 3,
        radius: 16,
        effect: "lifted",
        opacity: 0.5,
        name: "Revenue card",
        hidden: true,
        box: { x: 5, y: 6, w: 7, h: 8 },
      }),
    )
    expect(doom.nodes.get(ids.card)).toMatchObject({
      fills: [{ kind: "solid", color: { var: "accent3" } }],
      strokes: [{ kind: "solid", color: { var: "text" } }],
      stroke: { weight: 3, align: "inside", dash: "solid" },
      radius: 16,
      effects: "lifted",
      opacity: 0.5,
      name: "Revenue card",
      hidden: true,
      box: { x: 5, y: 6, w: 7, h: 8, rotation: 0 },
    })
  })

  it("inserts a linked run at an offset and leaves the other words and their look", () => {
    const bold = { ...textOf("Revenue"), spans: [{ end: 7, bold: true, color: { var: "accent2" } }] }
    const typed = land(sampleDeck(), [
      { node: ids.title, prop: "text", value: bold, base: revOf(sampleDeck(), ids.title, "text")! },
    ])
    const linked = { at: 3, text: "X", link: "https://example.com" }
    const doom = build(started(typed), set(ids.title, { insert: linked }))
    expect(propOf(doom.nodes.get(ids.title)!, "text")).toEqual({
      ...bold,
      chars: "RevXenue",
      spans: [
        { end: 3, bold: true, color: { var: "accent2" } },
        { end: 4, link: "https://example.com" },
        { end: 8, bold: true, color: { var: "accent2" } },
      ],
    })
    const end = build(doom, set(ids.title, { insert: { at: 99, text: "!", link: "mailto:a@b.co" } }))
    expect(propOf(end.nodes.get(ids.title)!, "text")?.chars).toBe("RevXenue!")
    expect(refusal(agentDeck(), set(ids.title, { text: "A", insert: linked }))).toMatchObject({
      refused: "shape",
      field: "insert",
    })
    expect(refusal(agentDeck(), set(ids.caption, { insert: linked }))).toMatchObject({
      refused: "shape",
      field: "insert",
    })
    expect(refusal(agentDeck(), set(ids.card, { insert: linked }))).toMatchObject({
      refused: "shape",
      field: "insert",
    })
    expect(refusal(richDeck(), set("*.title", { insert: linked }))).toMatchObject({
      refused: "shape",
      field: "insert",
    })
    expect(refusal(richDeck(), set(`${more.chart}#Plan:Q1`, { insert: linked }))).toMatchObject({
      refused: "shape",
      field: "insert",
    })
    expect(
      readAgentChange({ op: "set", target: ids.title, insert: { at: 0, text: "a\nb", link: "https://example.com" } }),
    ).toMatchObject({ refused: "shape" })
    expect(
      refusal(agentDeck(), { op: "add", kind: "text", slide: ids.slide, text: "Hi", insert: linked }),
    ).toMatchObject({ refused: "shape", field: "insert" })
  })

  it("locks and unlocks a layer, and refuses to lock a slide", () => {
    const locked = build(agentDeck(), set(ids.card, { locked: true }))
    expect(propOf(locked.nodes.get(ids.card)!, "locked")).toBe(true)
    const open = build(locked, set(ids.card, { locked: false }))
    expect(propOf(open.nodes.get(ids.card)!, "locked")).toBe(false)
    expect(refusal(agentDeck(), set(ids.slide, { locked: true }))).toMatchObject({ refused: "shape", field: "locked" })
  })

  it("turns a drawn layer into a rectangle, an ellipse or a named preset, and refuses an unknown outline", () => {
    const star = build(agentDeck(), set(ids.caption, { shape: "star5" }))
    expect(propOf(star.nodes.get(ids.caption)!, "geometry")).toEqual({ kind: "preset", name: "star5" })
    const round = build(star, set(ids.caption, { shape: "ellipse" }))
    expect(propOf(round.nodes.get(ids.caption)!, "geometry")).toEqual({ kind: "ellipse" })
    expect(propOf(build(round, set(ids.caption, { shape: "rect" })).nodes.get(ids.caption)!, "geometry")).toEqual({
      kind: "rect",
    })
    expect(readAgentChange({ op: "set", target: ids.caption, shape: "blob" })).toHaveProperty("refused")
    expect(() => build(agentDeck(), set(ids.card, { shape: "ellipse" }))).toThrow(/"field":"shape"/)
  })

  it("adds a shape with any outline Doom draws, as the toolbar does", () => {
    const writes = compiled(agentDeck(), { op: "add", kind: "shape", slide: ids.slide, shape: "star5" })
    expect(writes.find((write) => write.prop === "geometry")?.value).toEqual({ kind: "preset", name: "star5" })
    expect(readAgentChange({ op: "add", kind: "shape", slide: ids.slide, shape: "bentConnector3" })).toHaveProperty(
      "refused",
    )
  })

  it("clears paint with none and an effect with none", () => {
    let doom = build(agentDeck(), set(ids.card, { fill: "accent3", effect: "soft" }))
    doom = build(doom, set(ids.card, { fill: "none", effect: "none" }))
    expect(doom.nodes.get(ids.card)).toMatchObject({ fills: [], effects: [] })
  })

  it("keeps the outline style when only the colour changes", () => {
    let doom = build(agentDeck(), set(ids.card, { stroke: "text", strokeWidth: 6 }))
    doom = build(doom, set(ids.card, { stroke: "accent1" }))
    expect(propOf(doom.nodes.get(ids.card)!, "stroke")?.weight).toBe(6)
  })

  it("sets a frame's layout, then its gap and padding on their own, and refuses a gap with no layout", () => {
    let doom = build(agentDeck(), set(ids.card, { layout: "column", gap: 10 }))
    expect(propOf(doom.nodes.get(ids.card)!, "layout")).toEqual({
      mode: "column",
      gap: 10,
      padding: { t: 0, r: 0, b: 0, l: 0 },
      align: "top-left",
    })
    doom = build(doom, set(ids.card, { padding: 12, align: "center" }))
    expect(propOf(doom.nodes.get(ids.card)!, "layout")).toMatchObject({
      gap: 10,
      padding: { t: 12, r: 12, b: 12, l: 12 },
      align: "top-center",
    })
    expect(refusal(agentDeck(), set(ids.side, { gap: 5 }))).toMatchObject({ refused: "shape", field: "gap" })
  })

  it("changes an icon's name, a line's arrowhead and ends, and a chart's data", () => {
    const doom = build(
      build(
        build(richDeck(), set(more.icon, { icon: "check", stroke: "accent2" })),
        set(more.line, { arrow: true, box: { x: 0, y: 0, w: 50, h: 50 } }),
      ),
      set(more.chart, { chart: { kind: "line", categories: ["a"], series: [{ name: "s", values: [1] }] } }),
    )
    expect(propOf(doom.nodes.get(more.icon)!, "geometry")).toEqual({ kind: "icon", name: "lucide/check" })
    expect(propOf(doom.nodes.get(more.line)!, "geometry")).toEqual({
      kind: "line",
      start: { x: 0, y: 0 },
      end: { x: 50, y: 50 },
      route: "straight",
      arrows: ["none", "arrow"],
    })
    expect(propOf(doom.nodes.get(more.chart)!, "chart")).toMatchObject({ kind: "line" })
  })

  it("refuses a field the node does not take, naming node, field and change", () => {
    expect(refusal(richDeck(), set(ids.card, { text: "x" }))).toEqual({
      refused: "shape",
      node: ids.card,
      field: "text",
      change: `set ${ids.card}`,
    })
    expect(refusal(richDeck(), set(ids.title, { icon: "x" }))).toMatchObject({ field: "icon" })
    expect(
      refusal(
        richDeck(),
        set(ids.title, { chart: { kind: "bar", categories: ["a"], series: [{ name: "s", values: [1] }] } }),
      ),
    ).toMatchObject({ field: "chart" })
    expect(refusal(richDeck(), set(ids.title, { layout: "row" }))).toMatchObject({ field: "layout" })
    expect(refusal(richDeck(), set(ids.slide, { opacity: 0.5 }))).toMatchObject({ field: "opacity" })
    for (const field of ["rows", "items", "axes"])
      expect(refusal(richDeck(), set(ids.card, { [field]: field === "axes" ? ["a", "b"] : [[]] }))).toMatchObject({
        field,
      })
  })

  it("paints a slide's background", () => {
    const doom = build(agentDeck(), set(ids.slide, { fill: "background2" }))
    expect(propOf(doom.nodes.get(ids.slide)!, "fills")).toEqual([{ kind: "solid", color: { var: "background2" } }])
  })

  it("refuses a node that is not there or was deleted, naming the change", () => {
    expect(refusal(richDeck(), set("z:9", { name: "x" }))).toEqual({
      refused: "missing",
      node: "z:9",
      field: "target",
      change: "set z:9",
    })
    const gone = land(richDeck(), [{ node: ids.card, prop: "parent", value: null }])
    expect(refusal(gone, set(ids.card, { name: "x" }))).toMatchObject({ refused: "missing" })
  })
})

describe("set by role and by chart bar", () => {
  it("finds a slide's title by its role", () => {
    const doom = build(richDeck(), set(`${more.slide2}.title`, { text: "New title" }))
    expect(propOf(doom.nodes.get(more.titled)!, "text")?.chars).toBe("New title")
  })

  it("refuses a role the slide has no node for", () => {
    expect(refusal(richDeck(), set(`${more.slide2}.body`, { text: "x" }))).toEqual({
      refused: "missing",
      node: more.slide2,
      field: "target",
      change: `set ${more.slide2}.body`,
    })
    expect(refusal(richDeck(), set(`${ids.card}.title`, { text: "x" }))).toMatchObject({
      refused: "shape",
      field: "target",
    })
  })

  it("colours one bar by its derived id, and clears it with none", () => {
    const bar = `${more.chart}#Plan:Q2`
    let doom = build(richDeck(), set(bar, { fill: "accent3" }))
    expect(propOf(doom.nodes.get(more.chart)!, "chart")?.points).toEqual({ [bar]: { var: "accent3" } })
    doom = build(doom, set(bar, { fill: "none" }))
    expect(propOf(doom.nodes.get(more.chart)!, "chart")?.points).toEqual({})
  })

  it("refuses a bar the chart has not, a look beyond its colour, and a bar of a frame with no chart", () => {
    expect(refusal(richDeck(), set(`${more.chart}#Plan:Q9`, { fill: "accent3" }))).toMatchObject({
      refused: "missing",
      field: "target",
    })
    expect(refusal(richDeck(), set(`${more.chart}#Plan:Q1`, { opacity: 0.5 }))).toMatchObject({
      refused: "shape",
      field: "opacity",
    })
    expect(
      refusal(richDeck(), set(`${more.chart}#Plan:Q1`, { fill: { image: "https://x.test/a.png" } })),
    ).toMatchObject({ field: "fill" })
    expect(refusal(richDeck(), set(`${ids.card}#Plan:Q1`, { fill: "accent3" }))).toMatchObject({
      refused: "shape",
      field: "target",
    })
  })
})

describe("what the agent read", () => {
  it("sends the rev it read as the base of a text write", () => {
    const doom = richDeck()
    const writes = compiled(doom, set(ids.title, { text: "x" }))
    expect(writes).toEqual([
      expect.objectContaining({ node: ids.title, prop: "text", base: doom.revs.get(ids.title)!.get("text") }),
    ])
  })

  it("is refused stale when a person typed after the agent read, and person when during its run", () => {
    const read = sampleDeck()
    const later = started(
      land(
        read,
        [{ node: ids.title, prop: "text", value: textOf("Typed by a person"), base: revOf(read, ids.title, "text")! }],
        person,
      ),
    )
    const writes = compiled(later, set(ids.title, { text: "Agent words" }), minter(), { read })
    expect(applyAs(later, writes)).toMatchObject({ refused: "stale", node: ids.title, prop: "text" })
    expect(isRefusal(applyAs(later, compiled(later, set(ids.title, { text: "x" }))))).toBe(false)
    const open = richDeck()
    const during = land(
      open,
      [{ node: ids.title, prop: "text", value: textOf("Typed during"), base: revOf(open, ids.title, "text")! }],
      person,
    )
    expect(applyAs(during, compiled(during, set(ids.title, { text: "x" })))).toMatchObject({ refused: "person" })
  })

  it("writes a list prop with its base too, and a plain prop with none", () => {
    const doom = build(richDeck(), set(ids.card, { fill: "accent3" }))
    const [fills, name] = compiled(doom, set(ids.card, { fill: "accent4", name: "n" }))
    expect(fills).toMatchObject({ prop: "fills", base: doom.revs.get(ids.card)!.get("fills") })
    expect(name).not.toHaveProperty("base")
  })
})
