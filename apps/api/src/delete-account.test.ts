import { Client } from "pg"
import { afterAll, beforeAll, expect, it } from "vitest"
import { accountRoutes, deckRoutes, oauthRoutes } from "@airdesign/catalog"

import { fuzzAira } from "./testing/aira-fuzz.js"
import {
  emptied,
  fillAccount,
  mcpStatus,
  personalRows,
  signIn,
  storedKeys,
  type Served,
} from "./testing/filled-account.js"
import { ask, askForm, postgresInfo, serve } from "./testing/harness.js"
import { DeckListen, openPool, type Mail, type Sql } from "./index.js"
import { LocalOriginalStore } from "./platform/local-original-store.js"
import { drainOriginals } from "./doom/original.js"

const cleared = "airdesign.session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
const mails: Mail[] = []
const store = new LocalOriginalStore()
let served: Served = { base: "", mails, store }
let admin = new Client()
let deckSql: Sql = admin
let close = async () => {}

beforeAll(async () => {
  const info = await postgresInfo()
  const session = openPool(info.session, "delete-account-session")
  const deck = openPool(info.deck, "delete-account-deck")
  const listen = new DeckListen(info.listen)
  admin = new Client({ connectionString: info.admin })
  await admin.connect()
  deckSql = deck
  const api = await serve({
    session,
    deck,
    listen,
    originals: store,
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

function deleteAccount(body: unknown, cookie?: string, extra?: Record<string, string>) {
  return ask(served.base, "POST", accountRoutes.delete.path, body, cookie, extra)
}

it("refuses a delete that does not name the signed-in account and keeps every row", async () => {
  const person = await fillAccount(served, admin, "keep@example.com")
  const before = await personalRows(admin, person)
  for (const body of [{ email: "other@example.com" }, {}, { email: person.email, extra: 1 }, undefined]) {
    const refused = await deleteAccount(body, person.cookie)
    expect(refused.status).toBe(400)
    expect(refused.json).toEqual({ ok: false, refusal: "field" })
  }
  const plain = await fetch(`${served.base}${accountRoutes.delete.path}`, {
    method: "POST",
    headers: { "content-type": "text/plain", cookie: person.cookie },
    body: JSON.stringify({ email: person.email }),
  })
  expect(plain.status).toBe(400)
  expect((await deleteAccount({ email: person.email })).status).toBe(401)
  const bearer = await deleteAccount({ email: person.email }, undefined, { authorization: `Bearer ${person.access}` })
  expect(bearer.status).toBe(401)
  expect(await personalRows(admin, person)).toEqual(before)
  expect(storedKeys(store, person.email)).toHaveLength(2)
  expect((await ask(served.base, "POST", deckRoutes.list.path, {}, person.cookie)).status).toBe(200)
})

it("deletes every row and stored file of the account, refuses its credentials, and leaves another account as it was", async () => {
  const person = await fillAccount(served, admin, "gone@example.com")
  const other = await fillAccount(served, admin, "stay@example.com")
  const before = await personalRows(admin, person)
  const otherRows = await personalRows(admin, other)
  expect(emptied(before)).toEqual(["session.aira_ask", "session.agent_turn", "deck.original_delete"])
  expect(await mcpStatus(served, person.access)).toBe(200)

  const deleted = await deleteAccount({ email: " Gone@Example.com " }, person.cookie)
  expect(deleted.status).toBe(200)
  expect(deleted.json).toEqual({ ok: true })
  expect(deleted.headers["set-cookie"]).toEqual([
    cleared,
    "airdesign.account=; Secure; SameSite=Lax; Path=/; Max-Age=0",
  ])
  expect(storedKeys(store, person.email)).toEqual([])

  await admin.query("update deck.original_delete set expires = now() where owner = $1", [person.email])
  await drainOriginals(deckSql, store)
  expect(emptied(await personalRows(admin, person))).toEqual(Object.keys(before))
  expect(await personalRows(admin, other)).toEqual(otherRows)
  expect(storedKeys(store, other.email)).toHaveLength(2)

  const listed = await ask(served.base, "POST", deckRoutes.list.path, {}, person.cookie)
  expect([listed.status, listed.json]).toEqual([401, { ok: false, refusal: "session" }])
  expect((await deleteAccount({ email: person.email }, person.cookie)).status).toBe(401)
  expect(await mcpStatus(served, person.access)).toBe(401)
  expect(await mcpStatus(served, other.access)).toBe(200)
  const refreshed = await askForm(served.base, oauthRoutes.token.path, {
    grant_type: "refresh_token",
    refresh_token: person.refresh,
    client_id: person.clientId,
  })
  expect(refreshed.json).toEqual({ error: "invalid_grant" })

  const again = await signIn(served, person.email)
  const fresh = await ask(served.base, "POST", deckRoutes.list.path, {}, again)
  expect(fresh.json).toEqual({ ok: true, account: { email: person.email }, decks: [], trash: [] })
  expect(await personalRows(admin, person)).toEqual({
    ...Object.fromEntries(Object.keys(before).map((table) => [table, 0])),
    "session.account": 1,
    "session.access": 1,
    "session.sent": 1,
  })
})
