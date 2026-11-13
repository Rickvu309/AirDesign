import { deckRoutes } from "@airdesign/catalog"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  account,
  address,
  agents,
  clock,
  connected,
  deckOf,
  edit,
  gate,
  grant,
  idleWindow,
  shown,
  startAgents,
  turnRuns,
  versionOf,
  x,
  y,
} from "./agents-drive.js"
import { ask } from "./harness.js"

let stop = async () => {}

beforeAll(async () => {
  stop = await startAgents()
})

afterAll(async () => {
  await stop()
})

for (const pairing of ["two agents", "Aira and an agent"] as const) {
  describe(`${pairing} on one account`, () => {
    it("each work in their own run, with their own turn row, Stop and Undo", async () => {
      const owner = await account()
      const [first, second] = await agents(owner, pairing)
      const deck = await deckOf(owner)
      const a = await first.call("edit_deck", edit(deck, x, "first on x", 0))
      const b = await second.call("edit_deck", edit(deck, y, "second on y", 0))
      expect([a.text, b.text]).toEqual(["Landed revision 1.", "Landed revision 2."])
      expect(b.body.runId).not.toBe(a.body.runId)
      expect(await turnRuns(owner, deck)).toEqual([a.body.runId, b.body.runId].toSorted())

      const stopOther = await second.call("stop_run", { deck, runId: a.body.runId })
      expect([stopOther.ok, stopOther.body.refusal]).toEqual([false, "run-fenced"])
      const again = await first.call("edit_deck", edit(deck, x, "first again", 1))
      expect([again.text, again.body.runId]).toEqual(["Landed revision 3.", a.body.runId])

      const undone = await ask(address.base, "POST", deckRoutes.undo.path, { deck, runId: a.body.runId }, owner.cookie)
      expect(undone.status).toBe(200)
      expect(await shown(deck, x)).toBeUndefined()
      expect(await shown(deck, y)).toBe("second on y")
    })

    it("refuse an edit of an element the other agent's live turn holds, and stale once that turn ends", async () => {
      const owner = await account()
      const [first, second] = await agents(owner, pairing)
      const deck = await deckOf(owner)
      const read = await first.call("read_deck", { deck })
      expect(read.ok).toBe(true)
      const b = await second.call("edit_deck", edit(deck, x, "second wrote x", 0))
      expect(b.text).toBe("Landed revision 1.")
      const a = await first.call("edit_deck", edit(deck, x, "first wrote x on its old read", 0))
      expect([a.ok, a.body.refusal]).toEqual([false, "held"])
      expect(await shown(deck, x)).toBe("second wrote x")

      clock.now += idleWindow
      const late = await first.call("edit_deck", edit(deck, x, "first wrote x on its old read", 0))
      expect([late.ok, late.body.refusal]).toEqual([false, "stale"])
      expect(await shown(deck, x)).toBe("second wrote x")
      const fresh = await first.call("edit_deck", edit(deck, x, "first on a fresh read", versionOf(late, x)))
      expect(fresh.text).toBe("Landed revision 2.")
    })

    it("refuse an edit held at its deck write while the other agent takes the element", async () => {
      const owner = await account()
      const [first, second] = await agents(owner, pairing)
      const deck = await deckOf(owner)
      expect((await first.call("edit_deck", edit(deck, y, "first holds y", 0))).ok).toBe(true)
      let open = () => {}
      gate.held = { opened: new Promise<void>((resolve) => (open = resolve)), armed: true }
      const pending = first.call("edit_deck", edit(deck, x, "first held at its write", 0))
      while (gate.held?.armed) await new Promise((resolve) => setTimeout(resolve, 10))
      const b = await second.call("edit_deck", edit(deck, x, "second wrote x meanwhile", 0))
      open()
      const a = await pending
      expect(b.text).toBe("Landed revision 2.")
      expect([a.ok, a.body.refusal]).toEqual([false, "held"])
      expect(await shown(deck, x)).toBe("second wrote x meanwhile")
    })
  })
}

describe("one grant from two connections", () => {
  it("is one agent: its calls share one run, as the server cannot tell the connections apart", async () => {
    const owner = await account()
    const token = await grant(owner, "claude")
    const [first, second] = await Promise.all([
      connected({ authorization: `Bearer ${token}` }),
      connected({ authorization: `Bearer ${token}` }),
    ])
    const deck = await deckOf(owner)
    const a = await first.call("edit_deck", edit(deck, x, "one connection", 0))
    const b = await second.call("edit_deck", edit(deck, y, "the other connection", 0))
    expect(b.body.runId).toBe(a.body.runId)
  })
})

describe("tool call limits", () => {
  it("give each agent its own thirty calls in five minutes and the account ninety", async () => {
    const owner = await account()
    const deck = await deckOf(owner)
    const tokens = await Promise.all(["one", "two", "three", "four"].map((name) => grant(owner, name)))
    const callers = await Promise.all(tokens.map((token) => connected({ authorization: `Bearer ${token}` })))
    const [one, two, three, four] = callers
    if (one === undefined || two === undefined || three === undefined || four === undefined) throw new Error("agents")
    for (let count = 0; count < 30; count += 1) expect((await one.call("read_deck", { deck })).ok).toBe(true)
    const thirtyFirst = await one.call("read_deck", { deck })
    expect(thirtyFirst.text).toMatch(/^Thirty tool calls in five minutes\./)
    for (const agent of [two, three]) {
      for (let count = 0; count < 30; count += 1) expect((await agent.call("read_deck", { deck })).ok).toBe(true)
    }
    const ninetyFirst = await four.call("read_deck", { deck })
    expect(ninetyFirst.text).toMatch(/^Ninety tool calls in five minutes from this account's agents\./)
  }, 60_000)
})
