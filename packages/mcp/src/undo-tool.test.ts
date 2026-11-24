import { catalog, projectTools } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { emptyLog, callTool, type Session, type ToolResult } from "./index.js"
import { memoryDecks, type MemoryDecks } from "./testing/memory-decks.js"

const names = Object.fromEntries(projectTools(catalog).map((tool) => [tool.op, tool.name])) as Record<string, string>

function start(): doom.Doom {
  return doom.doomFromTree({
    theme: doom.defaultTheme,
    slides: [
      {
        name: "Title",
        children: [
          {
            type: "shape",
            name: "Title",
            props: {
              role: "title",
              box: { x: 160, y: 380, w: 1600, h: 160, rotation: 0, flipH: false, flipV: false },
              text: doom.textFromMarkdown("Untitled", "title"),
            },
          },
        ],
      },
    ],
  }).doom
}

function agent(decks: MemoryDecks = memoryDecks(start), id = "aira", name = "Aira") {
  let minted = 0
  const session: Session = { agent: id, name, mint: () => `minted${String((minted += 1))}`, log: emptyLog(), now: 0 }
  let calls = 0
  return {
    decks,
    call: async (op: string, args: unknown, once?: string): Promise<ToolResult> => {
      session.once = once ?? `call${String((calls += 1))}`
      return callTool(names[op] ?? op, args, session, decks)
    },
  }
}

async function renamed() {
  const by = agent()
  const made = await by.call("create_deck", { name: "Board" })
  const deck = made.answer.deck as string
  const rev = made.answer.rev as number
  const fold = by.decks.decks.get(deck as never)!
  const title = [...fold.nodes.values()].find((node) => node.type === "shape")!
  const landed = await by.call("edit_deck", {
    deck,
    base: rev,
    changes: [{ op: "set", target: title.id, name: "Renamed" }],
  })
  const runId = landed.answer.runId as string
  return { by, deck, rev: landed.answer.rev as number, runId, title: title.id }
}

describe("undo_run", () => {
  it("takes the agent's own run back and says so, then says when there is nothing left", async () => {
    const { by, deck, runId, title } = await renamed()
    const undone = await by.call("undo_run", { deck, runId })
    expect(undone.answer).toMatchObject({
      ok: true,
      deck,
      runId,
      kept: [],
      left: [],
      waiting: [],
      note: "Undone",
    })
    expect(undone.content).toEqual([{ type: "text", text: JSON.stringify(undone.answer) }])
    expect(doom.propOf(by.decks.decks.get(deck as never)!.nodes.get(title), "name")).toBe("Title")
    expect(by.decks.decks.get(deck as never)!.runs.get(runId)?.undone).toBe(true)
    const again = await by.call("undo_run", { deck, runId })
    expect(again.answer).toMatchObject({
      ok: false,
      reason: "nothing",
      note: "Nothing left to undo. Everything it changed was changed or deleted since.",
    })
    expect(doom.propOf(by.decks.decks.get(deck as never)!.nodes.get(title), "name")).toBe("Title")
  })

  it("leaves a layer a person changed since, says why, and takes the rest back", async () => {
    const by = agent()
    const made = await by.call("create_deck", { name: "Board" })
    const deck = made.answer.deck as string
    const slides = made.answer.slides as string[]
    const first = await by.call("edit_deck", {
      deck,
      base: made.answer.rev,
      changes: [{ op: "add", kind: "text", slide: slides[0], text: "Hello" }],
    })
    const runId = first.answer.runId as string
    const hello = (first.answer.added as { id: string }[])[0]!.id
    const second = await by.call("edit_deck", {
      deck,
      base: first.answer.rev,
      changes: [{ op: "add", kind: "text", slide: slides[0], text: "Note" }],
      runId,
    })
    const note = (second.answer.added as { id: string }[])[0]!.id
    const person = await by.decks.edit(deck as never, {
      once: "person",
      author: { kind: "person", id: "quan" },
      writes: [{ node: hello as never, prop: "name", value: "Mine" }],
    })
    expect(person.ok).toBe(true)
    const undone = await by.call("undo_run", { deck, runId })
    expect(undone.answer).toMatchObject({
      ok: true,
      kept: [hello],
      left: [],
      waiting: [],
      note: "Undone. “Mine” stays, because it was changed after Aira made it.",
    })
    const fold = by.decks.decks.get(deck as never)!
    expect(doom.propOf(fold.nodes.get(hello as never), "name")).toBe("Mine")
    expect((fold.nodes.get(note as never) as { parent: unknown }).parent).toBeNull()
    expect(fold.runs.get(runId)?.undone).toBe(true)
  })

  it("takes the agent's own turn off a layer it leaves where the agent put it, and keeps the turn the person saw", async () => {
    const by = agent()
    const made = await by.call("create_deck", { name: "Board" })
    const deck = made.answer.deck as string
    const slide = (made.answer.slides as string[])[0] as doom.NodeId
    const [outer, group, card] = [doom.nodeId("g:101"), doom.nodeId("g:102"), doom.nodeId("g:103")]
    const at = (parent: doom.NodeId) => ({ id: parent, at: doom.orderKeyBetween(null, null) })
    const turned = (x: number, rotation: number) => ({ x, y: x, w: 100, h: 50, rotation, flipH: false, flipV: false })
    const person = { kind: "person" as const, id: "quan" }
    const agentRun = { kind: "agent" as const, id: "aira", run: "run-1", name: "Aira" }
    const edits = [
      {
        once: "setup",
        author: person,
        writes: [
          { node: outer, prop: "type", value: "frame" },
          { node: outer, prop: "parent", value: at(slide) },
          { node: outer, prop: "box", value: turned(100, 20) },
          { node: group, prop: "type", value: "frame" },
          { node: group, prop: "parent", value: at(outer) },
          { node: group, prop: "box", value: turned(50, 10) },
          { node: card, prop: "type", value: "shape" },
          { node: card, prop: "parent", value: at(group) },
          { node: card, prop: "box", value: turned(40, 0) },
        ],
      },
      {
        once: "agent-start",
        author: agentRun,
        phase: "start",
        writes: [
          { node: card, prop: "parent", value: at(slide) },
          { node: card, prop: "box", value: turned(190, 0) },
        ],
      },
      { once: "agent-stop", author: agentRun, phase: "stop", writes: [] },
      { once: "delete-outer", author: person, writes: [{ node: outer, prop: "parent", value: null }] },
    ]
    for (const edit of edits) expect((await by.decks.edit(deck as never, edit as never)).ok).toBe(true)
    const undone = await by.call("undo_run", { deck, runId: "run-1" })
    expect(undone.answer).toMatchObject({ ok: true, kept: [], left: [card], waiting: [] })
    const fold = by.decks.decks.get(deck as never)!
    expect(doom.parentOf(fold.nodes.get(card)!)?.id).toBe(slide)
    expect(doom.propOf(fold.nodes.get(card), "box")).toEqual(turned(190, 30))
  })

  it("refuses another agent's run, and still undoes a run that has stopped", async () => {
    const { by, deck, runId, title } = await renamed()
    const other = agent(by.decks, "other", "Other")
    const refused = await other.call("undo_run", { deck, runId })
    expect(refused.answer).toMatchObject({ ok: false, refusal: "run-fenced" })
    const stopped = await by.call("stop_run", { deck, runId })
    expect(stopped.answer.ok).toBe(true)
    const undone = await by.call("undo_run", { deck, runId })
    expect(undone.answer).toMatchObject({ ok: true, note: "Undone" })
    expect(doom.propOf(by.decks.decks.get(deck as never)!.nodes.get(title), "name")).toBe("Title")
  })
})
