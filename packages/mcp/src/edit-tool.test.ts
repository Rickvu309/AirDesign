import { catalog, projectTools } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { emptyLog, callTool, type Session } from "./index.js"
import { memoryDecks } from "./testing/memory-decks.js"

const names = Object.fromEntries(projectTools(catalog).map((tool) => [tool.op, tool.name])) as Record<string, string>

const start = () => doom.doomFromTree({ theme: doom.defaultTheme, slides: [{ name: "Title", children: [] }] }).doom

function agent() {
  const decks = memoryDecks(start)
  let minted = 0
  let calls = 0
  const session: Session = { agent: "aira", mint: () => `minted${String((minted += 1))}`, log: emptyLog(), now: 0 }
  const call = (op: string, args: unknown) => {
    session.once = `call${String((calls += 1))}`
    return callTool(names[op] ?? op, args, session, decks)
  }
  return { decks, call }
}

describe("edit_deck refusals", () => {
  it("refuses a move into a frame inside one an earlier change deleted, and says so in the answer", async () => {
    const by = agent()
    const { deck, slides } = (await by.call("create_deck", {})).answer as { deck: string; slides: string[] }
    const rev = () => by.decks.decks.get(deck as never)!.rev
    const frameIn = async (into?: string) => {
      const change = { op: "add", kind: "frame", slide: slides[0], ...(into === undefined ? {} : { into }) }
      const made = await by.call("edit_deck", { deck, base: rev(), changes: [change] })
      return (made.answer as { added: { id: string }[] }).added[0]!.id
    }
    const outer = await frameIn()
    const middle = await frameIn(outer)
    const inner = await frameIn(middle)
    const base = rev()
    const changes = [
      { op: "delete", nodes: [middle] },
      { op: "move", node: outer, into: inner },
    ]
    const refused = await by.call("edit_deck", { deck, base, changes })
    expect(refused.answer).toMatchObject({ ok: false, refusal: "dead", refused: "missing", at: 1, node: outer })
    expect(String(refused.answer.note)).toContain(`Change 2 (move ${outer})`)
    expect(String(refused.answer.note)).toContain("a frame above the frame you move the layer into")
    expect(rev()).toBe(base)
  })
})

const box = (x: number, y: number, w: number, h: number) => ({
  x,
  y,
  w,
  h,
  rotation: 0,
  flipH: false,
  flipV: false,
})
const estimate = doom.measureWith({})
const wide: doom.Measure = (text, theme, width) => {
  const measured = estimate(text, theme, width)
  return { ...measured, w: measured.w * 1.6 }
}

function drifted() {
  return doom.doomFromTree({
    theme: doom.defaultTheme,
    slides: [
      {
        children: [
          {
            type: "frame",
            name: "f",
            props: {
              box: box(100, 50, 1, 1),
              layout: { mode: "row", gap: 10, padding: { t: 20, r: 20, b: 20, l: 20 }, align: "top-left" },
              sizing: { w: "hug", h: "hug" },
            },
            children: [
              {
                type: "shape",
                name: "words",
                props: {
                  box: box(0, 0, 200, 100),
                  sizing: { w: "hug", h: "hug" },
                  text: { ...doom.textFromMarkdown("Hello world hello", "body"), resize: "widthAndHeight" },
                },
              },
              { type: "shape", name: "t", props: { box: box(0, 0, 100, 50) } },
            ],
          },
          {
            type: "shape",
            name: "l",
            props: (ids) => ({
              box: box(0, 0, 10, 10),
              geometry: {
                kind: "line" as const,
                start: { node: ids.t!, site: "l" as const },
                end: { x: 5, y: 5 },
                route: "straight" as const,
                arrows: ["none", "none"] as const,
              },
            }),
          },
        ],
      },
    ],
  })
}

function painted(view: doom.Doom, slide: doom.NodeId, line: doom.NodeId, measure: doom.Measure) {
  const nodes = doom.resolveSlide(view, slide, measure)
  let found: doom.Resolved | undefined
  const walk = (list: readonly doom.Resolved[]) => {
    for (const node of list) {
      if (node.id === line) found = node
      walk(node.children)
    }
  }
  walk(nodes)
  if (found?.geometry?.kind !== "line") throw new Error("no line")
  return { x: found.box.x + found.geometry.from.x, y: found.box.y + found.geometry.from.y }
}

function connected(grown: ReturnType<typeof drifted>, measureOf: (fold: doom.Doom) => doom.Measure) {
  const decks = memoryDecks(() => grown.doom)
  const host = {
    ...decks,
    measure: async (fold: doom.Doom) => ({ measure: measureOf(fold), missing: new Set<string>() }),
  }
  let calls = 0
  const session: Session = { agent: "aira", mint: () => "m", log: emptyLog(), now: 0 }
  const call = (op: string, args: unknown) => {
    session.once = `call${String((calls += 1))}`
    return callTool(names[op] ?? op, args, session, host)
  }
  const made = async () => {
    const created = await call("create_deck", {})
    return (created.answer as { deck: string }).deck
  }
  const freeEnd = (deck: string) => {
    const geometry = doom.propOf(decks.decks.get(deck as never)!.nodes.get(grown.ids.l!), "geometry")
    if (geometry?.kind !== "line" || !("x" in geometry.start)) throw new Error(JSON.stringify(geometry))
    return { x: geometry.start.x, y: geometry.start.y }
  }
  const edit = (deck: string, changes: readonly unknown[]) =>
    call("edit_deck", { deck, base: decks.decks.get(deck as never)!.rev, changes })
  return { decks, made, freeEnd, edit }
}

describe("edit_deck delete", () => {
  it("frees a connector at the point the host's measure painted", async () => {
    const grown = drifted()
    const by = connected(grown, () => wide)
    const deck = await by.made()
    const seen = painted(grown.doom, grown.slides[0]!, grown.ids.l!, wide)
    expect(seen.x).not.toBe(painted(grown.doom, grown.slides[0]!, grown.ids.l!, estimate).x)
    const deleted = await by.edit(deck, [{ op: "delete", nodes: [grown.ids.t] }])
    expect(deleted.answer).toMatchObject({ ok: true })
    expect(by.freeEnd(deck)).toEqual(seen)
  })

  it("frees a connector with the widths of text an earlier change in the same batch wrote", async () => {
    const grown = drifted()
    const knowsCapital = (fold: doom.Doom) =>
      [...fold.nodes.values()].some((node) => node.type === "shape" && node.text?.chars.includes("W")) ? wide : estimate
    const by = connected(grown, knowsCapital)
    const rewrite = { op: "set", target: grown.ids.words, text: "Hello World hello" }
    const apart = await by.made()
    expect((await by.edit(apart, [rewrite])).answer).toMatchObject({ ok: true })
    const together = await by.made()
    const batch = await by.edit(together, [rewrite, { op: "delete", nodes: [grown.ids.t] }])
    expect(batch.answer).toMatchObject({ ok: true })
    const seen = painted(by.decks.decks.get(apart as never)!, grown.slides[0]!, grown.ids.l!, wide)
    expect(by.freeEnd(together)).toEqual(seen)
  })
})
