import { describe, expect, it } from "vitest"
import { planChange, registerScope, type SetChange } from "./change.js"
import { decide, openRegister, type Command, type Register } from "./decide.js"
import type { DeckIndex, IndexElement } from "./deck-index.js"
import { elementId, slideId } from "./element-id.js"
import { format } from "./format.js"
import { readTextValue, writeTextValue, type TextValue } from "./text-value.js"

const box = { x: 10, y: 20, cx: 300, cy: 400 }
const quarterly: TextValue = [
  {
    from: 0,
    runs: [
      { from: 0, text: "Quarterly" },
      { from: 1, text: " review", bold: true },
    ],
  },
  { from: 1, align: "left", runs: [{ from: 0, text: "Q3", color: { scheme: "tx1" } }] },
]

function shape(node: string, role: IndexElement["role"], value: string | null): IndexElement {
  return { node: elementId(node), kind: "shape", value, box, grouped: false, ...(role === undefined ? {} : { role }) }
}

const elements: readonly IndexElement[] = [
  shape("258.2", "title", writeTextValue(quarterly)),
  shape("258.3", "body", "Plain words"),
  { node: elementId("258.4"), kind: "picture", value: null, box, grouped: false, role: "picture" },
  { node: elementId("258.5"), kind: "shape", value: "", box, grouped: true },
  { ...shape("258.6", undefined, ""), kept: ["text.color"] },
  { ...shape("258.7", undefined, null), kept: ["fill"] },
  shape("259.2", "title", ""),
  { node: elementId("259.3"), kind: "table", value: "{}", box, grouped: false, role: "table" },
]

function indexed(index: Partial<DeckIndex> = {}): Register {
  const whole: DeckIndex = {
    format: 2,
    total: elements.length,
    slides: [
      { id: "258", position: 0 },
      { id: "259", position: 1 },
    ],
    elements,
    pages: [],
    ...index,
  }
  return { ...openRegister("", "deck"), index: whole }
}

function plan(change: SetChange, register: Register = indexed()) {
  return planChange(change, registerScope(register))
}

function textOf(planned: ReturnType<typeof plan>, at = 0): TextValue | null {
  if (!planned.ok) return null
  const edit = planned.rows[at]?.row.patch.text?.value
  return edit === undefined || typeof edit !== "object" ? null : readTextValue(edit.set)
}

describe("planChange names its elements by node, by role on one slide, or by role on every slide", () => {
  it("writes one row on a node target, with the whole current box around the sides it names", () => {
    const whole = { x: { set: 914_400 }, y: { set: 20 }, w: { set: 12_700 }, h: { set: 400 } }
    expect(plan({ target: { node: elementId("258.3") }, box: { x: 914_400, w: 12_700 } })).toEqual({
      ok: true,
      rows: [{ node: "258.3", row: { v: format, patch: { box: whole } } }],
    })
    const moved = moved258(indexed(), { x: 1, y: 2, cx: 3, cy: 4 })
    const planned = plan({ target: { node: elementId("258.3") }, box: { y: 7 } }, moved)
    expect(planned.ok && planned.rows[0]?.row.patch.box).toEqual({
      x: { set: 1 },
      y: { set: 7 },
      w: { set: 3 },
      h: { set: 4 },
    })
  })

  it("moves a table by its sides x and y", () => {
    const planned = plan({ target: { node: elementId("259.3") }, box: { x: 5 } })
    expect(planned.ok && planned.rows[0]?.row.patch.box).toEqual({
      x: { set: 5 },
      y: { set: 20 },
      w: { set: 300 },
      h: { set: 400 },
    })
    const decision = decide(
      applied(indexed(), [{ command: "add", node: elementId("259.3"), floor: "", route: "deck" }]),
      {
        command: "person",
        node: elementId("259.3"),
        v: format,
        patch: planned.ok ? (planned.rows[0]?.row.patch ?? {}) : {},
      },
    )
    expect(decision.decision).toBe("apply")
  })

  it("reaches the element with the role on one slide", () => {
    const planned = plan({ target: { role: "title", slide: slideId("259") }, text: { value: "Plan" } })
    expect(planned).toEqual({
      ok: true,
      rows: [{ node: "259.2", row: { v: format, patch: { text: { value: { set: "Plan" } } } } }],
    })
  })

  it("reaches every element with the role, slide by slide in deck order", () => {
    const planned = plan({ target: { role: "title", slide: "every" }, text: { color: { scheme: "accent1" } } })
    expect(planned.ok && planned.rows.map((row) => row.node)).toEqual(["258.2", "259.2"])
  })

  it("skips a slide that was deleted", () => {
    const register = deleted(indexed(), "259")
    const planned = plan({ target: { role: "title", slide: "every" }, text: { bold: true } }, register)
    expect(planned.ok && planned.rows.map((row) => row.node)).toEqual(["258.2"])
  })
})

describe("text inputs rewrite every run of the element's current text", () => {
  it("sets colour, size and format on every run and align and bullet on every paragraph", () => {
    const planned = plan({
      target: { node: elementId("258.2") },
      text: { color: { scheme: "accent1" }, size: 3_600, italic: true, align: "center", bullet: false },
    })
    const run = { color: { scheme: "accent1" }, size: 3_600, italic: true }
    expect(textOf(planned)).toEqual([
      {
        from: 0,
        align: "center",
        bullet: false,
        runs: [
          { from: 0, text: "Quarterly", ...run },
          { from: 1, text: " review", bold: true, ...run },
        ],
      },
      { from: 1, align: "center", bullet: false, runs: [{ from: 0, text: "Q3", ...run }] },
    ])
  })

  it("starts from text the change sets, then from what the register holds, then from the file", () => {
    expect(textOf(plan({ target: { node: elementId("258.3") }, text: { value: "Sent", bold: true } }))).toEqual([
      { from: 0, runs: [{ from: 0, text: "Sent", bold: true }] },
    ])
    expect(textOf(plan({ target: { node: elementId("258.3") }, text: { underline: true } }))).toEqual([
      { from: 0, runs: [{ from: 0, text: "Plain words", underline: true }] },
    ])
    const register = typed(indexed(), "258.3", "Typed")
    expect(textOf(plan({ target: { node: elementId("258.3") }, text: { bold: false } }, register))).toEqual([
      { from: 0, runs: [{ from: 0, text: "Typed", bold: false }] },
    ])
  })

  it("leaves empty text empty", () => {
    const planned = plan({ target: { node: elementId("259.2") }, text: { color: { rgb: "1F4E79" } } })
    expect(planned.ok && planned.rows[0]?.row.patch).toEqual({ text: { value: { set: "" } } })
  })
})

describe("planChange refuses the whole change and names every element it cannot take", () => {
  it("refuses a trait the kind does not take as kind, and a grouped box as group-box", () => {
    expect(plan({ target: { node: elementId("258.4") }, text: { bold: true } })).toEqual({
      ok: false,
      refusals: [{ node: "258.4", trait: "text", code: "kind" }],
    })
    expect(plan({ target: { node: elementId("258.5") }, box: { x: 0 } })).toEqual({
      ok: false,
      refusals: [{ node: "258.5", trait: "box", code: "group-box" }],
    })
    expect(plan({ target: { role: "table", slide: slideId("259") }, box: { rot: 30 } })).toEqual({
      ok: false,
      refusals: [{ node: "259.3", trait: "box", code: "kind" }],
    })
  })

  it("refuses a field the index keeps as kept", () => {
    expect(plan({ target: { node: elementId("258.6") }, text: { color: { scheme: "accent2" } } })).toEqual({
      ok: false,
      refusals: [{ node: "258.6", trait: "text", code: "kept" }],
    })
  })

  it("fills a shape whose picture fill it keeps, since a fill replaces the whole slot", () => {
    const solid = { solid: { scheme: "accent2" } } as const
    expect(plan({ target: { node: elementId("258.7") }, fill: { value: solid } })).toEqual({
      ok: true,
      rows: [{ node: "258.7", row: { v: format, patch: { fill: { value: { set: solid } } } } }],
    })
  })

  it("writes null on a field that inherits as a way back to the inherited value, and refuses it elsewhere", () => {
    expect(plan({ target: { role: "title", slide: "every" }, fill: { value: null } })).toEqual({
      ok: true,
      rows: [
        { node: "258.2", row: { v: format, patch: { fill: { value: "inherit" } } } },
        { node: "259.2", row: { v: format, patch: { fill: { value: "inherit" } } } },
      ],
    })
    const boxed = { target: { node: elementId("258.3") }, box: { x: null } } as unknown as SetChange
    expect(plan(boxed)).toEqual({ ok: false, refusals: [{ node: "258.3", trait: "box", code: "kind" }] })
    expect(plan({ target: { node: elementId("258.4") }, fill: { value: { none: true } } })).toEqual({
      ok: false,
      refusals: [{ node: "258.4", trait: "fill", code: "kind" }],
    })
  })

  it("refuses a role target before the index holds roles as indexing", () => {
    expect(plan({ target: { role: "title", slide: "every" }, text: { bold: true } }, indexed({ format: 1 }))).toEqual({
      ok: false,
      refusals: [{ node: null, trait: null, code: "indexing" }],
    })
    expect(plan({ target: { role: "title", slide: "every" }, text: { bold: true } }, indexed({ total: 99 }))).toEqual({
      ok: false,
      refusals: [{ node: null, trait: null, code: "indexing" }],
    })
  })

  it("refuses a node the deck does not hold, and a role no element has, as dead", () => {
    expect(plan({ target: { node: elementId("258.99") }, box: { x: 0 } })).toEqual({
      ok: false,
      refusals: [{ node: "258.99", trait: null, code: "dead" }],
    })
    expect(plan({ target: { role: "footer", slide: "every" }, box: { x: 0 } })).toEqual({
      ok: false,
      refusals: [{ node: null, trait: null, code: "dead" }],
    })
    expect(plan({ target: { node: elementId("259.2") }, box: { x: 0 } }, deleted(indexed(), "259"))).toEqual({
      ok: false,
      refusals: [{ node: "259.2", trait: null, code: "dead" }],
    })
  })

  it("lists every refusal at once", () => {
    const planned = plan({ target: { role: "picture", slide: "every" }, text: { bold: true }, box: { x: 0 } })
    expect(planned).toEqual({ ok: false, refusals: [{ node: "258.4", trait: "text", code: "kind" }] })
    const both = plan({ target: { node: elementId("258.5") }, text: { value: "x" }, box: { x: 0 } })
    expect(both).toEqual({ ok: false, refusals: [{ node: "258.5", trait: "box", code: "group-box" }] })
  })
})

function deleted(register: Register, id: string): Register {
  const file = (register.index?.slides ?? []).map((slide) => slideId(slide.id))
  const decision = decide(register, { command: "slide", file, edit: { slide: "remove", id: slideId(id) } })
  if (decision.decision === "refuse") throw new Error(decision.code)
  return decision.register
}

function typed(register: Register, node: string, value: string): Register {
  const id = elementId(node)
  let current = register
  for (const command of [
    { command: "add" as const, node: id, floor: "", route: "deck" },
    { command: "person" as const, node: id, value },
  ]) {
    const decision = decide(current, command)
    if (decision.decision === "refuse") throw new Error(decision.code)
    current = decision.register
  }
  return current
}

function applied(register: Register, commands: readonly Command[]): Register {
  return commands.reduce((current, command) => {
    const decision = decide(current, command)
    if (decision.decision === "refuse") throw new Error(decision.code)
    return decision.register
  }, register)
}

function moved258(register: Register, box: { x: number; y: number; cx: number; cy: number }): Register {
  const node = elementId("258.3")
  return applied(register, [
    { command: "add", node, floor: "", route: "deck" },
    { command: "person", node, property: "box", value: box },
  ])
}

describe("a slide's own node takes fill, which PowerPoint calls the background", () => {
  const solid = { solid: { scheme: "accent2" } } as const

  it("reaches the slide's own node from a slide target", () => {
    expect(plan({ target: { slide: slideId("259") }, fill: { value: solid } })).toEqual({
      ok: true,
      rows: [{ node: "259.slide", row: { v: format, patch: { fill: { value: { set: solid } } } } }],
    })
    expect(plan({ target: { node: elementId("258.slide") }, fill: { value: null } })).toEqual({
      ok: true,
      rows: [{ node: "258.slide", row: { v: format, patch: { fill: { value: "inherit" } } } }],
    })
  })

  it("lands the row on the slide's node and refuses text there", () => {
    const node = elementId("258.slide")
    const opened = applied(indexed(), [{ command: "add", node, floor: "", route: "deck" }])
    const planned = plan({ target: { slide: slideId("258") }, fill: { value: solid } }, opened)
    if (!planned.ok) throw new Error("plan")
    expect(decide(opened, { command: "person", node, ...(planned.rows[0]?.row ?? { v: 0, patch: {} }) }).decision).toBe(
      "apply",
    )
    expect(decide(opened, { command: "person", node, value: "words" })).toEqual({ decision: "refuse", code: "kind" })
    expect(plan({ target: { slide: slideId("258") }, text: { value: "words" } })).toEqual({
      ok: false,
      refusals: [{ node: "258.slide", trait: "text", code: "kind" }],
    })
  })

  it("keeps the speaker notes node to its notes", () => {
    expect(plan({ target: { node: elementId("258.notes") }, fill: { value: solid } })).toEqual({
      ok: false,
      refusals: [{ node: "258.notes", trait: "fill", code: "kind" }],
    })
    expect(plan({ target: { node: elementId("258.notes") }, notes: { value: "Say this" } }).ok).toBe(true)
  })

  it("finds no slide that was deleted or never was", () => {
    const refused = { ok: false, refusals: [{ node: null, trait: null, code: "dead" }] }
    expect(plan({ target: { slide: slideId("259") }, fill: { value: solid } }, deleted(indexed(), "259"))).toEqual(
      refused,
    )
    expect(plan({ target: { slide: slideId("300") }, fill: { value: solid } })).toEqual(refused)
  })
})

describe("box inputs align and distribute the elements a target names on each slide", () => {
  const wide = { width: 1_000, height: 500 }
  const slide = (id: string, position: number) => ({ id, position, size: wide })
  const body = (node: string, x: number, y: number, cx: number): IndexElement => ({
    ...shape(node, "body", ""),
    box: { x, y, cx, cy: 50 },
  })
  const bodies = [body("260.2", 400, 10, 100), body("260.3", 100, 200, 50), body("260.4", 700, 90, 100)]
  const sized = (more: readonly IndexElement[] = []) =>
    indexed({
      total: elements.length + more.length,
      slides: [slide("258", 0), slide("259", 1), slide("260", 2)],
      elements: [...elements, ...more],
    })
  const placed = (planned: ReturnType<typeof plan>) =>
    planned.ok
      ? planned.rows.map(({ node, row }) => {
          const { x, y } = row.patch.box ?? {}
          return [
            node,
            x !== undefined && x !== "inherit" && x !== "opening" ? x.set : null,
            y !== undefined && y !== "inherit" && y !== "opening" ? y.set : null,
          ]
        })
      : planned

  it("aligns a lone element to its slide, so every title can be centred on its own slide", () => {
    const planned = plan({ target: { role: "title", slide: "every" }, box: { align: "center" } }, sized())
    expect(placed(planned)).toEqual([
      ["258.2", 350, 20],
      ["259.2", 350, 20],
    ])
    expect(planned.ok && planned.rows[0]?.row.patch.box).toEqual({
      x: { set: 350 },
      y: { set: 20 },
      w: { set: 300 },
      h: { set: 400 },
    })
    expect(placed(plan({ target: { node: elementId("258.2") }, box: { align: "bottom" } }, sized()))).toEqual([
      ["258.2", 10, 100],
    ])
  })

  it("aligns several elements on one slide to the edges and centres of their own bounds", () => {
    const target = { role: "body", slide: slideId("260") } as const
    expect(placed(plan({ target, box: { align: "left" } }, sized(bodies)))).toEqual([
      ["260.2", 100, 10],
      ["260.3", 100, 200],
      ["260.4", 100, 90],
    ])
    expect(placed(plan({ target, box: { align: "middle" } }, sized(bodies)))).toEqual([
      ["260.2", 400, 105],
      ["260.3", 100, 105],
      ["260.4", 700, 105],
    ])
  })

  it("spaces several elements with equal gaps between the outer two, and centres a lone one on its slide", () => {
    const target = { role: "body", slide: slideId("260") } as const
    expect(placed(plan({ target, box: { distribute: "horizontal" } }, sized(bodies)))).toEqual([
      ["260.2", 375, 10],
      ["260.3", 100, 200],
      ["260.4", 700, 90],
    ])
    expect(placed(plan({ target, box: { distribute: "vertical" } }, sized(bodies)))).toEqual([
      ["260.2", 400, 10],
      ["260.3", 100, 200],
      ["260.4", 700, 105],
    ])
    expect(placed(plan({ target: { node: elementId("258.3") }, box: { distribute: "vertical" } }, sized()))).toEqual([
      ["258.3", 10, 50],
    ])
  })

  it("aligns a placeholder by the box its layout gives it, and writes that box as its own", () => {
    const inherited = { ...shape("260.6", "title", ""), box: null, placed: { x: 100, y: 30, cx: 600, cy: 80 } }
    const planned = plan({ target: { node: elementId("260.6") }, box: { align: "right" } }, sized([inherited]))
    expect(planned.ok && planned.rows[0]?.row.patch.box).toEqual({
      x: { set: 400 },
      y: { set: 30 },
      w: { set: 600 },
      h: { set: 80 },
    })
    const lost: IndexElement = { ...shape("260.7", "title", ""), box: null }
    expect(plan({ target: { node: elementId("260.7") }, box: { align: "right" } }, sized([lost]))).toEqual({
      ok: false,
      refusals: [{ node: "260.7", trait: "box", code: "kind" }],
    })
  })

  it("moves a table by x and y, and refuses a grouped element's box", () => {
    expect(placed(plan({ target: { node: elementId("259.3") }, box: { align: "right" } }, sized()))).toEqual([
      ["259.3", 700, 20],
    ])
    expect(plan({ target: { node: elementId("258.5") }, box: { align: "left" } }, sized())).toEqual({
      ok: false,
      refusals: [{ node: "258.5", trait: "box", code: "group-box" }],
    })
  })

  it("turns and flips with the whole current box around them", () => {
    const planned = plan({ target: { node: elementId("258.3") }, box: { rot: 5_400_000, flipH: true } })
    expect(planned.ok && planned.rows[0]?.row.patch.box).toEqual({
      x: { set: 10 },
      y: { set: 20 },
      w: { set: 300 },
      h: { set: 400 },
      rot: { set: 5_400_000 },
      flipH: { set: true },
    })
    expect(plan({ target: { node: elementId("259.3") }, box: { rot: 5_400_000 } })).toEqual({
      ok: false,
      refusals: [{ node: "259.3", trait: "box", code: "kind" }],
    })
  })

  it("picks a preset for a kept custom geometry, since a preset replaces the whole slot", () => {
    const custom = { ...shape("260.5", undefined, null), kept: ["geometry"] as const }
    const shapeValue = { preset: "triangle", adjust: { adj: 25_000 } } as const
    const planned = plan({ target: { node: elementId("260.5") }, geometry: { shape: shapeValue } }, sized([custom]))
    expect(planned.ok && planned.rows[0]?.row.patch).toEqual({ geometry: { shape: { set: shapeValue } } })
  })
})
