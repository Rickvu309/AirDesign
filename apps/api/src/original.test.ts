import { createHash } from "node:crypto"
import { Client } from "pg"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import { limits } from "@airdesign/document"

import { ask, signInByCode, postgresInfo, serve } from "./harness.js"
import { DeckListen, openPool, type Mail, type OriginalUpload } from "./index.js"
import { LocalOriginalStore } from "./local-original-store.js"
import { drainOriginals } from "./original.js"

const bytes = Buffer.from("original presentation")
const sha256 = createHash("sha256").update(bytes).digest("hex")
const store = new LocalOriginalStore()
const mails: Mail[] = []
let base = ""
let bare = ""
let cookie = ""
let admin = new Client()
let sequence = 0
let close = async () => {}

const sign = (email: string): Promise<string> => signInByCode(base, mails, email)

async function post(path: string, body: unknown, session = cookie, origin = base) {
  return ask(origin, "POST", path, body, session)
}

async function deck(): Promise<string> {
  const id = `original${String(++sequence)}`
  await post("/decks/open", { deck: id })
  return id
}

async function upload(id: string): Promise<OriginalUpload> {
  const reply = await post("/decks/original/upload", { deck: id, bytes: bytes.length, sha256 })
  expect(reply.status).toBe(200)
  expect(reply.json).toMatchObject({ ok: true })
  return reply.json as OriginalUpload
}

async function stored(): Promise<string> {
  const id = await deck()
  const signed = await upload(id)
  store.put(signed.url, bytes, signed.headers)
  expect((await post("/decks/original/done", { deck: id })).json).toEqual({ ok: true })
  return id
}

async function key(id: string): Promise<string> {
  const result = await admin.query<{ original_key: string }>("select original_key from deck.saved where id = $1", [id])
  const value = result.rows[0]?.original_key
  if (value === undefined) throw new Error("key")
  return value
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
  cookie = await sign("original@example.com")
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

it("upload then download on a second session returns the same bytes and digest", async () => {
  const id = await stored()
  const second = await sign("original@example.com")
  expect(second).not.toBe(cookie)
  const reply = await post("/decks/original", { deck: id }, second)
  expect(reply.status).toBe(200)
  expect(reply.json).toMatchObject({ ok: true, bytes: bytes.length, sha256 })
  const downloaded = store.get((reply.json as { url: string }).url)
  expect(Buffer.from(downloaded)).toEqual(bytes)
  expect(createHash("sha256").update(downloaded).digest("hex")).toBe(sha256)
})

it("another account and a missing deck get owner on every original route", async () => {
  const id = await stored()
  const other = await sign("other-original@example.com")
  for (const target of [id, "missing-original"]) {
    for (const [route, body] of [
      ["/decks/original", { deck: target }],
      ["/decks/original/done", { deck: target }],
      ["/decks/original/upload", { deck: target, bytes: bytes.length, sha256 }],
    ] as const) {
      const reply = await post(route, body, other)
      expect(reply.status).toBe(200)
      expect(reply.json).toEqual({ ok: false, refusal: "owner" })
    }
  }
})

it("every original route needs a session", async () => {
  for (const route of ["/decks/original", "/decks/original/done", "/decks/original/upload"]) {
    const reply = await ask(base, "POST", route, { deck: "missing" })
    expect(reply.status).toBe(401)
    expect(reply.json).toEqual({ ok: false, refusal: "session" })
  }
})

it("a second upload after done is present", async () => {
  const id = await stored()
  expect((await post("/decks/original/upload", { deck: id, bytes: 2, sha256 })).json).toEqual({
    ok: false,
    refusal: "present",
  })
})

it("done before the bytes is missing", async () => {
  const id = await deck()
  await upload(id)
  expect((await post("/decks/original/done", { deck: id })).json).toEqual({ ok: false, refusal: "missing" })
})

it("done with the wrong size is missing", async () => {
  const id = await deck()
  await upload(id)
  store.objects.set(await key(id), new Uint8Array(1))
  expect((await post("/decks/original/done", { deck: id })).json).toEqual({ ok: false, refusal: "missing" })
})

it("a download before done is missing", async () => {
  const id = await deck()
  const signed = await upload(id)
  store.put(signed.url, bytes, signed.headers)
  expect((await post("/decks/original", { deck: id })).json).toEqual({ ok: false, refusal: "missing" })
})

it("over the file size limit is limit", async () => {
  const id = await deck()
  for (const size of [limits.bytes, limits.bytes + 1]) {
    expect((await post("/decks/original/upload", { deck: id, bytes: size, sha256 })).json).toEqual({
      ok: false,
      refusal: "limit",
    })
  }
  expect((await post("/decks/original/upload", { deck: id, bytes: limits.bytes - 1, sha256 })).json).toMatchObject({
    ok: true,
  })
})

it("a request cannot name the key", async () => {
  const id = await deck()
  for (const route of ["/decks/original", "/decks/original/done", "/decks/original/upload"]) {
    const body = route.endsWith("upload")
      ? { deck: id, bytes: bytes.length, sha256, key: "chosen" }
      : { deck: id, key: "chosen" }
    expect((await post(route, body)).json).toEqual({ ok: false, refusal: "field" })
  }
})

it("an upload refuses malformed sizes digests and deck ids", async () => {
  const id = await deck()
  for (const size of [-1, 1.5, null, "2", Number.MAX_SAFE_INTEGER + 1]) {
    expect((await post("/decks/original/upload", { deck: id, bytes: size, sha256 })).json).toEqual({
      ok: false,
      refusal: "field",
    })
  }
  for (const digest of ["", "g".repeat(64), "a".repeat(63), 7, null]) {
    expect((await post("/decks/original/upload", { deck: id, bytes: 1, sha256: digest })).json).toEqual({
      ok: false,
      refusal: "field",
    })
  }
  expect((await post("/decks/original/upload", { deck: "../bad", bytes: 1, sha256 })).json).toEqual({
    ok: false,
    refusal: "deck",
  })
})

it("no storage configured answers storage and the rest of the API works", async () => {
  const id = await deck()
  for (const [route, body] of [
    ["/decks/original", { deck: id }],
    ["/decks/original/done", { deck: id }],
    ["/decks/original/upload", { deck: id, bytes: bytes.length, sha256 }],
  ] as const) {
    const reply = await post(route, body, cookie, bare)
    expect(reply.status).toBe(200)
    expect(reply.json).toEqual({ ok: false, refusal: "storage" })
  }
  expect((await post("/decks/open", { deck: id }, cookie, bare)).json).toMatchObject({ ok: true, deck: id })
  expect((await ask(bare, "GET", "/health")).json).toEqual({ ok: true })
})

it("delete for good removes the object", async () => {
  const id = await stored()
  const object = await key(id)
  await post("/decks/trash", { deck: id })
  expect((await post("/decks/delete", { decks: [id] })).json).toEqual({ ok: true, deleted: [id] })
  expect(await store.size(object)).toBeUndefined()
  expect((await admin.query("select id from deck.saved where id = $1 and deleted is null", [id])).rows).toEqual([])
})

it("a purge survives storage being down and keeps the key for retry", async () => {
  const id = await stored()
  const object = await key(id)
  await admin.query("update deck.saved set trashed = now() - interval '31 days' where id = $1", [id])
  const failing = vi.spyOn(store, "delete").mockRejectedValue(new Error("offline"))
  const logged = vi.spyOn(process.stderr, "write").mockImplementation(() => true)
  try {
    const reply = await post("/decks/list", {})
    expect(reply.status).toBe(200)
    expect(reply.json).toMatchObject({ ok: true })
    expect((await admin.query("select id from deck.saved where id = $1 and deleted is null", [id])).rows).toEqual([])
    expect((await admin.query("select key from deck.original_delete where key = $1", [object])).rows).toEqual([
      { key: object },
    ])
    expect(logged).toHaveBeenCalledWith("api original delete failed: storage\n")
  } finally {
    failing.mockRestore()
    logged.mockRestore()
  }
  await admin.query("update deck.original_delete set expires = now() - interval '1 second' where key = $1", [object])
  await post("/decks/list", {})
  expect(await store.size(object)).toBeUndefined()
  expect((await admin.query("select key from deck.original_delete where key = $1", [object])).rows).toEqual([])
})

it("delete for good survives storage being down and retries later", async () => {
  const id = await stored()
  const object = await key(id)
  await post("/decks/trash", { deck: id })
  const failing = vi.spyOn(store, "delete").mockRejectedValue(new Error("offline"))
  const logged = vi.spyOn(process.stderr, "write").mockImplementation(() => true)
  try {
    expect((await post("/decks/delete", { decks: [id] })).json).toEqual({ ok: true, deleted: [id] })
    expect((await admin.query("select key from deck.original_delete where key = $1", [object])).rows).toEqual([
      { key: object },
    ])
    expect(logged).toHaveBeenCalledWith("api original delete failed: storage\n")
  } finally {
    failing.mockRestore()
    logged.mockRestore()
  }
  await post("/decks/list", {})
  expect(await store.size(object)).toBeUndefined()
})

it("retries an upload that was never confirmed", async () => {
  const id = await deck()
  const first = await upload(id)
  store.put(first.url, bytes, first.headers)
  const old = await key(id)
  const second = await upload(id)
  expect(second.url).not.toBe(first.url)
  expect(await key(id)).not.toBe(old)
  store.put(second.url, bytes, second.headers)
  expect((await post("/decks/original/done", { deck: id })).json).toEqual({ ok: true })
  await post("/decks/list", {})
  expect(await store.size(old)).toBeUndefined()
})

it("checks the latest upload's size when an upload is retried", async () => {
  const id = await deck()
  const first = await upload(id)
  store.put(first.url, bytes, first.headers)
  const latestBytes = Buffer.from("latest")
  const latestDigest = createHash("sha256").update(latestBytes).digest("hex")
  const reply = await post("/decks/original/upload", { deck: id, bytes: latestBytes.length, sha256: latestDigest })
  expect(reply.json).toMatchObject({ ok: true })
  const second = reply.json as OriginalUpload
  const latestKey = await key(id)
  store.objects.set(latestKey, bytes)
  expect((await post("/decks/original/done", { deck: id })).json).toEqual({ ok: false, refusal: "missing" })
  store.objects.delete(latestKey)
  store.put(second.url, latestBytes, second.headers)
  expect((await post("/decks/original/done", { deck: id })).json).toEqual({ ok: true })
  const downloaded = await post("/decks/original", { deck: id })
  expect(downloaded.json).toMatchObject({ ok: true, bytes: latestBytes.length, sha256: latestDigest })
})

it("an old upload cannot replace a stored original", async () => {
  const id = await deck()
  const signed = await upload(id)
  store.put(signed.url, bytes, signed.headers)
  await post("/decks/original/done", { deck: id })
  expect(() => store.put(signed.url, bytes, signed.headers)).toThrow("present")
})

it("a reopened deck cannot be damaged by an earlier upload or deletion retry", async () => {
  const id = await deck()
  const old = await upload(id)
  const oldKey = await key(id)
  await post("/decks/trash", { deck: id })
  await post("/decks/delete", { decks: [id] })
  expect((await post("/decks/open", { deck: id })).json).toEqual({ ok: false, refusal: "deleted" })
  expect((await post("/decks/original/upload", { deck: id, bytes: bytes.length, sha256 })).json).toEqual({
    ok: false,
    refusal: "deleted",
  })
  store.put(old.url, bytes, old.headers)
  await post("/decks/list", {})
  expect(await store.size(oldKey)).toBeUndefined()
  expect((await post("/decks/original/done", { deck: id })).json).toEqual({ ok: false, refusal: "deleted" })
})

it("deletes a newly trashed original despite an unexpired retry backlog", async () => {
  const backlog = Array.from({ length: 100 }, (_, index) => `backlog/${String(index)}`)
  await admin.query(
    `insert into deck.original_delete (key, owner, expires, attempted)
     select key, 'original@example.com', now() + interval '1 minute', '1970-01-01' from unnest($1::text[]) as key`,
    [backlog],
  )
  try {
    const id = await stored()
    const object = await key(id)
    await post("/decks/trash", { deck: id })
    expect((await post("/decks/delete", { decks: [id] })).json).toEqual({ ok: true, deleted: [id] })
    expect(await store.size(object)).toBeUndefined()
    const aged = await stored()
    const agedObject = await key(aged)
    await admin.query("update deck.saved set trashed = now() - interval '31 days' where id = $1", [aged])
    await post("/decks/list", {})
    expect(await store.size(agedObject)).toBeUndefined()
  } finally {
    await admin.query("delete from deck.original_delete where key = any($1::text[])", [backlog])
  }
})

it("retries failed original deletion after storage recovers without another account request", async () => {
  const id = await stored()
  const object = await key(id)
  await post("/decks/trash", { deck: id })
  const failing = vi.spyOn(store, "delete").mockRejectedValue(new Error("offline"))
  const logged = vi.spyOn(process.stderr, "write").mockImplementation(() => true)
  try {
    expect((await post("/decks/delete", { decks: [id] })).json).toEqual({ ok: true, deleted: [id] })
  } finally {
    failing.mockRestore()
    logged.mockRestore()
  }
  expect(await store.size(object)).toBe(bytes.length)
  await admin.query("update deck.original_delete set expires = now() - interval '1 second' where key = $1", [object])
  await drainOriginals(admin, store, { batch: 1000 })
  expect(await store.size(object)).toBeUndefined()
  expect((await admin.query("select key from deck.original_delete where key = $1", [object])).rows).toEqual([])
})

it("keeps draining the rows behind a row that always fails", async () => {
  await admin.query(
    `insert into deck.original_delete (key, owner, expires, attempted) values
     ('stuck/b', 'nobody@example.com', now() - interval '1 second', '1970-01-01'),
     ('stuck/a', 'nobody@example.com', now() - interval '1 second', '1970-01-02')`,
  )
  store.objects.set("stuck/a", bytes)
  const real = store.delete.bind(store)
  const failing = vi
    .spyOn(store, "delete")
    .mockImplementation(async (object) => (object === "stuck/b" ? Promise.reject(new Error("down")) : real(object)))
  const logged = vi.spyOn(process.stderr, "write").mockImplementation(() => true)
  try {
    await drainOriginals(admin, store, { batch: 1 })
    await drainOriginals(admin, store, { batch: 1 })
    expect(await store.size("stuck/a")).toBeUndefined()
    expect((await admin.query("select key from deck.original_delete where key like 'stuck/%'")).rows).toEqual([
      { key: "stuck/b" },
    ])
  } finally {
    failing.mockRestore()
    logged.mockRestore()
    await admin.query("delete from deck.original_delete where key like 'stuck/%'")
  }
})

it("scopes each original key to its account and deck", async () => {
  const account = (email: string) => createHash("sha256").update(email).digest("hex")
  const shared = `scoped${String(++sequence)}`
  await post("/decks/open", { deck: shared })
  await upload(shared)
  const first = await key(shared)
  await post("/decks/trash", { deck: shared })
  await post("/decks/delete", { decks: [shared] })
  const other = await sign("scope-other@example.com")
  const theirs = `${shared}x`
  await post("/decks/open", { deck: theirs }, other)
  expect(
    (await post("/decks/original/upload", { deck: theirs, bytes: bytes.length, sha256 }, other)).json,
  ).toMatchObject({ ok: true })
  const second = await key(theirs)
  const one = await deck()
  const two = await deck()
  await upload(one)
  await upload(two)
  expect(first.startsWith(`originals/${account("original@example.com")}/${shared}/`)).toBe(true)
  expect(second.startsWith(`originals/${account("scope-other@example.com")}/${theirs}/`)).toBe(true)
  expect((await key(one)).startsWith(`originals/${account("original@example.com")}/${one}/`)).toBe(true)
  expect((await key(two)).startsWith(`originals/${account("original@example.com")}/${two}/`)).toBe(true)
  expect(new Set([first, second, await key(one), await key(two)]).size).toBe(4)
})

it("keeps a deleted key until its actual signed upload expires", async () => {
  const id = await deck()
  const late = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  const real = store.upload.bind(store)
  const signing = vi.spyOn(store, "upload").mockImplementation(async (object, size) => ({
    ...(await real(object, size)),
    expires: late,
  }))
  try {
    await upload(id)
  } finally {
    signing.mockRestore()
  }
  const object = await key(id)
  await post("/decks/trash", { deck: id })
  await post("/decks/delete", { decks: [id] })
  const kept = await admin.query<{ expires: Date }>("select expires from deck.original_delete where key = $1", [object])
  expect(kept.rows[0]?.expires.getTime()).toBeGreaterThanOrEqual(Date.parse(late) + 60 * 1000)
})

it("leaves no object when a delete overtakes a stalled signer", async () => {
  const id = await deck()
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let entered = () => {}
  const reached = new Promise<void>((resolve) => {
    entered = resolve
  })
  const real = store.upload.bind(store)
  const signing = vi.spyOn(store, "upload").mockImplementation(async (object, size) => {
    entered()
    await gate
    return real(object, size)
  })
  try {
    const pending = post("/decks/original/upload", { deck: id, bytes: bytes.length, sha256 })
    await reached
    const object = await key(id)
    await admin.query("update deck.saved set original_until = now() - interval '1 minute' where id = $1", [id])
    await post("/decks/trash", { deck: id })
    await post("/decks/delete", { decks: [id] })
    release()
    const signed = (await pending).json as OriginalUpload
    store.put(signed.url, bytes, signed.headers)
    await drainOriginals(admin, store, { batch: 1000 })
    expect(await store.size(object)).toBeUndefined()
  } finally {
    release()
    signing.mockRestore()
  }
})
