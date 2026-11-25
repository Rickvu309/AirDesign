import { describe, expect, it } from "vitest"
import { defaultTheme, resolveSlide, solveLayout } from "../index.js"
import { architectureComponent, cycleComponent, processComponent } from "./index.js"
import architecture from "./testing/architecture.json" with { type: "json" }
import cycle from "./testing/cycle.json" with { type: "json" }
import { ends, expand, keyed, measure, resolvedById, role } from "./testing/diagram-tree.js"
import { landTree } from "./testing/land-tree.js"
import process from "./testing/process.json" with { type: "json" }

const steps = (count: number, label = (i: number) => `Step ${i + 1}`) => ({
  steps: Array.from({ length: count }, (_, i) => ({ id: `s${i}`, label: label(i) })),
})
describe("process diagram", () => {
  it.each([3, 4, 5, 6, 7, 8])("lays %i steps in an auto layout row joined by attached connectors", (count) => {
    const tree = expand(processComponent, { frame: process.frame, data: steps(count) })
    const cards = role(tree, "step")
    expect(cards).toHaveLength(count)
    expect(role(tree, "connector")).toHaveLength(count - 1)
    expect(tree.props.layout).toMatchObject({ mode: "row", align: "center-center" })
    for (const [i, card] of cards.slice(0, -1).entries()) {
      expect(ends(keyed(tree, "connector", `s${i}`))).toEqual({
        start: { node: card.id, site: "r" },
        end: { node: cards[i + 1]!.id, site: "l" },
        route: "straight",
      })
    }
    expect(tree.findings.filter(({ kind }) => kind === "text-fit")).toEqual([])
  })

  it("shortens a long description and keeps the duration below it", () => {
    const description = "Consolidate feedback across customer segments and operating teams"
    const tree = expand(processComponent, {
      frame: process.frame,
      data: { steps: steps(8).steps.map((step, i) => (i === 0 ? { ...step, description, note: "2 weeks" } : step)) },
    })
    const card = keyed(tree, "step", "s0")
    const { doom, slide } = landTree(tree)
    const lines = resolvedById(resolveSlide(doom, slide, measure))
      .get(card.id)!
      .text!.lines.map((line) => line.runs.map((run) => run.text).join(""))
    expect(lines).toHaveLength(6)
    expect(lines[4]).toMatch(/…$/)
    expect(lines[5]).toBe("2 weeks")
    expect(card.props.text?.chars).toContain(description)
    const finding = tree.findings.find((finding) => finding.kind === "text-fit")
    expect(finding).toMatchObject({ key: card.key })
    expect(finding?.neededWidth).toBeGreaterThan(card.props.box.w)
    const text = card.props.text
    if (!text || !finding) throw new Error("Expected shortened text")
    const lineCount = (width: number) =>
      measure(text, defaultTheme, width).lines.filter(
        (line) => line.start >= 10 && line.start < text.chars.lastIndexOf("\n"),
      ).length
    expect(lineCount(finding.neededWidth)).toBeLessThanOrEqual(3)
    expect(lineCount(finding.neededWidth - 1)).toBeGreaterThan(3)
  })

  it("stores each step where the frame's auto layout paints it", () => {
    for (const variant of [{ direction: "row" }, { direction: "column" }]) {
      const frame = variant.direction === "row" ? process.frame : { x: 600, y: 160, w: 720, h: 800 }
      const tree = expand(processComponent, { frame, data: steps(5), variant })
      const { doom, slide } = landTree(tree)
      const boxes = solveLayout(doom, slide, measure)
      for (const card of role(tree, "step")) {
        const solved = boxes.get(card.id)
        const stored = card.props.box
        expect(Math.abs((solved?.x ?? NaN) - stored.x)).toBeLessThanOrEqual(1)
        expect(Math.abs((solved?.y ?? NaN) - stored.y)).toBeLessThanOrEqual(1)
        expect([solved?.w, solved?.h]).toEqual([stored.w, stored.h])
      }
    }
  })

  it("stacks a column process with connectors from bottom to top", () => {
    const tree = expand(processComponent, {
      frame: { x: 600, y: 160, w: 720, h: 800 },
      data: steps(4),
      variant: { direction: "column" },
    })
    const [first, second] = role(tree, "step")
    expect(tree.props.layout).toMatchObject({ mode: "column" })
    expect(ends(keyed(tree, "connector", "s0"))).toMatchObject({
      start: { node: first!.id, site: "b" },
      end: { node: second!.id, site: "t" },
    })
    expect(second!.props.box.y).toBeGreaterThan(first!.props.box.y + first!.props.box.h)
  })

  it("shrinks every step label together when one label is long", () => {
    const tree = expand(processComponent, {
      frame: process.frame,
      data: steps(6, (i) => (i === 2 ? "Validate the operating model" : `Step ${i + 1}`)),
    })
    const cards = role(tree, "step")
    expect(cards).toHaveLength(6)
    expect(new Set(cards.map((card) => card.props.text?.spans[1]?.size))).toEqual(new Set([26]))
    expect(tree.findings.filter(({ kind }) => kind === "text-fit")).toEqual([])
  })

  it.each([3, 4, 5, 6, 7, 8])("fits %i steps in a column", (count) => {
    const tree = expand(processComponent, {
      frame: { x: 600, y: 160, w: 720, h: 800 },
      data: steps(count),
      variant: { direction: "column" },
    })
    expect(tree.findings.filter(({ kind }) => kind === "text-fit")).toEqual([])
    expect(role(tree, "step")).toHaveLength(count)
  })

  it("accents only the first step and shows a duration when provided", () => {
    const tree = expand(processComponent, {
      frame: process.frame,
      data: { steps: steps(3).steps.map((step, i) => (i === 0 ? { ...step, note: "2 weeks" } : step)) },
    })
    const [first, ...rest] = role(tree, "step")
    expect(first?.props.text?.chars).toBe("01\nStep 1\n2 weeks")
    expect(first?.props.text?.spans[0]?.color).toEqual({ var: "accent1" })
    expect(rest.map((card) => card.props.text?.spans[0]?.color)).toEqual([{ var: "text2" }, { var: "text2" }])
  })

  it("moves the accent to the focused step", () => {
    const tree = expand(processComponent, { frame: process.frame, data: steps(4), tokens: { focus: "s2" } })
    const cards = role(tree, "step")
    expect(cards.map((card) => card.props.text?.spans[0]?.color)).toEqual([
      { var: "text2" },
      { var: "text2" },
      { var: "accent1" },
      { var: "text2" },
    ])
    expect(new Set(cards.map((card) => card.props.text?.spans[0]?.size)).size).toBe(1)
  })

  it("suggests two diagrams for a six-step process while keeping all six cards", () => {
    const tree = expand(processComponent, { frame: process.frame, data: steps(6) })
    expect(role(tree, "step")).toHaveLength(6)
    expect(tree.findings).toEqual([
      {
        kind: "advice",
        field: "advice[0].when",
        key: ["root"],
        code: "many-steps",
        note: "Split the steps across two process diagrams.",
      },
    ])
  })

  it("paints the step number, title and optional description", () => {
    const tree = expand(processComponent, {
      ...process,
      data: {
        steps: [
          { id: "first", label: "Discover", description: "Map needs" },
          { id: "next", label: "Define" },
        ],
      },
    })
    expect(keyed(tree, "step", "first").props.text?.chars).toBe("01\nDiscover\nMap needs")
    expect(keyed(tree, "step", "next").props.text?.chars).toBe("02\nDefine")
  })

  it.each(["process", "cycle", "architecture"])(
    "keeps an impossible %s label editable and paints an ellipsis inside the card",
    (name) => {
      const label = "W".repeat(120)
      const [tree, key, connectors] =
        name === "architecture"
          ? [
              expand(architectureComponent, {
                ...architecture,
                data: {
                  ...architecture.data,
                  components: architecture.data.components.map((c) => (c.id === "gateway" ? { ...c, name: label } : c)),
                },
              }),
              ["component", "gateway"],
              9,
            ]
          : name === "process"
            ? [
                expand(processComponent, { frame: process.frame, data: steps(8, (i) => (i === 4 ? label : "Step")) }),
                ["step", "s4"],
                7,
              ]
            : [
                expand(cycleComponent, { frame: cycle.frame, data: steps(6, (i) => (i === 4 ? label : "Step")) }),
                ["step", "s4"],
                6,
              ]
      const card = keyed(tree, ...key)
      expect(card.props.text?.chars).toContain(label)
      const { doom, slide } = landTree(tree)
      const painted = resolvedById(resolveSlide(doom, slide, measure)).get(card.id)
      expect(painted?.text?.lines.map(({ runs }) => runs.map(({ text }) => text).join("")).join("\n")).toMatch(/…$/)
      expect(
        painted?.text?.sourceLines
          ?.at(-1)
          ?.runs.map(({ text }) => text)
          .join(""),
      ).toBe(label)
      for (const line of painted?.text?.lines ?? []) {
        expect(line.ink).toBeLessThanOrEqual(line.w)
        expect(line.y + line.h).toBeLessThanOrEqual(card.props.box.h)
      }
      expect(role(tree, name === "architecture" ? "link" : "connector")).toHaveLength(connectors)
      expect(tree.findings.filter(({ kind }) => kind === "text-fit")).toMatchObject([{ kind: "text-fit", key }])
    },
  )

  it("draws nothing for an empty process", () => {
    expect(expand(processComponent, { frame: process.frame, data: steps(0) }).children).toEqual([])
  })
})

describe("cycle diagram", () => {
  it.each([3, 4, 5, 6])("places %i steps around the frame and closes the loop", (count) => {
    const tree = expand(cycleComponent, { frame: cycle.frame, data: steps(count) })
    const cards = role(tree, "step")
    expect(cards).toHaveLength(count)
    expect(role(tree, "connector")).toHaveLength(count)
    const top = cards[0]!.props.box
    expect(top.y).toBe(0)
    expect(Math.abs(top.x + top.w / 2 - cycle.frame.w / 2)).toBeLessThanOrEqual(1)
    for (const [i, card] of cards.entries()) {
      const { start, end } = ends(keyed(tree, "connector", `s${i}`))
      expect(start.node).toBe(card.id)
      expect(end.node).toBe(cards[(i + 1) % count]!.id)
      expect(start.node).not.toBe(end.node)
    }
    for (const [i, a] of cards.entries())
      for (const b of cards.slice(i + 1)) {
        const apart =
          a.props.box.x + a.props.box.w <= b.props.box.x ||
          b.props.box.x + b.props.box.w <= a.props.box.x ||
          a.props.box.y + a.props.box.h <= b.props.box.y ||
          b.props.box.y + b.props.box.h <= a.props.box.y
        expect(apart, `${a.key.join("/")} overlaps ${b.key.join("/")}`).toBe(true)
      }
  })

  it("leaves each card along the turn of the cycle", () => {
    const tree = expand(cycleComponent, cycle)
    const sites = ["plan", "build", "measure", "learn"].map((id) => {
      const { start, end } = ends(keyed(tree, "connector", id))
      return `${start.site}${end.site}`
    })
    expect(sites).toEqual(["rt", "br", "lb", "tl"])
    expect(ends(keyed(tree, "connector", "plan")).route).toBe("curve")
  })

  it("draws straight connectors as a variant", () => {
    const tree = expand(cycleComponent, { ...cycle, variant: { route: "straight" } })
    expect(role(tree, "connector").map((node) => ends(node).route)).toEqual(Array(4).fill("straight"))
  })
})
