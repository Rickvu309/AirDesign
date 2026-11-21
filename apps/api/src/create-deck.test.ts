import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { ask, postgresInfo, serve, signInByCode } from "./harness.js"
import { DeckListen, LocalOriginalStore, openPool, type Mail } from "./index.js"

const accept = "application/json, text/event-stream"
const startDeck = new Uint8Array(
  readFileSync(new URL("../../../packages/templates/files/neutral-start.pptx", import.meta.url)),
)
const store = new LocalOriginalStore()
let base = ""
let bare = ""
let close = async () => {}
const mails: Mail[] = []

beforeAll(async () => {
  const info = await postgresInfo()
  const session = openPool(info.session)
  const deck = openPool(info.deck)
  const listen = new DeckListen(info.listen)
  const options = {
    session,
    deck,
    listen,
    publicOrigin: "https://app.example",
    siteOrigin: "https://site.example",
    send: async (mail: Mail) => {
      mails.push(mail)
    },
  }
  const served = await serve({ ...options, originals: store })
  const unconfigured = await serve(options)
  base = served.base
  bare = unconfigured.base
  close = async () => {
    await served.close()
    await unconfigured.close()
    await listen.close()
    await session.end()
    await deck.end()
  }
})

afterAll(async () => {
  await close()
})

type Answer = {
  readonly ok?: boolean
  readonly deck?: string
  readonly name?: string
  readonly revision?: number
  readonly refusal?: string
  readonly index?: string
  readonly size?: { readonly w: number; readonly h: number }
  readonly slides?: readonly { readonly id: string }[]
  readonly templateStyles?: readonly unknown[]
  readonly elements?: readonly { readonly node: string; readonly value?: string }[]
  readonly decks?: readonly { readonly deck: string; readonly name: string; readonly trash: boolean }[]
}

async function mcp(cookie: string, name: string, args: unknown, once?: string, at = base): Promise<Answer> {
  const meta = once === undefined ? {} : { _meta: { "app.airdesign/once": once } }
  const response = await fetch(`${at}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept, cookie },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args, ...meta } }),
  })
  expect(response.status).toBe(200)
  const text = await response.text()
  const data = text
    .split("\n")
    .find((line) => line.startsWith("data: "))
    ?.slice("data: ".length)
  const parsed = JSON.parse(data ?? text) as { result?: { structuredContent?: Answer } }
  return parsed.result?.structuredContent ?? {}
}

describe("an agent creates a deck", () => {
  it("makes a named deck it can read and edit before any tab opens it", async () => {
    const cookie = await signInByCode(base, mails, "create-deck@example.com")
    const made = await mcp(cookie, "airdesign_create_deck", { name: "Board review" })
    expect(made).toMatchObject({
      ok: true,
      name: "Board review",
      index: "ready",
      size: { w: 960, h: 540 },
      slides: [{ id: "256" }],
    })
    expect(made.templateStyles?.length).toBeGreaterThan(0)
    const deck = made.deck ?? ""
    expect((await mcp(cookie, "airdesign_list_decks", {})).decks).toEqual([
      { deck, name: "Board review", trash: false },
    ])
    const added = await mcp(cookie, "airdesign_edit_deck", {
      deck,
      base: made.revision,
      changes: [
        { op: "add", kind: "shape", slide: "256", box: { x: 48, y: 48, w: 400, h: 60 }, text: { value: "Agenda" } },
      ],
    })
    expect(added, JSON.stringify(added)).toMatchObject({ ok: true })
    const read = await mcp(cookie, "airdesign_read_deck", { deck })
    expect(read.elements?.map((element) => element.value)).toContain("Agenda")
  })

  it("stores the start deck as the original a tab opens", async () => {
    const cookie = await signInByCode(base, mails, "create-original@example.com")
    const made = await mcp(cookie, "airdesign_create_deck", {})
    const original = await ask(base, "POST", "/decks/original", { deck: made.deck }, cookie)
    expect(original.json).toMatchObject({
      ok: true,
      bytes: startDeck.length,
      sha256: createHash("sha256").update(startDeck).digest("hex"),
    })
    expect([...store.objects.values()].some((bytes) => Buffer.from(bytes).equals(Buffer.from(startDeck)))).toBe(true)
  })

  it("names a deck Blank deck when the agent gives no name", async () => {
    const cookie = await signInByCode(base, mails, "create-unnamed@example.com")
    expect((await mcp(cookie, "airdesign_create_deck", {})).name).toBe("Blank deck")
  })

  it("makes one deck when the same call is sent again", async () => {
    const cookie = await signInByCode(base, mails, "create-once@example.com")
    const first = await mcp(cookie, "airdesign_create_deck", { name: "Once" }, "create-retry-1")
    const again = await mcp(cookie, "airdesign_create_deck", { name: "Once" }, "create-retry-1")
    const other = await mcp(cookie, "airdesign_create_deck", { name: "Twice" }, "create-retry-2")
    expect(again.deck).toBe(first.deck)
    expect(other.deck).not.toBe(first.deck)
    expect((await mcp(cookie, "airdesign_list_decks", {})).decks?.map((row) => row.name).sort()).toEqual([
      "Once",
      "Twice",
    ])
  })

  it("makes a new deck for each call that carries no retry key", async () => {
    const cookie = await signInByCode(base, mails, "create-keyless@example.com")
    const first = await mcp(cookie, "airdesign_create_deck", {})
    const second = await mcp(cookie, "airdesign_create_deck", {})
    expect(first.deck).toMatch(/^[0-9a-f]{32}$/)
    expect(second.deck).toMatch(/^[0-9a-f]{32}$/)
    expect(second.deck).not.toBe(first.deck)
  })

  it("gives another account its own deck for the same retry key", async () => {
    const one = await signInByCode(base, mails, "create-one@example.com")
    const two = await signInByCode(base, mails, "create-two@example.com")
    const first = await mcp(one, "airdesign_create_deck", {}, "shared-key")
    const second = await mcp(two, "airdesign_create_deck", {}, "shared-key")
    expect(second.ok).toBe(true)
    expect(second.deck).not.toBe(first.deck)
  })

  it("refuses a call it cannot read and makes no deck", async () => {
    const cookie = await signInByCode(base, mails, "create-refused@example.com")
    for (const args of [{ name: "" }, { name: "n".repeat(500) }, { name: 7 }, { template: "neutral" }]) {
      expect((await mcp(cookie, "airdesign_create_deck", args)).refusal, JSON.stringify(args)).toBe("field")
    }
    expect((await mcp(cookie, "airdesign_list_decks", {})).decks ?? []).toEqual([])
  })

  it("makes no deck when the server has nowhere to keep its original", async () => {
    const cookie = await signInByCode(bare, mails, "create-bare@example.com")
    expect((await mcp(cookie, "airdesign_create_deck", {}, undefined, bare)).refusal).toBe("store")
    expect((await mcp(cookie, "airdesign_list_decks", {}, undefined, bare)).decks ?? []).toEqual([])
  })
})
