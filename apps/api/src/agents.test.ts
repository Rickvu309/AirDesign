import { doomRoutes } from "@airdesign/catalog"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { account, address, connected, grant, startAgents, type Account, type Agent } from "./testing/agents-drive.js"
import { ask } from "./testing/harness.js"

let stop = async () => {}

beforeAll(async () => {
  stop = await startAgents()
})

afterAll(async () => {
  await stop()
})

type Made = { readonly deck: string; readonly rev: number; readonly slide: string }

async function made(agent: Agent): Promise<Made> {
  const created = await agent.call("create_deck", {})
  expect(created.ok, created.said).toBe(true)
  return {
    deck: created.body.deck as string,
    rev: created.body.rev as number,
    slide: (created.body.slides as string[])[0]!,
  }
}

const text = (slide: string, words: string) => ({
  op: "add",
  kind: "text",
  slide,
  text: words,
  box: { x: 160, y: 800, w: 600, h: 80 },
})

for (const pairing of ["two agents", "Aira and an agent"] as const) {
  describe(`${pairing} on one account`, () => {
    async function pair(owner: Account): Promise<readonly [Agent, Agent]> {
      const second = await connected({ authorization: `Bearer ${await grant(owner, "codex")}` })
      if (pairing === "Aira and an agent") return [await connected({ cookie: owner.cookie }), second]
      return [await connected({ authorization: `Bearer ${await grant(owner, "claude")}` }), second]
    }

    it("each work in their own run on one deck, and stopping one leaves the other running", async () => {
      const owner = await account()
      const [first, second] = await pair(owner)
      const start = await made(first)
      const a = await first.call("edit_deck", {
        deck: start.deck,
        base: start.rev,
        changes: [text(start.slide, "one")],
      })
      const b = await second.call("edit_deck", {
        deck: start.deck,
        base: start.rev + 1,
        changes: [text(start.slide, "two")],
      })
      expect(a.ok && b.ok, `${a.said} ${b.said}`).toBe(true)
      expect(a.body.runId).not.toBe(b.body.runId)
      expect((await first.call("stop_run", { deck: start.deck, runId: a.body.runId })).ok).toBe(true)
      const more = await second.call("edit_deck", {
        deck: start.deck,
        base: b.body.rev,
        runId: b.body.runId,
        changes: [text(start.slide, "three")],
      })
      expect(more.ok, more.said).toBe(true)
      const fenced = await first.call("edit_deck", {
        deck: start.deck,
        base: more.body.rev,
        runId: a.body.runId,
        changes: [text(start.slide, "late")],
      })
      expect(fenced.body.refusal).toBe("run-fenced")
    })

    it("both lose a layer a person changes while their runs are open", async () => {
      const owner = await account()
      const [first, second] = await pair(owner)
      const start = await made(first)
      const a = await first.call("edit_deck", {
        deck: start.deck,
        base: start.rev,
        changes: [text(start.slide, "one")],
      })
      const b = await second.call("edit_deck", {
        deck: start.deck,
        base: start.rev + 1,
        changes: [text(start.slide, "two")],
      })
      const added = (a.body.added as { id: string }[])[0]!.id
      const typed = await ask(
        address.base,
        "POST",
        doomRoutes.edit.path,
        {
          deck: start.deck,
          edit: {
            once: "typed",
            author: { kind: "person", id: "tab" },
            writes: [{ node: added, prop: "name", value: "Mine" }],
          },
        },
        owner.cookie,
      )
      expect(typed.json).toMatchObject({ ok: true })
      for (const [agent, run] of [
        [first, a.body.runId],
        [second, b.body.runId],
      ] as const) {
        const closed = await agent.call("edit_deck", {
          deck: start.deck,
          base: start.rev + 3,
          runId: run,
          changes: [{ op: "set", target: added, name: "Agent" }],
        })
        expect(closed.body.refusal).toBe("person-protected")
      }
    })
  })
}

describe("tool call limits", () => {
  it("give each agent its own thirty calls in five minutes and the account ninety", async () => {
    const owner = await account()
    const tokens = await Promise.all(["one", "two", "three", "four"].map((name) => grant(owner, name)))
    const callers = await Promise.all(tokens.map((token) => connected({ authorization: `Bearer ${token}` })))
    const [one, two, three, four] = callers
    if (one === undefined || two === undefined || three === undefined || four === undefined) throw new Error("agents")
    for (let count = 0; count < 30; count += 1) expect((await one.call("list_decks", {})).ok).toBe(true)
    const thirtyFirst = await one.call("list_decks", {})
    expect(thirtyFirst.text).toMatch(/^Thirty tool calls in five minutes\./)
    for (const agent of [two, three]) {
      for (let count = 0; count < 30; count += 1) expect((await agent.call("list_decks", {})).ok).toBe(true)
    }
    const ninetyFirst = await four.call("list_decks", {})
    expect(ninetyFirst.text).toMatch(/^Ninety tool calls in five minutes from this account's agents\./)
  }, 60_000)
})
