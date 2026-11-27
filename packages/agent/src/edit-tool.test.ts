import { catalog, projectTools, readDeckId } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { callTool, type Session } from "./index.js"
import { scriptOf } from "./testing/change-script.js"
import { memoryDecks } from "./testing/memory-decks.js"
import { testTheme } from "@airdesign/doom/testing"

const names = Object.fromEntries(projectTools(catalog).map((tool) => [tool.op, tool.name])) as Record<string, string>

const start = () => doom.doomFromTree({ theme: testTheme, slides: [{ name: "Title", children: [] }] }).doom

function agent() {
  const decks = memoryDecks(start)
  let minted = 0
  let calls = 0
  const session: Session = { agent: "aira", mint: () => `minted${String((minted += 1))}` }
  const call = (op: string, args: unknown) => {
    session.once = `call${String((calls += 1))}`
    return callTool(names[op] ?? op, args, session, decks)
  }
  return { decks, call }
}

describe("refusals in execute", () => {
  it("refuses a move into a frame inside one an earlier change deleted, and says so in the answer", async () => {
    const by = agent()
    const { deck, slides } = (await by.call("execute", { script: "createDeck()" })).fields as {
      deck: string
      slides: string[]
    }
    const rev = () => by.decks.decks.get(deck as never)!.rev
    const frameIn = async (into?: string) => {
      const change = { op: "insert", kind: "frame", parent: into ?? slides[0] }
      const made = await by.call("execute", { deck, script: scriptOf([change]) })
      return made.fields.result as string
    }
    const outer = await frameIn()
    const middle = await frameIn(outer)
    const inner = await frameIn(middle)
    const base = rev()
    const changes = [
      { op: "remove", targets: [middle] },
      { op: "move", targets: [outer], parent: inner },
    ]
    const refused = await by.call("execute", { deck, script: scriptOf(changes) })
    expect(refused.fields).toMatchObject({ ok: false, refusal: "dead", refused: "missing", op: 2, node: outer })
    expect(String(refused.fields.note)).toContain("Operation 2 (move): ")
    expect(String(refused.fields.note)).toContain("a frame above the frame you move the layer into")
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
    theme: testTheme,
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
          ...(["l", "lf"] as const).map((name) => ({
            type: "shape" as const,
            name,
            props: (ids: Readonly<Record<string, doom.NodeId>>) => ({
              box: box(0, 0, 10, 10),
              geometry: {
                kind: "line" as const,
                start: name === "l" ? { node: ids.t!, site: "l" as const } : { node: ids.f!, site: "r" as const },
                end: { x: 5, y: 5 },
                route: "straight" as const,
                arrows: ["none", "none"] as const,
              },
            }),
          })),
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

function connected(grown: ReturnType<typeof drifted>, measureOf: (folds: readonly doom.Doom[]) => doom.Measure) {
  const decks = memoryDecks(() => grown.doom)
  const host = {
    ...decks,
    measure: async (folds: readonly doom.Doom[]) => ({ measure: measureOf(folds), missing: new Map() }),
  }
  let calls = 0
  const session: Session = { agent: "aira", mint: () => "m" }
  const call = (op: string, args: unknown) => {
    session.once = `call${String((calls += 1))}`
    return callTool(names[op] ?? op, args, session, host)
  }
  const made = async () => {
    const created = await call("execute", { script: "createDeck()" })
    return (created.fields as { deck: string }).deck
  }
  const freeEnd = (deck: string, line = grown.ids.l!) => {
    const geometry = doom.propOf(decks.decks.get(deck as never)!.nodes.get(line), "geometry")
    if (geometry?.kind !== "line" || !("x" in geometry.start)) throw new Error(JSON.stringify(geometry))
    return { x: geometry.start.x, y: geometry.start.y }
  }
  const edit = (deck: string, changes: readonly unknown[]) => call("execute", { deck, script: scriptOf(changes) })
  return { decks, made, freeEnd, edit }
}

describe("a script takes a shape off the deck", () => {
  const knowsLora = (folds: readonly doom.Doom[]) =>
    folds.some((fold) => doom.doomFaces(fold).faces.some((face) => face.font === "Lora")) ? wide : estimate

  it("frees a connector on an unwrapped frame at the point the host's measure painted", async () => {
    const grown = drifted()
    const by = connected(grown, () => wide)
    const deck = await by.made()
    const seen = painted(grown.doom, grown.slides[0]!, grown.ids.lf!, wide)
    expect(seen.x).not.toBe(painted(grown.doom, grown.slides[0]!, grown.ids.lf!, estimate).x)
    expect((await by.edit(deck, [{ op: "ungroup", target: grown.ids.f }])).fields).toMatchObject({ ok: true })
    expect(by.freeEnd(deck, grown.ids.lf!)).toEqual(seen)
  })

  it("frees a connector with the widths of a font a later change in the same batch removes", async () => {
    const grown = drifted()
    const by = connected(grown, knowsLora)
    const deck = await by.made()
    const lora = await by.edit(deck, [{ op: "update", target: grown.ids.words, font: "Lora" }])
    expect(lora.fields).toMatchObject({ ok: true })
    const seen = painted(by.decks.decks.get(deck as never)!, grown.slides[0]!, grown.ids.l!, wide)
    const batch = await by.edit(deck, [
      { op: "remove", targets: [grown.ids.t] },
      { op: "update", target: grown.ids.words, font: "Inter" },
    ])
    expect(batch.fields).toMatchObject({ ok: true })
    expect(by.freeEnd(deck)).toEqual(seen)
  })
})

describe("a script sets layout none", () => {
  it("keeps the children where the host's measure painted them", async () => {
    const grown = drifted()
    const by = connected(grown, () => wide)
    const deck = await by.made()
    const seen = doom.solveLayout(grown.doom, grown.slides[0]!, wide).get(grown.ids.t!)
    expect(seen?.x).not.toBe(doom.solveLayout(grown.doom, grown.slides[0]!, estimate).get(grown.ids.t!)?.x)
    expect((await by.edit(deck, [{ op: "update", target: grown.ids.f, layout: "none" }])).fields).toMatchObject({
      ok: true,
    })
    const saved = by.decks.decks.get(deck as never)!
    expect(doom.propOf(saved.nodes.get(grown.ids.t!), "box")).toMatchObject({ x: seen?.x, y: seen?.y })
  })
})

describe("a script removes a layer", () => {
  it("frees a connector at the point the host's measure painted", async () => {
    const grown = drifted()
    const by = connected(grown, () => wide)
    const deck = await by.made()
    const seen = painted(grown.doom, grown.slides[0]!, grown.ids.l!, wide)
    expect(seen.x).not.toBe(painted(grown.doom, grown.slides[0]!, grown.ids.l!, estimate).x)
    const deleted = await by.edit(deck, [{ op: "remove", targets: [grown.ids.t] }])
    expect(deleted.fields).toMatchObject({ ok: true })
    expect(by.freeEnd(deck)).toEqual(seen)
  })

  it("lands the batch with the host's fonts for the deck it leaves behind", async () => {
    const grown = drifted()
    const asked: (readonly doom.Doom[])[] = []
    const by = connected(grown, (folds) => {
      asked.push(folds)
      return wide
    })
    const deck = await by.made()
    asked.length = 0
    const deleted = await by.edit(deck, [{ op: "remove", targets: [grown.ids.t] }])
    expect(deleted.fields).toMatchObject({ ok: true })
    const gone = (fold: doom.Doom) => doom.parentOf(fold.nodes.get(grown.ids.t!)) === null
    expect(asked.some((folds) => folds.some(gone) && folds.some((fold) => !gone(fold)))).toBe(true)
    expect(by.freeEnd(deck)).toEqual(painted(grown.doom, grown.slides[0]!, grown.ids.l!, wide))
  })

  it("frees a connector with the widths of text an earlier change in the same batch wrote", async () => {
    const grown = drifted()
    const knowsCapital = (folds: readonly doom.Doom[]) =>
      folds.some((fold) =>
        [...fold.nodes.values()].some((node) => node.type === "shape" && node.text?.chars.includes("W")),
      )
        ? wide
        : estimate
    const by = connected(grown, knowsCapital)
    const rewrite = { op: "update", target: grown.ids.words, text: "Hello World hello" }
    const apart = await by.made()
    expect((await by.edit(apart, [rewrite])).fields).toMatchObject({ ok: true })
    const together = await by.made()
    const batch = await by.edit(together, [rewrite, { op: "remove", targets: [grown.ids.t] }])
    expect(batch.fields).toMatchObject({ ok: true })
    const seen = painted(by.decks.decks.get(apart as never)!, grown.slides[0]!, grown.ids.l!, wide)
    expect(by.freeEnd(together)).toEqual(seen)
  })
})

function pointed() {
  const grown = doom.doomFromTree({
    theme: testTheme,
    slides: [
      {
        children: [
          {
            type: "frame",
            name: "grp",
            props: { box: box(300, 300, 140, 80) },
            children: [{ type: "shape", name: "child", props: { box: box(0, 0, 100, 50) } }],
          },
          { type: "shape", name: "far", props: { box: box(600, 100, 100, 50) } },
          {
            type: "frame",
            name: "holder",
            props: { box: box(100, 100, 400, 200) },
            children: ["toGroup", "toChild"].map((name) => ({
              type: "shape" as const,
              name,
              props: (ids: Readonly<Record<string, doom.NodeId>>) => ({
                box: box(0, 0, 10, 10),
                geometry: {
                  kind: "line" as const,
                  start: { node: name === "toGroup" ? ids.grp! : ids.child!, site: "r" as const },
                  end: { x: 10, y: 10 },
                  route: "straight" as const,
                  arrows: ["none", "none"] as const,
                },
              }),
            })),
          },
        ],
      },
      { name: "two", children: [{ type: "shape", name: "other", props: { box: box(50, 50, 100, 50) } }] },
    ],
  })
  return grown
}

describe("a script frees a connector end whose shape leaves the slide", () => {
  async function opened() {
    const grown = pointed()
    const decks = memoryDecks(() => grown.doom)
    let calls = 0
    const session: Session = { agent: "aira", mint: () => "m" }
    const call = (op: string, args: unknown) => {
      session.once = `call${String((calls += 1))}`
      return callTool(names[op] ?? op, args, session, decks)
    }
    const deck = ((await call("execute", { script: "createDeck()" })).fields as { deck: string }).deck
    const fold = () => decks.decks.get(deck as never)!
    const lineStart = (line: doom.NodeId) => {
      const geometry = doom.propOf(fold().nodes.get(line), "geometry")
      if (geometry?.kind !== "line") throw new Error("no line")
      return geometry.start
    }
    const paintedAt = (line: doom.NodeId) => painted(fold(), grown.slides[0]!, line, estimate)
    const edit = (change: unknown) => call("execute", { deck, script: scriptOf([change]) })
    const undo = (answer: unknown) =>
      call("undo_run", { deck, runId: (answer as { runId: string }).runId }).then((undone) => undone.fields)
    return { grown, lineStart, paintedAt, edit, undo }
  }

  it("keeps a connector on an unwrapped frame where it painted, and undo_run attaches it again", async () => {
    const { grown, lineStart, paintedAt, edit, undo } = await opened()
    const seen = paintedAt(grown.ids.toGroup!)
    const landed = await edit({ op: "ungroup", target: grown.ids.grp })
    expect(landed.fields).toMatchObject({ ok: true })
    expect("node" in lineStart(grown.ids.toGroup!)).toBe(false)
    expect(paintedAt(grown.ids.toGroup!)).toEqual(seen)
    expect(lineStart(grown.ids.toChild!)).toEqual({ node: grown.ids.child, site: "r" })
    expect(await undo(landed.fields)).toMatchObject({ ok: true })
    expect(lineStart(grown.ids.toGroup!)).toEqual({ node: grown.ids.grp, site: "r" })
    expect(paintedAt(grown.ids.toGroup!)).toEqual(seen)
  })

  it("keeps a connector on a deleted slide's shape where it painted, and undo_run attaches it again", async () => {
    const { grown, lineStart, paintedAt, edit, undo } = await opened()
    await edit({ op: "move", targets: [grown.ids.grp], parent: grown.slides[1] })
    const seen = paintedAt(grown.ids.toGroup!)
    const deleted = await edit({ op: "remove", targets: [grown.slides[1]] })
    expect(deleted.fields).toMatchObject({ ok: true })
    expect("node" in lineStart(grown.ids.toGroup!)).toBe(false)
    expect(paintedAt(grown.ids.toGroup!)).toEqual(seen)
    expect(await undo(deleted.fields)).toMatchObject({ ok: true })
    expect(lineStart(grown.ids.toGroup!)).toEqual({ node: grown.ids.grp, site: "r" })
  })

  it("frees an end another run attached when undo_run takes away the shape it added", async () => {
    const { grown, lineStart, paintedAt, edit, undo } = await opened()
    const added = await edit({ op: "insert", kind: "frame", parent: grown.slides[0] })
    expect(added.fields).toMatchObject({ ok: true })
    const shape = added.fields.result as string
    const attached = await edit({ op: "update", target: grown.ids.toChild, from: { layer: shape, side: "right" } })
    expect(attached.fields).toMatchObject({ ok: true })
    const seen = paintedAt(grown.ids.toChild!)
    expect(await undo(added.fields)).toMatchObject({ ok: true })
    expect("node" in lineStart(grown.ids.toChild!)).toBe(false)
    expect(paintedAt(grown.ids.toChild!)).toEqual(seen)
  })
})

it("reads and sets an ordinary text card's padding, fill, outline and radius", async () => {
  const by = agent()
  const made = (await by.call("execute", { script: "createDeck()" })).fields
  const read = readDeckId(made.deck)
  if (!read.ok || !Array.isArray(made.slides)) throw new Error("Missing deck")
  const { deck } = read
  const added = (
    await by.call("execute", {
      deck,
      script: scriptOf([{ op: "insert", kind: "shape", parent: made.slides[0], text: "Gateway" }]),
    })
  ).fields
  const target = added.result
  for (const padding of [28, { t: 12, r: 16, b: 20, l: 24 }]) {
    const edited = await by.call("execute", {
      deck,
      script: scriptOf([
        { op: "update", target, padding, fill: "background2", stroke: "accent1", strokeWidth: 3, radius: 12 },
      ]),
    })
    expect(edited.fields).toMatchObject({ ok: true })
    const read = await by.call("execute", { deck, script: `get({ target: "${String(made.slides[0])}" })` })
    expect(JSON.stringify(read.fields)).toContain(`padding=${typeof padding === "number" ? padding : "12,16,20,24"}`)
    expect(JSON.stringify(read.fields)).toContain("fill=background2 stroke=accent1 strokeWidth=3 radius=12")
  }
})
