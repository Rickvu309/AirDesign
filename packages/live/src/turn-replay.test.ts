import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { createDoomDeck, openDoomDeck } from "./doom-deck.js"
import { type DoomRemote, memoryDoomRemote } from "./doom-remote.js"
import { memoryStorage } from "./doom-storage.js"

const id = doom.nodeId
const [deckNode, row, slide, title, card, frame] = [id("q:1"), id("q:2"), id("q:3"), id("q:4"), id("q:5"), id("q:6")]
const at = (parent: doom.NodeId) => ({ id: parent, at: orderKeyBetween(null, null) })
const words = (chars: string): doom.Text => ({
  chars,
  spans: [],
  paras: [{}],
  style: "body",
  resize: "height",
  alignV: "top",
})
const placed = (x: number) => ({ x, y: 0, w: 100, h: 50, rotation: 0, flipH: false, flipV: false })

const start: doom.Edit = {
  once: "start",
  author: { kind: "person", id: "start" },
  writes: [
    { node: deckNode, prop: "type", value: "deck" },
    { node: row, prop: "type", value: "slideRow" },
    { node: row, prop: "parent", value: at(deckNode) },
    { node: slide, prop: "type", value: "slide" },
    { node: slide, prop: "parent", value: at(row) },
    { node: title, prop: "type", value: "shape" },
    { node: title, prop: "parent", value: at(slide) },
    { node: title, prop: "text", value: words("Title") },
    { node: card, prop: "type", value: "shape" },
    { node: card, prop: "parent", value: at(slide) },
    { node: card, prop: "box", value: placed(0) },
    { node: frame, prop: "type", value: "frame" },
    { node: frame, prop: "parent", value: at(slide) },
  ],
}

const titled: doom.Edit = {
  ...start,
  writes: [
    ...start.writes,
    { node: title, prop: "role", value: "title" },
    { node: deckNode, prop: "name", value: doom.blankDeckName },
    { node: deckNode, prop: "nameFollows", value: true },
  ],
}

async function tabs(first: doom.Edit) {
  const remote = memoryDoomRemote(first)
  const cut = { off: false }
  const reachable =
    <A extends unknown[], R>(call: (...args: A) => Promise<R>) =>
    async (...args: A) => {
      if (cut.off) throw new TypeError("offline")
      return call(...args)
    }
  const join = async (client: string, how: "create" | "open", through: DoomRemote) => {
    let next = 0
    const opened = await (how === "create" ? createDoomDeck : openDoomDeck)(through, "replay", {
      once: () => `${client}-${(next += 1)}`,
      client,
      storage: memoryStorage(),
      pause: () => Promise.resolve(),
    })
    if (!opened.ok) throw new Error(JSON.stringify(opened))
    return opened.deck
  }
  const inFlight: {
    before?: (() => Promise<void>) | undefined
    answer?: Awaited<ReturnType<typeof remote.edit>> | undefined
  } = {}
  const sending = async (...args: Parameters<typeof remote.edit>) => {
    const { before, answer } = inFlight
    inFlight.before = undefined
    inFlight.answer = undefined
    await before?.()
    return answer ?? remote.edit(...args)
  }
  const mine = await join("a", "create", { ...remote, edit: reachable(sending), since: reachable(remote.since) })
  const theirs = await join("b", "open", remote)
  return { cut, mine, theirs, remote, inFlight }
}

const xOf = (view: doom.Doom) => (view.nodes.get(card) as { box: { x: number } }).box.x
const parentOf = (view: doom.Doom, node: doom.NodeId) =>
  (view.nodes.get(node) as { parent?: { id: doom.NodeId } | null }).parent?.id ?? null
const nudge = (x: number): readonly doom.Write[] => [{ node: card, prop: "box", value: placed(x) }]
const typed: readonly doom.Write[] = [{ node: title, prop: "text", value: words("X") }]
const deleted: doom.Write = { node: title, prop: "parent", value: null }
const renamed: doom.Write = { node: deckNode, prop: "name", value: "Board pack" }
const retyped: doom.Write = { node: title, prop: "text", value: words("Theirs") }

async function offline(
  steps: readonly (readonly doom.Write[])[],
  presses: number,
  theirWrites: readonly doom.Write[] = [deleted],
  first = start,
) {
  const opened = await tabs(first)
  const { cut, mine, theirs } = opened
  for (const writes of steps) expect(mine.push(writes).ok).toBe(true)
  expect(await mine.sync()).toEqual({ ok: true })
  cut.off = true
  for (let press = 0; press < presses; press += 1) expect(mine.undo().ok).toBe(true)
  await theirs.catchUp()
  for (const write of theirWrites) expect(theirs.push([write]).ok).toBe(true)
  expect(await theirs.sync()).toEqual({ ok: true })
  cut.off = false
  expect(await mine.sync()).toEqual({ ok: true })
  return mine
}

describe("an undo made offline over a layer another tab deletes before it reconnects", () => {
  it("lands the rest of the undo, as it would online, and keeps both steps", async () => {
    const mine = await offline([nudge(10), [...nudge(20), ...typed]], 1)
    expect(mine.notices()).toEqual([])
    expect([xOf(mine.view()), xOf(mine.server())]).toEqual([10, 10])
    expect(parentOf(mine.server(), title)).toBeNull()
    expect(mine.undo().ok).toBe(true)
    expect(await mine.sync()).toEqual({ ok: true })
    expect(xOf(mine.server())).toBe(0)
    expect([mine.redo().ok, mine.redo().ok]).toEqual([true, true])
    expect(await mine.sync()).toEqual({ ok: true })
    expect(xOf(mine.server())).toBe(20)
    expect(parentOf(mine.server(), title)).toBeNull()
  })

  it("lands the undo queued after it, which waited on it", async () => {
    const mine = await offline([nudge(10), [...nudge(20), ...typed]], 2)
    expect(mine.notices()).toEqual([])
    expect(xOf(mine.server())).toBe(0)
    expect([mine.redo().ok, mine.redo().ok]).toEqual([true, true])
    expect(await mine.sync()).toEqual({ ok: true })
    expect(xOf(mine.server())).toBe(20)
  })

  it("leaves where a layer sits when the other tab moved it into a frame meanwhile, as an undo online does", async () => {
    const mine = await offline([[...nudge(20), ...typed]], 1, [
      { node: card, prop: "parent", value: at(frame) },
      deleted,
    ])
    expect(mine.notices()).toEqual([])
    expect([parentOf(mine.server(), card), xOf(mine.server())]).toEqual([frame, 20])
    expect(mine.redo()).toEqual({ ok: false, reason: "nothing" })
  })

  it("drops quietly an undo left with nothing on a standing layer, and the next undo reaches the step below", async () => {
    const mine = await offline([nudge(10), typed], 1)
    expect(mine.notices()).toEqual([])
    expect(mine.redo()).toEqual({ ok: false, reason: "nothing" })
    expect(mine.undo().ok).toBe(true)
    expect(await mine.sync()).toEqual({ ok: true })
    expect(xOf(mine.server())).toBe(0)
  })

  describe("with a real title, which the deck name follows", () => {
    const nameOf = (view: doom.Doom) => (view.nodes.get(deckNode) as { name?: string | null }).name ?? null

    it("lands the card and leaves the name the other tab wrote, instead of setting the whole undo aside", async () => {
      const mine = await offline([nudge(10), [...nudge(20), ...typed]], 1, [deleted], titled)
      expect(nameOf(mine.server())).toBe(doom.blankDeckName)
      expect(mine.notices()).toEqual([])
      expect([xOf(mine.view()), xOf(mine.server())]).toEqual([10, 10])
      expect(nameOf(mine.view())).toBe(doom.blankDeckName)
      expect(mine.undo().ok).toBe(true)
      expect(await mine.sync()).toEqual({ ok: true })
      expect(xOf(mine.server())).toBe(0)
      expect([mine.redo().ok, mine.redo().ok]).toEqual([true, true])
      expect(await mine.sync()).toEqual({ ok: true })
      expect(xOf(mine.server())).toBe(20)
    })

    it("takes an undo that only typed in the title off quietly, and the next undo reaches the step below", async () => {
      const mine = await offline([nudge(10), typed], 1, [deleted], titled)
      expect(mine.notices()).toEqual([])
      expect(mine.redo()).toEqual({ ok: false, reason: "nothing" })
      expect(mine.undo().ok).toBe(true)
      expect(await mine.sync()).toEqual({ ok: true })
      expect(xOf(mine.server())).toBe(0)
    })

    it("sets the name back online as well, when the tab has already seen the other tab's delete", async () => {
      const { mine, theirs } = await tabs(titled)
      expect(mine.push(nudge(10)).ok).toBe(true)
      expect(mine.push([...nudge(20), ...typed]).ok).toBe(true)
      expect(await mine.sync()).toEqual({ ok: true })
      await theirs.catchUp()
      expect(theirs.push([{ node: title, prop: "parent", value: null }]).ok).toBe(true)
      expect(await theirs.sync()).toEqual({ ok: true })
      await mine.catchUp()
      expect(mine.undo().ok).toBe(true)
      expect(await mine.sync()).toEqual({ ok: true })
      expect(mine.notices()).toEqual([])
      expect([xOf(mine.server()), nameOf(mine.server())]).toEqual([10, doom.blankDeckName])
    })

    const textOf = (view: doom.Doom) => (view.nodes.get(title) as { text: doom.Text }).text.chars

    it("lands the card and leaves the name the other tab set, when the other tab renames the deck", async () => {
      const mine = await offline([nudge(10), [...nudge(20), ...typed]], 1, [renamed], titled)
      expect(mine.notices()).toEqual([])
      expect([xOf(mine.view()), xOf(mine.server())]).toEqual([10, 10])
      expect([nameOf(mine.view()), nameOf(mine.server())]).toEqual(["Board pack", "Board pack"])
      expect(textOf(mine.server())).toBe("Title")
      expect(mine.undo().ok).toBe(true)
      expect(await mine.sync()).toEqual({ ok: true })
      expect(xOf(mine.server())).toBe(0)
      expect([mine.redo().ok, mine.redo().ok]).toEqual([true, true])
      expect(await mine.sync()).toEqual({ ok: true })
      expect([xOf(mine.server()), nameOf(mine.server())]).toEqual([20, "Board pack"])
    })

    it("lands the card and leaves the words and name the other tab typed, when the other tab retypes the title", async () => {
      const mine = await offline([nudge(10), [...nudge(20), ...typed]], 1, [retyped], titled)
      expect(mine.notices()).toEqual([])
      expect([xOf(mine.view()), xOf(mine.server())]).toEqual([10, 10])
      expect([textOf(mine.view()), textOf(mine.server())]).toEqual(["Theirs", "Theirs"])
      expect([nameOf(mine.view()), nameOf(mine.server())]).toEqual(["Theirs", "Theirs"])
      expect(mine.undo().ok).toBe(true)
      expect(await mine.sync()).toEqual({ ok: true })
      expect(xOf(mine.server())).toBe(0)
    })

    it("lands the undo queued after it too, when the other tab renames the deck", async () => {
      const mine = await offline([nudge(10), [...nudge(20), ...typed]], 2, [renamed], titled)
      expect(mine.notices()).toEqual([])
      expect([xOf(mine.server()), nameOf(mine.server())]).toEqual([0, "Board pack"])
      expect([mine.redo().ok, mine.redo().ok]).toEqual([true, true])
      expect(await mine.sync()).toEqual({ ok: true })
      expect([xOf(mine.server()), nameOf(mine.server())]).toEqual([20, "Board pack"])
    })

    it("keeps the name the other tab set when a redo is queued behind the undo, which built its name write on the undo's", async () => {
      const { cut, mine, theirs } = await tabs(titled)
      expect(mine.push(nudge(10)).ok).toBe(true)
      expect(mine.push([...nudge(20), ...typed]).ok).toBe(true)
      expect(await mine.sync()).toEqual({ ok: true })
      cut.off = true
      expect(mine.undo().ok).toBe(true)
      expect(mine.redo().ok).toBe(true)
      await theirs.catchUp()
      expect(theirs.push([renamed]).ok).toBe(true)
      expect(await theirs.sync()).toEqual({ ok: true })
      cut.off = false
      expect(await mine.sync()).toEqual({ ok: true })
      expect(mine.notices()).toEqual([])
      expect([xOf(mine.server()), textOf(mine.server()), nameOf(mine.server())]).toEqual([20, "X", "Board pack"])
      expect(mine.undo().ok).toBe(true)
    })

    it("takes an undo that only typed in the title off quietly, when the other tab retypes it, and keeps the step below", async () => {
      const mine = await offline([nudge(10), typed], 1, [retyped], titled)
      expect(mine.notices()).toEqual([])
      expect(mine.redo()).toEqual({ ok: false, reason: "nothing" })
      expect([textOf(mine.server()), nameOf(mine.server())]).toEqual(["Theirs", "Theirs"])
      expect(mine.undo().ok).toBe(true)
      expect(await mine.sync()).toEqual({ ok: true })
      expect(xOf(mine.server())).toBe(0)
    })

    it("takes an undo that only typed in the title off quietly, when the other tab renames the deck", async () => {
      const mine = await offline([nudge(10), typed], 1, [renamed], titled)
      expect(mine.notices()).toEqual([])
      expect([textOf(mine.server()), nameOf(mine.server())]).toEqual(["Title", "Board pack"])
      expect(mine.undo().ok).toBe(true)
      expect(await mine.sync()).toEqual({ ok: true })
      expect(xOf(mine.server())).toBe(0)
    })

    it("leaves the name the other tab set online as well, when the tab has already seen the rename", async () => {
      const { mine, theirs } = await tabs(titled)
      expect(mine.push(nudge(10)).ok).toBe(true)
      expect(mine.push([...nudge(20), ...typed]).ok).toBe(true)
      expect(await mine.sync()).toEqual({ ok: true })
      await theirs.catchUp()
      expect(theirs.push([renamed]).ok).toBe(true)
      expect(await theirs.sync()).toEqual({ ok: true })
      await mine.catchUp()
      expect(mine.undo().ok).toBe(true)
      expect(await mine.sync()).toEqual({ ok: true })
      expect(mine.notices()).toEqual([])
      expect([xOf(mine.server()), nameOf(mine.server())]).toEqual([10, "Board pack"])
    })

    describe("an agent run undone while the other tab changes the deck", () => {
      const author = { kind: "agent" as const, id: "aira", run: "run-1" }

      async function ranAndUndone(theirs: doom.Write) {
        const opened = await tabs(titled)
        const { mine, remote, inFlight } = opened
        await mine.catchUp()
        const known = mine.view()
        const baseOf = (node: doom.NodeId, prop: doom.Write["prop"]) => known.revs.get(node)!.get(prop)!
        for (const edit of [
          {
            once: "r1",
            author,
            phase: "start" as const,
            writes: [
              { node: card, prop: "box" as const, value: placed(30), base: baseOf(card, "box") },
              { node: title, prop: "text" as const, value: words("Agent"), base: baseOf(title, "text") },
              { node: deckNode, prop: "name" as const, value: "Agent", base: baseOf(deckNode, "name") },
            ],
          },
          { once: "r2", author, phase: "stop" as const, writes: [] },
        ])
          expect((await remote.edit({ deck: "replay", edit })).ok).toBe(true)
        await mine.catchUp()
        expect([xOf(mine.view()), nameOf(mine.view())]).toEqual([30, "Agent"])
        inFlight.before = async () => {
          await opened.theirs.catchUp()
          expect(opened.theirs.push([theirs]).ok).toBe(true)
          expect(await opened.theirs.sync()).toEqual({ ok: true })
        }
        const undone = await mine.undoRun("run-1")
        expect(undone.ok).toBe(true)
        expect(await mine.sync()).toEqual({ ok: true })
        await mine.catchUp()
        return mine
      }

      it("lands the card when the other tab renames the deck, and keeps the name the other tab set", async () => {
        const mine = await ranAndUndone(renamed)
        expect(mine.notices()).toEqual([])
        expect([xOf(mine.view()), xOf(mine.server())]).toEqual([0, 0])
        expect([nameOf(mine.view()), nameOf(mine.server())]).toEqual(["Board pack", "Board pack"])
      })

      it("lands the card when the other tab retypes the title, and keeps the words and name the other tab typed", async () => {
        const mine = await ranAndUndone(retyped)
        expect(mine.notices()).toEqual([])
        expect([xOf(mine.view()), xOf(mine.server())]).toEqual([0, 0])
        expect([textOf(mine.server()), nameOf(mine.server())]).toEqual(["Theirs", "Theirs"])
      })

      it("lands the card when the other tab deletes the title, and keeps the name the delete wrote", async () => {
        const mine = await ranAndUndone(deleted)
        expect(mine.notices()).toEqual([])
        expect([xOf(mine.view()), xOf(mine.server())]).toEqual([0, 0])
        expect(nameOf(mine.server())).toBe(doom.blankDeckName)
      })
    })
  })

  describe("a refusal that catching up cannot resolve", () => {
    it.each(["limit", "shape", "person", "run-fenced"] as const)(
      "still sets the undo aside with a notice when the deck refuses it %s",
      async (refused) => {
        const { mine, inFlight } = await tabs(titled)
        expect(mine.push(nudge(20)).ok).toBe(true)
        expect(await mine.sync()).toEqual({ ok: true })
        inFlight.answer = { ok: false, refusal: "edit", refused }
        expect(mine.undo().ok).toBe(true)
        expect(await mine.sync()).toEqual({ ok: true })
        expect(mine.notices()).toMatchObject([{ refused }])
        expect(xOf(mine.server())).toBe(20)
      },
    )
  })
})
