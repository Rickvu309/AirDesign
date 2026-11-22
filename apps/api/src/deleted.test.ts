import { createHash, randomBytes } from "node:crypto"
import { Client } from "pg"
import { afterAll, beforeAll, expect, it } from "vitest"

import { ask, signInByCode, postgresInfo, serve } from "./testing/harness.js"
import { DeckListen, openPool, type Mail, type OriginalUpload, type Sql } from "./index.js"
import { LocalOriginalStore } from "./platform/local-original-store.js"

type Reply = { readonly status: number; readonly json: unknown }
type Gate = { readonly reached: Promise<void>; readonly release: () => void }

const bytes = Buffer.from("original presentation")
const sha256 = createHash("sha256").update(bytes).digest("hex")
const batch = [{ value: "typed", node: "258.7" }]
const deletedAnswer = { ok: false, refusal: "deleted" }
const ownerAnswer = { ok: false, refusal: "owner" }
const store = new LocalOriginalStore()
const mails: Mail[] = []
let base = ""
let cookie = ""
let otherCookie = ""
let admin = new Client()
let pause: ((sql: string) => Promise<void>) | undefined
let late: ((sql: string) => Promise<void>) | undefined
let close = async () => {}

function deckName(): string {
  return `gone${randomBytes(4).toString("hex")}`
}

function address(mark: string): string {
  return `${mark}${randomBytes(4).toString("hex")}@example.com`
}

const sign = (email: string): Promise<string> => signInByCode(base, mails, email)

async function post(path: string, body: unknown, session = cookie): Promise<Reply> {
  return ask(base, "POST", path, body, session)
}

async function row(deck: string): Promise<Record<string, unknown> | undefined> {
  const found = await admin.query("select * from deck.saved where id = $1", [deck])
  return found.rows[0] as Record<string, unknown> | undefined
}

async function rows(deck: string): Promise<number> {
  const found = await admin.query<{ count: number }>("select count(*)::int as count from deck.saved where id = $1", [
    deck,
  ])
  return found.rows[0]?.count ?? -1
}

async function opened(): Promise<string> {
  const deck = deckName()
  expect((await post("/decks/open", { deck })).json).toMatchObject({ ok: true, revision: 0 })
  return deck
}

async function deletedForGood(): Promise<string> {
  const deck = await opened()
  expect((await post("/decks/commit", { deck, batch, once: "first" })).json).toMatchObject({ ok: true, revision: 1 })
  await post("/decks/trash", { deck })
  expect((await post("/decks/delete", { decks: [deck] })).json).toEqual({ ok: true, deleted: [deck] })
  return deck
}

async function purged(): Promise<string> {
  const deck = await opened()
  await post("/decks/commit", { deck, batch })
  await post("/decks/trash", { deck })
  await admin.query("update deck.saved set trashed = now() - interval '31 days' where id = $1", [deck])
  await post("/decks/list", {})
  return deck
}

function routes(deck: string): [string, unknown][] {
  return [
    ["/decks/open", { deck }],
    ["/decks/commit", { deck, batch, once: "pending" }],
    ["/decks/watch", { deck, cursor: null }],
    ["/decks/watch", { deck, cursor: 0 }],
    ["/decks/rename", { deck, name: "back" }],
    ["/decks/trash", { deck }],
    ["/decks/restore", { deck }],
    ["/decks/original/upload", { deck, bytes: bytes.length, sha256 }],
    ["/decks/original/done", { deck }],
    ["/decks/original", { deck }],
  ]
}

async function answers(deck: string, session = cookie): Promise<unknown[]> {
  const found: unknown[] = []
  for (const [path, body] of routes(deck)) found.push((await post(path, body, session)).json)
  return found
}

function gate(match: (sql: string) => boolean): Gate {
  let reach = () => {}
  let release = () => {}
  const reached = new Promise<void>((resolve) => {
    reach = resolve
  })
  const opened = new Promise<void>((resolve) => {
    release = resolve
  })
  pause = async (sql) => {
    if (!match(sql)) return
    pause = undefined
    reach()
    await opened
  }
  return { reached, release }
}

async function waiters(name: string, count: number): Promise<void> {
  const started = Date.now()
  for (;;) {
    const found = await admin.query<{ count: number }>(
      "select count(*)::int as count from pg_stat_activity where application_name = $1 and wait_event_type = 'Lock'",
      [name],
    )
    if ((found.rows[0]?.count ?? 0) >= count) return
    if (Date.now() - started > 5000) throw new Error("the statements did not wait")
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

beforeAll(async () => {
  const info = await postgresInfo()
  const session = openPool(info.session, "deleted-session")
  const pool = openPool(info.deck, "deleted-deck")
  const gated = new Proxy(pool, {
    get(target, prop, receiver) {
      if (prop !== "query") return Reflect.get(target, prop, receiver)
      const query = target.query.bind(target) as (sql: unknown, params?: unknown[]) => Promise<unknown>
      return async (sql: unknown, params?: unknown[]) => {
        if (pause !== undefined && typeof sql === "string") await pause(sql)
        const result = await query(sql, params)
        if (late !== undefined && typeof sql === "string") await late(sql)
        return result
      }
    },
  }) as Sql
  const listen = new DeckListen(info.listen)
  admin = new Client({ connectionString: info.admin, application_name: "deleted-admin" })
  await admin.connect()
  const served = await serve({
    session,
    deck: gated,
    listen,
    originals: store,
    publicOrigin: "https://app.example",
    siteOrigin: "https://site.example",
    send: async (mail) => {
      mails.push(mail)
    },
  })
  base = served.base
  cookie = await sign(address("owner"))
  otherCookie = await sign(address("other"))
  close = async () => {
    await served.close()
    await listen.close()
    await session.end()
    await pool.end()
    await admin.end()
  }
})

afterAll(async () => {
  await close()
})

const readsDeck = (sql: string): boolean => sql.startsWith("select id, revision, register,")

it("a reload after delete for good does not bring the deck back", async () => {
  const deck = await deletedForGood()
  const before = await row(deck)
  const reload = await post("/decks/open", { deck })
  expect(reload.status).toBe(200)
  expect(reload.json).toEqual(deletedAnswer)
  expect(await rows(deck)).toBe(1)
  expect(await row(deck)).toEqual(before)
})

it("a pending commit after delete for good is refused with deleted and writes nothing", async () => {
  const deck = await deletedForGood()
  const before = await row(deck)
  expect((await post("/decks/commit", { deck, batch, once: "first" })).json).toEqual(deletedAnswer)
  expect((await post("/decks/commit", { deck, batch, once: "later" })).json).toEqual(deletedAnswer)
  expect((await post("/decks/commit", { deck, batch })).json).toEqual(deletedAnswer)
  expect(await row(deck)).toEqual(before)
})

it("every deck route answers deleted to the owner of a deck deleted for good and changes nothing", async () => {
  const deck = await deletedForGood()
  const before = await row(deck)
  expect(await answers(deck)).toEqual(routes(deck).map(() => deletedAnswer))
  expect(await row(deck)).toEqual(before)
})

it("a watch held on a deck answers deleted when it is deleted for good", async () => {
  const deck = await opened()
  await post("/decks/trash", { deck })
  const held = post("/decks/watch", { deck, cursor: 0 })
  await new Promise((resolve) => setTimeout(resolve, 100))
  await post("/decks/delete", { decks: [deck] })
  expect((await held).json).toEqual(deletedAnswer)
})

it("another account gets owner for a deleted deck id, the same as for a deck it does not own", async () => {
  const deck = await deletedForGood()
  const live = await opened()
  const before = await row(deck)
  const deletedReplies = await answers(deck, otherCookie)
  expect(deletedReplies).toEqual(routes(deck).map(() => ownerAnswer))
  expect(await answers(live, otherCookie)).toEqual(deletedReplies)
  expect(await row(deck)).toEqual(before)
  const purgedDeck = await purged()
  expect(await answers(purgedDeck, otherCookie)).toEqual(routes(purgedDeck).map(() => ownerAnswer))
})

it("the purge after 30 days in Trash gives the same answers as a delete for good", async () => {
  const deck = await purged()
  const before = await row(deck)
  expect(before).toMatchObject({ register: null, name: "", trashed: null })
  expect(await answers(deck)).toEqual(routes(deck).map(() => deletedAnswer))
  expect(await row(deck)).toEqual(before)
})

it("the deck list shows a deck deleted for good or purged in neither list", async () => {
  const deleted = await deletedForGood()
  const old = await purged()
  const listed = (await post("/decks/list", {})).json as { decks: { deck: string }[]; trash: { deck: string }[] }
  const shown = [...listed.decks, ...listed.trash].map((entry) => entry.deck)
  expect(shown).not.toContain(deleted)
  expect(shown).not.toContain(old)
})

it("a deck deleted for good keeps no register, name, original or once key", async () => {
  const deck = await opened()
  await post("/decks/commit", { deck, batch, once: "kept" })
  await post("/decks/rename", { deck, name: "Quarterly plan" })
  const signed = (await post("/decks/original/upload", { deck, bytes: bytes.length, sha256 })).json as OriginalUpload
  store.put(signed.url, bytes, signed.headers)
  expect((await post("/decks/original/done", { deck })).json).toEqual({ ok: true })
  const object = (await row(deck))?.original_key as string
  await post("/decks/trash", { deck })
  await post("/decks/delete", { decks: [deck] })
  const stored = await row(deck)
  expect(stored).toMatchObject({
    id: deck,
    register: null,
    name: "",
    trashed: null,
    original_key: null,
    original_bytes: null,
    original_sha256: null,
    original_stored: false,
    original_until: null,
  })
  expect(stored?.deleted).toBeInstanceOf(Date)
  expect(typeof stored?.owner).toBe("string")
  const once = await admin.query("select 1 from deck.once where deck = $1", [deck])
  expect(once.rowCount).toBe(0)
  expect(await store.size(object)).toBeUndefined()
})

it("a delete for good of a deck already deleted lists nothing as deleted", async () => {
  const deck = await deletedForGood()
  const before = await row(deck)
  expect((await post("/decks/delete", { decks: [deck] })).json).toEqual({ ok: true, deleted: [] })
  expect(await row(deck)).toEqual(before)
})

it("a deck only in Trash still opens, commits and watches with no deleted answer", async () => {
  const deck = await opened()
  await post("/decks/trash", { deck })
  expect((await post("/decks/open", { deck })).json).toMatchObject({ ok: true, deck, revision: 0 })
  expect((await post("/decks/commit", { deck, batch })).json).toEqual({
    ok: true,
    deck,
    revision: 1,
    key: `${deck}:1`,
  })
  expect((await post("/decks/watch", { deck, cursor: 0 })).json).toEqual({ ok: true, deck, revision: 1 })
  expect((await post("/decks/rename", { deck, name: "Kept" })).json).toEqual({ ok: true, deck, name: "Kept" })
  expect((await post("/decks/restore", { deck })).json).toEqual({ ok: true, deck })
  expect(await row(deck)).toMatchObject({ deleted: null, trashed: null, revision: 1 })
})

it("a delete for good that lands before a waiting commit refuses the commit and leaves no open deck", async () => {
  const deck = await opened()
  await post("/decks/trash", { deck })
  const info = await postgresInfo()
  const holder = new Client({ connectionString: info.deck, application_name: "deleted-holder" })
  await holder.connect()
  try {
    await holder.query("begin")
    await holder.query("select 1 from deck.saved where id = $1 for update", [deck])
    const deleted = post("/decks/delete", { decks: [deck] })
    await waiters("deleted-deck", 1)
    const commit = post("/decks/commit", { deck, batch, once: "late" })
    await waiters("deleted-deck", 2)
    await holder.query("commit")
    expect((await deleted).json).toEqual({ ok: true, deleted: [deck] })
    expect((await commit).json).toEqual(deletedAnswer)
  } finally {
    await holder.query("rollback").catch(() => undefined)
    await holder.end()
  }
  expect(await row(deck)).toMatchObject({ register: null, revision: 0 })
  expect((await post("/decks/open", { deck })).json).toEqual(deletedAnswer)
})

it("a commit that lands before a waiting delete for good is removed with the deck and leaves no open deck", async () => {
  const deck = await opened()
  await post("/decks/trash", { deck })
  const info = await postgresInfo()
  const holder = new Client({ connectionString: info.deck, application_name: "deleted-holder" })
  await holder.connect()
  try {
    await holder.query("begin")
    await holder.query("select 1 from deck.saved where id = $1 for update", [deck])
    const commit = post("/decks/commit", { deck, batch, once: "early" })
    await waiters("deleted-deck", 1)
    const deleted = post("/decks/delete", { decks: [deck] })
    await waiters("deleted-deck", 2)
    await holder.query("commit")
    expect((await commit).json).toEqual({ ok: true, deck, revision: 1, key: `${deck}:1` })
    expect((await deleted).json).toEqual({ ok: true, deleted: [deck] })
  } finally {
    await holder.query("rollback").catch(() => undefined)
    await holder.end()
  }
  expect(await row(deck)).toMatchObject({ register: null })
  const once = await admin.query("select 1 from deck.once where deck = $1", [deck])
  expect(once.rowCount).toBe(0)
  expect((await post("/decks/open", { deck })).json).toEqual(deletedAnswer)
})

it("an open that starts before a delete for good and reads after it creates nothing", async () => {
  const deck = await opened()
  await post("/decks/trash", { deck })
  const held = gate(readsDeck)
  const reload = post("/decks/open", { deck })
  await held.reached
  expect((await post("/decks/delete", { decks: [deck] })).json).toEqual({ ok: true, deleted: [deck] })
  held.release()
  expect((await reload).json).toEqual(deletedAnswer)
  expect(await rows(deck)).toBe(1)
  expect(await row(deck)).toMatchObject({ register: null })
})

it("an open that reads before a delete for good lands leaves no open deck after the delete", async () => {
  const deck = await opened()
  await post("/decks/trash", { deck })
  let reach = () => {}
  let release = () => {}
  const reached = new Promise<void>((resolve) => {
    reach = resolve
  })
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  late = async (sql) => {
    if (!readsDeck(sql)) return
    late = undefined
    reach()
    await released
  }
  const reload = post("/decks/open", { deck })
  await reached
  expect((await post("/decks/delete", { decks: [deck] })).json).toEqual({ ok: true, deleted: [deck] })
  release()
  expect((await reload).json).toMatchObject({ ok: true, deck, revision: 0 })
  expect(await rows(deck)).toBe(1)
  expect(await row(deck)).toMatchObject({ register: null })
  expect((await post("/decks/open", { deck })).json).toEqual(deletedAnswer)
})

it("the deck role cannot remove or recreate the row of a deck deleted for good", async () => {
  const deck = await deletedForGood()
  const info = await postgresInfo()
  const role = new Client({ connectionString: info.deck })
  await role.connect()
  try {
    await expect(role.query("delete from deck.saved where id = $1", [deck])).rejects.toThrow(/permission denied/)
    await expect(role.query("update deck.saved set register = '{}'::jsonb where id = $1", [deck])).rejects.toThrow(
      /saved_deleted_empty/,
    )
    const inserted = await role.query(
      "insert into deck.saved (id, revision, register, owner) values ($1, 0, '{}'::jsonb, 'x@example.com') on conflict (id) do nothing",
      [deck],
    )
    expect(inserted.rowCount).toBe(0)
  } finally {
    await role.end()
  }
})

it("a deck id never seen still opens empty and a commit to an unseen id answers deck", async () => {
  const unseen = deckName()
  expect((await post("/decks/commit", { deck: unseen, batch })).json).toEqual({ ok: false, refusal: "deck" })
  expect(await rows(unseen)).toBe(0)
  const fresh = deckName()
  expect((await post("/decks/open", { deck: fresh })).json).toMatchObject({ ok: true, deck: fresh, revision: 0 })
  expect(await row(fresh)).toMatchObject({ deleted: null, revision: 0 })
})
