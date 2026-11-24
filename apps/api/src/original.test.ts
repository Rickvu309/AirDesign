import { Client } from "pg"
import { afterAll, beforeAll, expect, it, vi } from "vitest"

import { ask, signInByCode, postgresInfo, serve } from "./testing/harness.js"
import { DeckListen, openPool, type Mail } from "./index.js"
import { LocalOriginalStore } from "./platform/local-original-store.js"
import { drainOriginals } from "./doom/original.js"

const bytes = Buffer.from("a picture on the deck")
const store = new LocalOriginalStore()
const mails: Mail[] = []
let base = ""
let cookie = ""
let admin = new Client()
let sequence = 0
let close = async () => {}

async function post(path: string, body: unknown) {
  return ask(base, "POST", path, body, cookie)
}

beforeAll(async () => {
  const info = await postgresInfo()
  const session = openPool(info.session)
  const db = openPool(info.deck)
  const listen = new DeckListen(info.listen)
  admin = new Client({ connectionString: info.admin })
  await admin.connect()
  const served = await serve({
    session,
    deck: db,
    listen,
    originals: store,
    publicOrigin: "https://app.example",
    siteOrigin: "https://site.example",
    send: async (mail: Mail) => {
      mails.push(mail)
    },
  })
  base = served.base
  cookie = await signInByCode(base, mails, "original@example.com")
  close = async () => {
    await served.close()
    await listen.close()
    await session.end()
    await db.end()
    await admin.end()
  }
})

afterAll(async () => {
  await close()
})

it("retries a failed picture deletion after storage recovers without another account request", async () => {
  const id = `drain${String(++sequence)}${String(Date.now())}`
  await post("/doom/create", { deck: id })
  const object = `media/drain/${id}/picture`
  await admin.query("insert into deck.media (key, deck, sha256, bytes) values ($1, $2, 'abc', $3)", [
    object,
    id,
    bytes.length,
  ])
  store.objects.set(object, bytes)
  await post("/decks/trash", { deck: id })
  const failing = vi.spyOn(store, "delete").mockRejectedValue(new Error("offline"))
  const logged = vi.spyOn(process.stderr, "write").mockImplementation(() => true)
  try {
    expect((await post("/decks/delete", { decks: [id] })).json).toEqual({ ok: true, deleted: [id] })
    await post("/decks/list", {})
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
