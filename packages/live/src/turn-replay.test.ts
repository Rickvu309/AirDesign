import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import {
  deckNode,
  id,
  row,
  slide,
  title,
  card,
  frame,
  at,
  words,
  placed,
  titled,
  tabs,
  xOf,
  parentOf,
  nudge,
  typed,
  deleted,
  renamed,
  retyped,
  offline,
} from "./testing/offline-tabs.js"
import { starts } from "@airdesign/doom/testing"

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
      expect(nameOf(mine.server())).toBe(starts.deckName)
      expect(mine.notices()).toEqual([])
      expect([xOf(mine.view()), xOf(mine.server())]).toEqual([10, 10])
      expect(nameOf(mine.view())).toBe(starts.deckName)
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
      expect([xOf(mine.server()), nameOf(mine.server())]).toEqual([10, starts.deckName])
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
        expect(nameOf(mine.server())).toBe(starts.deckName)
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

describe("a turn the deck still refuses once it is rebuilt on the caught-up deck", () => {
  it("sets the undo aside with the deck's refusal, and keeps the other tab's words", async () => {
    const added = id("q:7")
    const mine = await offline(
      [[{ node: added, prop: "type", value: "slide" }, { node: added, prop: "parent", value: at(row) }, ...typed]],
      1,
      [retyped, { node: slide, prop: "parent", value: null }],
    )
    expect(mine.notices()).toMatchObject([{ refused: "last-slide" }])
    expect(parentOf(mine.server(), added)).toBe(row)
    expect((mine.server().nodes.get(title) as { text: doom.Text }).text.chars).toBe("Theirs")
    expect(mine.redo()).toEqual({ ok: false, reason: "nothing" })
  })
})
