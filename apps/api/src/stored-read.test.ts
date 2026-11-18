import { deckRoutes, signInRoutes } from "@airdesign/catalog"
import { format, orderKeyBetween } from "@airdesign/document"
import type { Pool } from "pg"
import { afterAll, beforeAll, expect, it } from "vitest"
import { ask, cookieFrom, postgresInfo, serve } from "./harness.js"
import { DeckListen, openPool, type Mail } from "./index.js"
import { readSignInMail } from "./sign-in-mail.js"

let base = ""
let close = async () => {}
let saved: Pool
const mails: Mail[] = []
let cookie = ""
const box = { x: 10, y: 20, cx: 30, cy: 40 }
const node = { route: "", floor: "", phase: "idle", runId: null, readAt: null, guarded: false, claimed: null }
const counts = { stoppedAt: null, slides: 1, bytes: 0 }

beforeAll(async () => {
  const info = await postgresInfo()
  const session = openPool(info.session)
  saved = openPool(info.deck)
  const listen = new DeckListen(info.listen)
  const served = await serve({
    session,
    deck: saved,
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
    await Promise.all([session.end(), saved.end()])
  }
  const email = "stored-read@example.com"
  await ask(base, "POST", signInRoutes.email.path, { email })
  const { code } = readSignInMail(mails.find((mail) => mail.to === email)?.text ?? "")
  const signed = await ask(base, "POST", signInRoutes.code.path, { email, code })
  cookie = cookieFrom(signed.headers) ?? ""
})
afterAll(async () => close())

function legacyRegister(deck: string) {
  const typed = [
    { actor: "person", visible: true, value: "Typed" },
    { actor: "person", visible: true, property: "box", value: box },
    { actor: "agent", visible: true, runId: "run", v: format, patch: { box: { x: { set: 5 } } } },
  ]
  const opening = { box: { x: { set: 5 } } }
  const floor = [{ node: "259.7", kind: "shape", value: "Title", box, grouped: false, opening }]
  return {
    route: deck,
    floor: "",
    slides: 1,
    bytes: 0,
    landed: [{ actor: "person", visible: true, value: "On the root" }],
    phase: "idle",
    runId: null,
    readAt: null,
    guarded: false,
    claimed: null,
    stoppedAt: null,
    nodes: ["a", "258.7"],
    readNodes: null,
    elements: { "258.7": { ...node, route: deck, floor: "Title", landed: typed, ...counts } },
    file: ["258"],
    order: [{ slide: "clone", id: "259", source: "258", key: orderKeyBetween(null, null), floor }],
  }
}

const slides = [{ id: "258", position: 0 }]
const element = { node: "258.7", kind: "shape", value: "Title", box, grouped: false }
const olderIndex = {
  total: 1,
  slides,
  elements: [element],
  pages: [{ once: "older", offset: 0, count: 1 }],
  next: { format, total: 1, slides, elements: [], pages: [] },
}

async function stored(deck: string): Promise<{ revision: number; register: unknown; import_index: unknown }> {
  const found = await saved.query<{ revision: number; register: unknown; import_index: unknown }>(
    "select revision, register, import_index from deck.saved where id = $1",
    [deck],
  )
  const row = found.rows[0]
  if (row === undefined) throw new Error("missing deck")
  return row
}

async function plant(deck: string, register: unknown, index: unknown): Promise<void> {
  expect((await ask(base, "POST", deckRoutes.open.path, { deck }, cookie)).json).toMatchObject({ ok: true })
  await saved.query("update deck.saved set register = $2::jsonb, import_index = $3::jsonb where id = $1", [
    deck,
    JSON.stringify(register),
    index === null ? null : JSON.stringify(index),
  ])
}

it("opens a register stored in the root shape with mixed rows, a cloned slide's opening and an older index half rebuilt, and edits it against the stored index", async () => {
  const deck = "stored-read-legacy"
  const legacy = legacyRegister(deck)
  await plant(deck, legacy, olderIndex)

  const opened = (await ask(base, "POST", deckRoutes.open.path, { deck }, cookie)).json as {
    readonly ok: boolean
    readonly register: Record<string, unknown> & { readonly elements: Record<string, { readonly landed: unknown }> }
  }
  expect(opened).toMatchObject({ ok: true })
  expect(opened.register).not.toHaveProperty("landed")
  expect(opened.register.elements.a?.landed).toEqual(legacy.landed)
  expect(opened.register.elements["258.7"]?.landed).toEqual(legacy.elements["258.7"].landed)
  expect(opened.register.order).toEqual(legacy.order)
  expect(opened.register.index).toEqual({ total: 1, slides, elements: [element], pages: olderIndex.pages })
  expect(opened.register.format).toBe(format)

  const edited = await ask(
    base,
    "POST",
    deckRoutes.commit.path,
    { deck, batch: [{ node: "258.7", value: "Edited", floor: "Title" }] },
    cookie,
  )
  expect(edited.json).toMatchObject({ ok: true, revision: 1 })
  const after = await stored(deck)
  expect(after.revision).toBe(1)
  expect(after.import_index).toEqual(olderIndex)
  const register = after.register as typeof legacy & {
    readonly elements: Record<string, { readonly landed: unknown[] }>
  }
  expect(register).not.toHaveProperty("landed")
  expect(register.elements.a?.landed).toEqual(legacy.landed)
  expect(register.elements["258.7"]?.landed).toEqual([
    ...legacy.elements["258.7"].landed,
    { actor: "person", visible: true, value: "Edited" },
  ])
  expect(register.order).toEqual(legacy.order)
})

it("refuses to open or edit a register holding a row from a newer build, and leaves the row as it was", async () => {
  const deck = "stored-read-newer"
  const legacy = legacyRegister(deck)
  const newer = {
    ...legacy,
    elements: {
      "258.7": {
        ...legacy.elements["258.7"],
        landed: [{ actor: "person", visible: true, v: format + 1, patch: { glow: { radius: { set: 1 } } } }],
      },
    },
  }
  await plant(deck, newer, olderIndex)
  const before = await stored(deck)

  expect((await ask(base, "POST", deckRoutes.open.path, { deck }, cookie)).json).toEqual({
    ok: false,
    refusal: "newer",
  })
  expect(
    (
      await ask(
        base,
        "POST",
        deckRoutes.commit.path,
        { deck, batch: [{ node: "258.7", value: "Edited", floor: "Title" }] },
        cookie,
      )
    ).json,
  ).toEqual({ ok: false, refusal: "newer" })
  expect(await stored(deck)).toEqual(before)
})

it("refuses a register whose index a newer build stored, and one it cannot read, and changes neither", async () => {
  const newerIndex = "stored-read-newer-index"
  await plant(newerIndex, legacyRegister(newerIndex), { ...olderIndex, format: format + 1 })
  const kept = await stored(newerIndex)
  expect((await ask(base, "POST", deckRoutes.open.path, { deck: newerIndex }, cookie)).json).toEqual({
    ok: false,
    refusal: "newer",
  })
  expect(await stored(newerIndex)).toEqual(kept)

  const unread = "stored-read-payload"
  await plant(unread, { ...legacyRegister(unread), nodes: "a" }, null)
  const held = await stored(unread)
  expect((await ask(base, "POST", deckRoutes.open.path, { deck: unread }, cookie)).json).toEqual({
    ok: false,
    refusal: "payload",
  })
  expect(await stored(unread)).toEqual(held)
})

it("answers a sealed batch that already landed with its receipt, even once a newer build's row makes the deck unreadable here", async () => {
  const deck = "stored-read-receipt"
  await plant(deck, legacyRegister(deck), null)
  const batch = [{ node: "258.7", value: "Sealed", floor: "Title" }]
  const landed = await ask(base, "POST", deckRoutes.commit.path, { deck, batch, once: "sealed-once" }, cookie)
  expect(landed.json).toMatchObject({ ok: true, revision: 1 })
  const row = await stored(deck)
  const register = row.register as ReturnType<typeof legacyRegister>
  const newerRow = { actor: "person", visible: true, v: format + 1, patch: { glow: { radius: { set: 1 } } } }
  const element = register.elements["258.7"]
  await saved.query("update deck.saved set register = $2::jsonb where id = $1", [
    deck,
    JSON.stringify({ ...register, elements: { "258.7": { ...element, landed: [...element.landed, newerRow] } } }),
  ])
  const before = await stored(deck)

  const retried = await ask(base, "POST", deckRoutes.commit.path, { deck, batch, once: "sealed-once" }, cookie)
  expect(retried.json).toEqual(landed.json)
  const fresh = await ask(base, "POST", deckRoutes.commit.path, { deck, batch, once: "fresh-once" }, cookie)
  expect(fresh.json).toEqual({ ok: false, refusal: "newer" })
  expect(await stored(deck)).toEqual(before)
})
