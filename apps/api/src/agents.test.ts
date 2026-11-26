import { scriptOf } from "@airdesign/mcp/testing/evals"
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
  const created = await agent.call("execute", { script: "createDeck()" })
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
      const a = await first.call("execute", {
        deck: start.deck,
        script: scriptOf([text(start.slide, "one")]),
      })
      const b = await second.call("execute", {
        deck: start.deck,
        script: scriptOf([text(start.slide, "two")]),
      })
      expect(a.ok && b.ok, `${a.said} ${b.said}`).toBe(true)
      expect(a.body.runId).not.toBe(b.body.runId)
      expect((await first.call("stop_run", { deck: start.deck, runId: a.body.runId })).ok).toBe(true)
      const more = await second.call("execute", {
        deck: start.deck,
        runId: b.body.runId,
        script: scriptOf([text(start.slide, "three")]),
      })
      expect(more.ok, more.said).toBe(true)
      const fenced = await first.call("execute", {
        deck: start.deck,
        runId: a.body.runId,
        script: scriptOf([text(start.slide, "late")]),
      })
      expect(fenced.body.refusal).toBe("run-fenced")
    })

    it("neither writes into nor stops the other's run, and each one's next start closes only its own", async () => {
      const owner = await account()
      const [first, second] = await pair(owner)
      const start = await made(first)
      const a = await first.call("execute", {
        deck: start.deck,
        script: scriptOf([text(start.slide, "one")]),
      })
      const b = await second.call("execute", {
        deck: start.deck,
        script: scriptOf([text(start.slide, "two")]),
      })
      expect(a.ok && b.ok, `${a.said} ${b.said}`).toBe(true)
      const intruded = await second.call("execute", {
        deck: start.deck,
        runId: a.body.runId,
        script: scriptOf([text(start.slide, "into a")]),
      })
      expect(intruded.body.refusal).toBe("run-fenced")
      expect((await second.call("stop_run", { deck: start.deck, runId: a.body.runId })).body.refusal).toBe("run-fenced")
      const again = await first.call("execute", {
        deck: start.deck,
        script: scriptOf([text(start.slide, "a again")]),
      })
      expect(again.ok, again.said).toBe(true)
      const old = await first.call("execute", {
        deck: start.deck,
        runId: a.body.runId,
        script: scriptOf([text(start.slide, "old run")]),
      })
      expect(old.body.refusal).toBe("run-fenced")
      const kept = await second.call("execute", {
        deck: start.deck,
        runId: b.body.runId,
        script: scriptOf([text(start.slide, "b still")]),
      })
      expect(kept.ok, kept.said).toBe(true)
    })

    it("both lose a layer a person changes while their runs are open", async () => {
      const owner = await account()
      const [first, second] = await pair(owner)
      const start = await made(first)
      const a = await first.call("execute", {
        deck: start.deck,
        script: scriptOf([text(start.slide, "one")]),
      })
      const b = await second.call("execute", {
        deck: start.deck,
        script: scriptOf([text(start.slide, "two")]),
      })
      const added = (a.body.made as { ids: string[] }[])[0]!.ids[0]!
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
        const closed = await agent.call("execute", {
          deck: start.deck,
          runId: run,
          script: scriptOf([{ op: "set", target: added, name: "Agent" }]),
        })
        expect(closed.body.refusal).toBe("person-protected")
      }
    })
  })
}

describe("tool call limits", () => {
  it("give each agent its own ninety calls in five minutes and the account three hundred", async () => {
    const owner = await account()
    const tokens = await Promise.all(["one", "two", "three", "four"].map((name) => grant(owner, name)))
    const callers = await Promise.all(tokens.map((token) => connected({ authorization: `Bearer ${token}` })))
    const [one, two, three, four] = callers
    if (one === undefined || two === undefined || three === undefined || four === undefined) throw new Error("agents")
    for (let count = 0; count < 90; count += 1) expect((await one.call("get_app_state", {})).ok).toBe(true)
    const ninetyFirst = await one.call("get_app_state", {})
    expect(ninetyFirst.text).toMatch(/^Ninety tool calls in five minutes\./)
    for (const [agent, calls] of [
      [two, 90],
      [three, 90],
      [four, 30],
    ] as const) {
      for (let count = 0; count < calls; count += 1) expect((await agent.call("get_app_state", {})).ok).toBe(true)
    }
    const threeHundredFirst = await four.call("get_app_state", {})
    expect(threeHundredFirst.text).toMatch(/^Three hundred tool calls in five minutes from this account's agents\./)
  }, 60_000)
})

describe("an agent reading a deck another agent has a run open on", () => {
  it("sees that agent by the name its person connected it under, and Aira as Aira", async () => {
    const owner = await account()
    const aira = await connected({ cookie: owner.cookie })
    const cursor = await connected({ authorization: `Bearer ${await grant(owner, "Cursor")}` })
    const start = await made(aira)
    const a = await aira.call("execute", { deck: start.deck, script: scriptOf([text(start.slide, "one")]) })
    expect(a.ok, a.said).toBe(true)
    const seen = await cursor.call("execute", { deck: start.deck, script: "get().slides" })
    expect(seen.body.otherRuns).toEqual([{ agent: "Aira", slide: start.slide, wrote: a.body.rev }])
    const b = await cursor.call("execute", {
      deck: start.deck,
      script: scriptOf([text(start.slide, "two")]),
    })
    expect(b.ok, b.said).toBe(true)
    expect((await aira.call("execute", { deck: start.deck, script: "get().slides" })).body.otherRuns).toEqual([
      { agent: "Cursor", slide: start.slide, wrote: b.body.rev },
    ])
  })
})
