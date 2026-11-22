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
  readonly slides?: readonly ({ readonly id: string } | string)[]
  readonly layouts?: readonly {
    readonly id: string
    readonly name: string
    readonly placeholders: readonly { readonly role: string; readonly box?: unknown }[]
  }[]
  readonly templateStyles?: readonly unknown[]
  readonly elements?: readonly {
    readonly node: string
    readonly value?: string
    readonly role?: string
    readonly box?: unknown
    readonly design?: string
  }[]
  readonly decks?: readonly { readonly deck: string; readonly name: string; readonly trash: boolean }[]
  readonly templates?: readonly { readonly id: string; readonly name: string }[]
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

  it("lists the deck's layouts and adds a slide on the one the agent picks", async () => {
    const cookie = await signInByCode(base, mails, "create-layouts@example.com")
    const made = await mcp(cookie, "airdesign_create_deck", {})
    expect(
      made.layouts?.map((layout) => [layout.id, layout.name, layout.placeholders.map((held) => held.role)]),
    ).toEqual([
      ["L1", "Title Slide", ["body", "title", "subtitle"]],
      ["L2", "Section Header", ["body", "title"]],
      ["L3", "Title and Content", ["title", "body"]],
      ["L4", "Two Content", ["title", "body", "body"]],
      ["L5", "Title Only", ["title"]],
      ["L6", "Closing", ["title", "body"]],
      ["L7", "Blank", []],
    ])
    expect(made.layouts?.[4]?.placeholders).toEqual([{ role: "title", box: { x: 40.8, y: 30.4, w: 878.4, h: 65.2 } }])
    const deck = made.deck ?? ""
    const added = await mcp(cookie, "airdesign_edit_deck", {
      deck,
      base: made.revision,
      changes: [{ op: "add_slide", layout: "L4" }],
    })
    expect(added, JSON.stringify(added)).toMatchObject({ ok: true, slides: ["257"] })
    const read = await mcp(cookie, "airdesign_read_deck", { deck, slide: "257" })
    expect(read.elements?.map((element) => element.role)).toEqual(["title", "body", "body"])
    expect(read.elements?.every((element) => element.box !== null && element.design !== undefined)).toBe(true)
    const unknown = await mcp(cookie, "airdesign_edit_deck", {
      deck,
      base: added.revision,
      changes: [{ op: "add_slide", layout: "L9" }],
    })
    expect(unknown.refusal).toBe("dead")
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

  it("starts a deck from the template the agent names, and lists the templates it can name", async () => {
    const cookie = await signInByCode(base, mails, "create-template@example.com")
    const listed = await mcp(cookie, "airdesign_list_decks", {})
    expect(listed.templates).toEqual([
      { id: "neutral", name: "Neutral" },
      { id: "midnight", name: "Midnight" },
      { id: "editorial", name: "Editorial" },
    ])
    const made = await mcp(cookie, "airdesign_create_deck", { name: "Night", template: "midnight" })
    expect(made).toMatchObject({ ok: true, name: "Night", index: "ready", slides: [{ id: "256" }] })
    const midnight = new Uint8Array(
      readFileSync(new URL("../../../packages/templates/files/midnight-start.pptx", import.meta.url)),
    )
    const original = await ask(base, "POST", "/decks/original", { deck: made.deck }, cookie)
    expect(original.json).toMatchObject({
      ok: true,
      bytes: midnight.length,
      sha256: createHash("sha256").update(midnight).digest("hex"),
    })
    const plain = await mcp(cookie, "airdesign_create_deck", { template: "neutral" })
    const blank = await ask(base, "POST", "/decks/original", { deck: plain.deck }, cookie)
    expect(blank.json).toMatchObject({ sha256: createHash("sha256").update(startDeck).digest("hex") })
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
    for (const args of [
      { name: "" },
      { name: "n".repeat(500) },
      { name: 7 },
      { template: "unknown" },
      { template: 7 },
    ]) {
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
