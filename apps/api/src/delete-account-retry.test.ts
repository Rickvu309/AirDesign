import { Client } from "pg"
import { afterAll, beforeAll, expect, it } from "vitest"
import { accountRoutes, deckRoutes } from "@airdesign/catalog"

import { fuzzAira } from "./aira-fuzz.js"
import { emptied, fillAccount, mcpStatus, personalRows, storedKeys, type Served } from "./filled-account.js"
import { ask, postgresInfo, serve } from "./harness.js"
import { DeckListen, openPool, type Mail, type OriginalStore, type Sql } from "./index.js"
import { LocalOriginalStore } from "./local-original-store.js"
import { drainOriginals } from "./original.js"

const mails: Mail[] = []
const store = new LocalOriginalStore()
let broken = false
const originals: OriginalStore = {
  upload: (key, bytes) => store.upload(key, bytes),
  download: (key) => store.download(key),
  size: (key) => store.size(key),
  delete: async (key) => {
    if (broken) throw new Error("storage")
    await store.delete(key)
  },
}
let served: Served = { base: "", mails, store }
let admin = new Client()
let adminUrl = ""
let deckSql: Sql = admin
let close = async () => {}

beforeAll(async () => {
  const info = await postgresInfo()
  const session = openPool(info.session, "delete-account-retry-session")
  const deck = openPool(info.deck, "delete-account-retry-deck")
  const listen = new DeckListen(info.listen)
  adminUrl = info.admin
  admin = new Client({ connectionString: info.admin })
  await admin.connect()
  deckSql = deck
  const api = await serve({
    session,
    deck,
    listen,
    originals,
    publicOrigin: "https://app.example",
    siteOrigin: "https://site.example",
    aira: fuzzAira,
    send: async (mail) => {
      mails.push(mail)
    },
  })
  served = { base: api.base, mails, store }
  close = async () => {
    await api.close()
    await listen.close()
    await Promise.all([session.end(), deck.end(), admin.end()])
  }
})

afterAll(async () => {
  await close()
})

function deleteAccount(email: string, cookie: string) {
  return ask(served.base, "POST", accountRoutes.delete.path, { email }, cookie)
}

async function waitingDelete(): Promise<number> {
  const started = Date.now()
  for (;;) {
    const found = await admin.query<{ pid: number }>(
      `select pid from pg_stat_activity
       where query like 'select session.delete_account%' and wait_event_type = 'Lock'`,
    )
    const pid = found.rows[0]?.pid
    if (pid !== undefined) return pid
    if (Date.now() - started > 4000) throw new Error("the delete did not wait for the held deck")
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

it("rolls back a delete that dies midway, so the account works whole, and deletes it all on a retry", async () => {
  const person = await fillAccount(served, admin, "midway@example.com")
  const before = await personalRows(admin, person)
  const holder = new Client({ connectionString: adminUrl })
  await holder.connect()
  try {
    await holder.query("begin")
    await holder.query("select id from deck.saved where owner = $1 for update", [person.email])
    const pending = deleteAccount(person.email, person.cookie)
    await admin.query("select pg_cancel_backend($1)", [await waitingDelete()])
    expect((await pending).status).toBe(500)
    await holder.query("rollback")
  } finally {
    await holder.end()
  }
  expect(await personalRows(admin, person)).toEqual(before)
  expect(storedKeys(store, person.email)).toHaveLength(2)
  expect((await ask(served.base, "POST", deckRoutes.list.path, {}, person.cookie)).status).toBe(200)
  expect(await mcpStatus(served, person.access)).toBe(200)

  expect((await deleteAccount(person.email, person.cookie)).status).toBe(200)
  expect(storedKeys(store, person.email)).toEqual([])
  expect(emptied(await personalRows(admin, person))).toEqual(
    Object.keys(before).filter((table) => table !== "deck.original_delete"),
  )
})

it("deletes the stored files on a later drain when the store fails during the delete", async () => {
  const person = await fillAccount(served, admin, "stored@example.com")
  broken = true
  const deleted = await deleteAccount(person.email, person.cookie)
  broken = false
  expect(deleted.status).toBe(200)
  const left = await personalRows(admin, person)
  expect(left["deck.original_delete"]).toBe(2)
  expect(emptied(left)).toEqual(Object.keys(left).filter((table) => table !== "deck.original_delete"))
  expect(storedKeys(store, person.email)).toHaveLength(2)

  await admin.query("update deck.original_delete set expires = now() where owner = $1", [person.email])
  await drainOriginals(deckSql, originals)
  expect(storedKeys(store, person.email)).toEqual([])
  expect(emptied(await personalRows(admin, person))).toEqual(Object.keys(left))
})
