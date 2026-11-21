import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { ask, signInByCode, postgresInfo, serve } from "./harness.js"
import { DeckListen, openPool, type Mail } from "./index.js"

const accept = "application/json, text/event-stream"
let base = ""
let close = async () => {}
const mails: Mail[] = []

beforeAll(async () => {
  const info = await postgresInfo()
  const session = openPool(info.session)
  const deck = openPool(info.deck)
  const listen = new DeckListen(info.listen)
  const served = await serve({
    session,
    deck,
    listen,
    publicOrigin: "https://app.example",
    siteOrigin: "https://site.example",
    send: async (mail) => {
      mails.push(mail)
    },
  })
  base = served.base
  close = async () => {
    await served.close()
    await listen.close()
    await session.end()
    await deck.end()
  }
})

afterAll(async () => {
  await close()
})

const sign = (email: string): Promise<string> => signInByCode(base, mails, email)

async function mcp(cookie: string, name: string, args: unknown): Promise<{ status: number; text: string }> {
  const response = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept, cookie },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  })
  const text = await response.text()
  return { status: response.status, text }
}

function answerOf(text: string): {
  ok?: boolean
  revision?: number
  refusal?: string
  elements?: { node?: string; slide?: string; value?: string; version?: number }[]
  decks?: { deck?: string; name?: string; trash?: boolean }[]
} {
  const data = text
    .split("\n")
    .find((line) => line.startsWith("data: "))
    ?.slice("data: ".length)
  const parsed = JSON.parse(data ?? text) as {
    result?: { structuredContent?: { refusal?: string; elements?: { value?: string }[]; decks?: { deck: string }[] } }
  }
  return parsed.result?.structuredContent ?? {}
}

describe("an agent reads only decks its account owns", () => {
  it("hides another account's deck and still reads a deck this account edited", async () => {
    const owner = await sign("read-owner@example.com")
    const other = await sign("read-other@example.com")
    expect((await ask(base, "POST", "/decks/open", { deck: "read-owned" }, owner)).status).toBe(200)
    expect((await ask(base, "POST", "/decks/rename", { deck: "read-owned", name: "Owned" }, owner)).status).toBe(200)
    expect(
      (
        await ask(
          base,
          "POST",
          "/decks/commit",
          { deck: "read-owned", batch: [{ node: "258.7", value: "Known" }] },
          owner,
        )
      ).status,
    ).toBe(200)
    const listed = await mcp(other, "airdesign_list_decks", {})
    expect(listed.status).toBe(200)
    expect(listed.text).not.toContain("read-owned")
    expect(answerOf(listed.text).decks ?? []).toEqual([])
    const hidden = await mcp(other, "airdesign_read_deck", { deck: "read-owned" })
    expect(hidden.status).toBe(200)
    expect(answerOf(hidden.text).refusal).toBe("owner")
    expect(hidden.text).not.toContain('"refusal":"store"')
    expect(hidden.text).not.toContain("node:internal")
    const ownList = await mcp(owner, "airdesign_list_decks", {})
    expect(answerOf(ownList.text).decks).toContainEqual({ deck: "read-owned", name: "Owned", trash: false })
    const read = await mcp(owner, "airdesign_read_deck", { deck: "read-owned" })
    expect(answerOf(read.text).elements).toEqual([{ node: "258.7", slide: "258", value: "Known", version: 1 }])
  })

  it("reads and edits the opening elements of a cloned slide", async () => {
    const cookie = await sign("read-clone@example.com")
    expect((await ask(base, "POST", "/decks/open", { deck: "read-clone" }, cookie)).status).toBe(200)
    const box = { x: 12_700, y: 25_400, cx: 38_100, cy: 50_800 }
    const shown = { x: 1, y: 2, w: 3, h: 4 }
    const title = { node: "258.2", kind: "shape", value: "Title", box, grouped: false }
    const clone = { slide: "clone", id: "258", source: "256", key: "a0", floor: [title], file: ["256", "257"] }
    const committed = await ask(base, "POST", "/decks/commit", { deck: "read-clone", batch: [clone] }, cookie)
    expect(committed.status).toBe(200)
    const read = await mcp(cookie, "airdesign_read_deck", { deck: "read-clone" })
    expect(answerOf(read.text).elements).toEqual([{ ...title, box: shown, slide: "258", version: 0 }])
    const edited = await mcp(cookie, "airdesign_edit_deck", {
      deck: "read-clone",
      base: 1,
      changes: [{ node: "258.2", readAt: 0, value: "Agent" }],
    })
    expect(answerOf(edited.text)).toMatchObject({ ok: true, revision: 2 })
    const again = await mcp(cookie, "airdesign_read_deck", { deck: "read-clone" })
    expect(answerOf(again.text).elements).toEqual([{ ...title, box: shown, slide: "258", value: "Agent", version: 1 }])
  })

  it("refuses hostile arguments for the read tools before storage", async () => {
    const cookie = await sign("read-fuzz@example.com")
    expect((await ask(base, "POST", "/decks/open", { deck: "read-fuzz" }, cookie)).status).toBe(200)
    const good = await mcp(cookie, "airdesign_read_deck", { deck: "read-fuzz" })
    expect(good.status).toBe(200)
    expect(answerOf(good.text)).toEqual({
      ok: true,
      revision: 0,
      elements: [],
      slides: [],
      groups: [],
      index: "missing",
      findings: "missing",
    })
    const listed = await mcp(cookie, "airdesign_list_decks", {})
    expect(listed.status).toBe(200)
    expect(answerOf(listed.text).decks).toContainEqual({ deck: "read-fuzz", name: "", trash: false })
    for (const [name, args, refusal] of [
      ["airdesign_read_deck", { deck: "bad id" }, "deck"],
      ["airdesign_read_deck", { deck: "a\u0000b" }, "deck"],
      ["airdesign_read_deck", { deck: "\ud800" }, "deck"],
      ["airdesign_read_deck", { deck: "a b" }, "deck"],
      ["airdesign_read_deck", { deck: "read-fuzz", slide: "258.7" }, "field"],
      ["airdesign_read_deck", { deck: "read-fuzz", extra: true }, "field"],
      ["airdesign_read_deck", {}, "field"],
      ["airdesign_list_decks", { deck: "read-fuzz" }, "field"],
      ["airdesign_list_decks", { cursor: 1 }, "field"],
      ["airdesign_list_decks", { cursor: "bad id" }, "field"],
    ] as const) {
      const answer = await mcp(cookie, name, args)
      expect(answer.status, name).toBe(200)
      expect(answerOf(answer.text).refusal, `${name} ${JSON.stringify(args)}`).toBe(refusal)
      expect(answer.text, name).not.toContain('"refusal":"store"')
      expect(answer.text, name).not.toContain("node:internal")
      expect(answer.text, name).not.toMatch(/\.ts:\d+/)
    }
  })
})
