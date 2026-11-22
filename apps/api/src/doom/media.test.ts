import { createHash } from "node:crypto"
import { Client } from "pg"
import { afterAll, beforeAll, expect, it } from "vitest"
import { accountRoutes } from "@airdesign/catalog"
import { limits } from "@airdesign/document"

import { ask, signInByCode, postgresInfo, serve } from "../testing/harness.js"
import { DeckListen, openPool, type Mail, type OriginalUpload } from "../index.js"
import { LocalOriginalStore } from "../platform/local-original-store.js"

const bytes = Buffer.from("added picture bytes")
const sha256 = createHash("sha256").update(bytes).digest("hex")
const store = new LocalOriginalStore()
const mails: Mail[] = []
let base = ""
let bare = ""
let cookie = ""
let admin = new Client()
let sequence = 0
let close = async () => {}

it("removes an account's picture rows and its device key when the person deletes the account", async () => {
  const email = "media-device-leaving@example.com"
  const leaving = await signInByCode(base, mails, email)
  const id = `media-device-leaving${String(++sequence)}`
  await post("/decks/open", { deck: id }, leaving)
  await post("/decks/media/upload", { deck: id, bytes: bytes.length, sha256 }, leaving)
  const device = await admin.query<{ device: string }>("select device from session.account where email = $1", [email])
  const key = device.rows[0]?.device ?? ""
  expect(key).toMatch(/^[0-9a-f]{32}$/)
  const [media] = await keys(id)
  const deleted = await post(accountRoutes.delete.path, { email }, leaving)
  expect(deleted.json).toEqual({ ok: true })
  expect(await keys(id)).toEqual([])
  expect((await admin.query("select key from deck.original_delete where key = $1", [media])).rows).toEqual([
    { key: media },
  ])
  expect((await admin.query("select email from session.account where device = $1", [key])).rows).toEqual([])
})

async function post(path: string, body: unknown, session = cookie, origin = base) {
  return ask(origin, "POST", path, body, session)
}

async function deck(): Promise<string> {
  const id = `media${String(++sequence)}`
  await post("/decks/open", { deck: id })
  return id
}

async function upload(id: string, size = bytes.length, digest = sha256): Promise<OriginalUpload> {
  const reply = await post("/decks/media/upload", { deck: id, bytes: size, sha256: digest })
  expect(reply.json).toMatchObject({ ok: true })
  return reply.json as OriginalUpload
}

async function keys(id: string): Promise<string[]> {
  const result = await admin.query<{ key: string }>("select key from deck.media where deck = $1", [id])
  return result.rows.map((row) => row.key)
}

beforeAll(async () => {
  const info = await postgresInfo()
  const session = openPool(info.session)
  const db = openPool(info.deck)
  const listen = new DeckListen(info.listen)
  admin = new Client({ connectionString: info.admin })
  await admin.connect()
  const options = {
    session,
    deck: db,
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
  cookie = await signInByCode(base, mails, "media@example.com")
  close = async () => {
    await served.close()
    await unconfigured.close()
    await listen.close()
    await session.end()
    await db.end()
    await admin.end()
  }
})

afterAll(async () => {
  await close()
})

it("stores an added picture's bytes by hash and hands them to a second session once they land", async () => {
  const id = await deck()
  expect((await post("/decks/media", { deck: id, sha256 })).json).toEqual({ ok: false, refusal: "missing" })
  const signed = await upload(id)
  expect((await post("/decks/media", { deck: id, sha256 })).json).toEqual({ ok: false, refusal: "missing" })
  store.put(signed.url, bytes, signed.headers)
  const second = await signInByCode(base, mails, "media@example.com")
  const reply = await post("/decks/media", { deck: id, sha256 }, second)
  expect(reply.json).toMatchObject({ ok: true, bytes: bytes.length, sha256 })
  expect(Buffer.from(store.get((reply.json as { url: string }).url))).toEqual(bytes)
})

it("signs the same key again for the same bytes so a failed upload retries", async () => {
  const id = await deck()
  await upload(id)
  await upload(id)
  expect(await keys(id)).toHaveLength(1)
  expect((await post("/decks/media/upload", { deck: id, bytes: bytes.length + 1, sha256 })).json).toEqual({
    ok: false,
    refusal: "present",
  })
})

it("refuses a picture over the media limit and pictures that would take the deck over its size limit", async () => {
  const id = await deck()
  expect((await post("/decks/media/upload", { deck: id, bytes: limits.media, sha256 })).json).toEqual({
    ok: false,
    refusal: "limit",
  })
  const many = Math.ceil(limits.bytes / (limits.media - 1))
  for (let index = 0; index < many - 1; index += 1) {
    await upload(id, limits.media - 1, createHash("sha256").update(String(index)).digest("hex"))
  }
  const last = createHash("sha256").update("last").digest("hex")
  expect((await post("/decks/media/upload", { deck: id, bytes: limits.media - 1, sha256: last })).json).toEqual({
    ok: false,
    refusal: "limit",
  })
})

it("answers owner to another account and a session to nobody", async () => {
  const id = await deck()
  await upload(id)
  const other = await signInByCode(base, mails, "other-media@example.com")
  for (const [route, body] of [
    ["/decks/media", { deck: id, sha256 }],
    ["/decks/media/upload", { deck: id, bytes: bytes.length, sha256 }],
  ] as const) {
    expect((await post(route, body, other)).json).toEqual({ ok: false, refusal: "owner" })
    expect((await ask(base, "POST", route, body)).status).toBe(401)
    expect((await post(route, body, cookie, bare)).json).toEqual({ ok: false, refusal: "storage" })
  }
  expect((await post("/decks/media", { deck: id, sha256: "x" })).json).toEqual({ ok: false, refusal: "field" })
})

it("queues an added picture's object for removal when its deck is deleted for good", async () => {
  const id = await deck()
  const signed = await upload(id)
  store.put(signed.url, bytes, signed.headers)
  const [key] = await keys(id)
  await post("/decks/trash", { deck: id })
  expect((await post("/decks/delete", { decks: [id] })).json).toEqual({ ok: true, deleted: [id] })
  expect(await keys(id)).toEqual([])
  expect((await admin.query("select key from deck.original_delete where key = $1", [key])).rows).toEqual([{ key }])
  await admin.query("update deck.original_delete set expires = now() - interval '1 second' where key = $1", [key])
  await post("/decks/list", {})
  expect(await store.size(key ?? "")).toBeUndefined()
})

it("queues an added picture's object for removal when its account is deleted", async () => {
  const email = "media-leaving@example.com"
  const leaving = await signInByCode(base, mails, email)
  const id = `media-leaving${String(++sequence)}`
  await post("/decks/open", { deck: id }, leaving)
  await post("/decks/media/upload", { deck: id, bytes: bytes.length, sha256 }, leaving)
  const [key] = await keys(id)
  await admin.query("select session.delete_account($1)", [email])
  expect(await keys(id)).toEqual([])
  expect((await admin.query("select key from deck.original_delete where key = $1", [key])).rows).toEqual([{ key }])
})

async function doomDeck(session = cookie): Promise<string> {
  const id = `doommedia${String(++sequence)}`
  expect((await post("/doom/create", { deck: id }, session)).json).toMatchObject({ ok: true })
  return id
}

it("stores a picture for a Doom deck by hash and hands it to a second session once it lands", async () => {
  const id = await doomDeck()
  expect((await post("/decks/media", { deck: id, sha256 })).json).toEqual({ ok: false, refusal: "missing" })
  const signed = await upload(id)
  store.put(signed.url, bytes, signed.headers)
  const second = await signInByCode(base, mails, "media@example.com")
  const reply = await post("/decks/media", { deck: id, sha256 }, second)
  expect(reply.json).toMatchObject({ ok: true, bytes: bytes.length, sha256 })
  expect(Buffer.from(store.get((reply.json as { url: string }).url))).toEqual(bytes)
})

it("answers owner to another account asking for a Doom deck's picture", async () => {
  const id = await doomDeck()
  await upload(id)
  const other = await signInByCode(base, mails, "other-media@example.com")
  expect((await post("/decks/media", { deck: id, sha256 }, other)).json).toEqual({ ok: false, refusal: "owner" })
  expect((await post("/decks/media/upload", { deck: id, bytes: bytes.length, sha256 }, other)).json).toEqual({
    ok: false,
    refusal: "owner",
  })
})

it("keeps a Doom deck's pictures within the same size limits", async () => {
  const id = await doomDeck()
  expect((await post("/decks/media/upload", { deck: id, bytes: limits.media, sha256 })).json).toEqual({
    ok: false,
    refusal: "limit",
  })
})

it("queues a Doom deck's picture objects for removal when its account is deleted", async () => {
  const email = "doom-media-leaving@example.com"
  const leaving = await signInByCode(base, mails, email)
  const id = await doomDeck(leaving)
  await post("/decks/media/upload", { deck: id, bytes: bytes.length, sha256 }, leaving)
  const [key] = await keys(id)
  expect(key).toBeDefined()
  await admin.query("select session.delete_account($1)", [email])
  expect(await keys(id)).toEqual([])
  expect((await admin.query("select key from deck.original_delete where key = $1", [key])).rows).toEqual([{ key }])
})
