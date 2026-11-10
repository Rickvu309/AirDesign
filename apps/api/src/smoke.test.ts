import { randomBytes } from "node:crypto"
import { request } from "node:http"
import { Client } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { ask, cookieFrom, postgresInfo, serve } from "./harness.js"
import { DeckListen, openPool, type Mail, type Sql } from "./index.js"

const smokeToken = "smoke-token-for-this-file"

type Running = Awaited<ReturnType<typeof serve>>

const mails: Mail[] = []
let session: Sql
let deck: Sql
let listen: DeckListen
const servers: Running[] = []

async function start(extra: { readonly commit?: string; readonly smokeToken?: string }): Promise<Running> {
  const running = await serve({
    session,
    deck,
    listen,
    send: async (mail) => {
      mails.push(mail)
    },
    publicOrigin: "https://app.example",
    siteOrigin: "https://site.example",
    ...extra,
  })
  servers.push(running)
  return running
}

function bearer(token: string): { readonly authorization: string } {
  return { authorization: `Bearer ${token}` }
}

async function smokePost(base: string, headers: Record<string, string>): Promise<Awaited<ReturnType<typeof ask>>> {
  const url = new URL("/smoke/session", base)
  return new Promise((resolve, reject) => {
    const req = request({ method: "POST", hostname: "127.0.0.1", port: url.port, path: url.pathname, headers }, (res) => {
      const chunks: Buffer[] = []
      res.on("data", (chunk: Buffer) => {
        chunks.push(chunk)
      })
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8")
        resolve({ status: res.statusCode ?? 0, headers: res.headers, json: text === "" ? undefined : JSON.parse(text), text })
      })
    })
    req.on("error", reject)
    req.end()
  })
}

async function accountCount(email: string): Promise<number> {
  const info = await postgresInfo()
  const admin = new Client({ connectionString: info.admin })
  await admin.connect()
  try {
    const found = await admin.query<{ total: number }>("select count(*)::int as total from session.account where email = $1", [email])
    return found.rows[0]?.total ?? 0
  } finally {
    await admin.end()
  }
}

beforeAll(async () => {
  const info = await postgresInfo()
  session = openPool(info.session, "smoke-session")
  deck = openPool(info.deck, "smoke-deck")
  listen = new DeckListen(info.listen)
})

afterAll(async () => {
  for (const running of servers) await running.close().catch(() => undefined)
  await listen.close()
  await session.end()
  await deck.end()
})

describe("GET /version", () => {
  it("answers the commit the API was started with", async () => {
    const api = await start({ commit: "abc123def" })
    const reply = await ask(api.base, "GET", "/version")
    expect(reply.status).toBe(200)
    expect(reply.json).toEqual({ commit: "abc123def" })
  })

  it("answers unknown when no commit was given", async () => {
    const api = await start({})
    const reply = await ask(api.base, "GET", "/version")
    expect(reply.status).toBe(200)
    expect(reply.json).toEqual({ commit: "unknown" })
  })

  it("needs no session", async () => {
    const api = await start({ commit: "abc123def", smokeToken })
    expect((await ask(api.base, "GET", "/version")).status).toBe(200)
  })
})

describe("POST /smoke/session", () => {
  it("does not exist when no token is configured", async () => {
    const api = await start({})
    const reply = await smokePost(api.base, bearer(smokeToken))
    expect(reply.status).toBe(404)
    expect(reply.headers["set-cookie"]).toBeUndefined()
  })

  it("answers 404 to a wrong token", async () => {
    const api = await start({ smokeToken })
    const reply = await smokePost(api.base, bearer(`${smokeToken}x`))
    expect(reply.status).toBe(404)
    expect(reply.headers["set-cookie"]).toBeUndefined()
  })

  it("answers 404 to a token of a different length", async () => {
    const api = await start({ smokeToken })
    expect((await smokePost(api.base, bearer("s"))).status).toBe(404)
  })

  it("answers 404 to a missing header", async () => {
    const api = await start({ smokeToken })
    const reply = await smokePost(api.base, {})
    expect(reply.status).toBe(404)
    expect(reply.headers["set-cookie"]).toBeUndefined()
  })

  it("answers 404 to the right token without the Bearer word", async () => {
    const api = await start({ smokeToken })
    expect((await smokePost(api.base, { authorization: smokeToken })).status).toBe(404)
  })

  it("answers 404 to a GET with the right token", async () => {
    const api = await start({ smokeToken })
    const reply = await ask(api.base, "GET", "/smoke/session")
    expect(reply.status).toBe(404)
  })

  it("answers 200 with a cookie that opens a deck for the right token", async () => {
    const api = await start({ smokeToken })
    const reply = await smokePost(api.base, bearer(smokeToken))
    expect(reply.status).toBe(200)
    expect(reply.json).toEqual({ ok: true })
    const cookie = cookieFrom(reply.headers)
    if (cookie === undefined) throw new Error("cookie")
    const name = `smoke${randomBytes(4).toString("hex")}`
    const opened = await ask(api.base, "POST", "/decks/open", { deck: name }, cookie)
    expect(opened.status).toBe(200)
    expect(opened.json).toMatchObject({ ok: true, deck: name, revision: 0 })
  })

  it("sends no mail", async () => {
    const api = await start({ smokeToken })
    const before = mails.length
    await smokePost(api.base, bearer(smokeToken))
    expect(mails.length).toBe(before)
  })

  it("reuses the account on a second call", async () => {
    const api = await start({ smokeToken })
    const first = await smokePost(api.base, bearer(smokeToken))
    const second = await smokePost(api.base, bearer(smokeToken))
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(await accountCount("smoke@airdesign.app")).toBe(1)
    expect(cookieFrom(first.headers)).not.toBe(cookieFrom(second.headers))
  })

  it("lets the smoke account commit on element 1.1 of the deck smoke and read it back", async () => {
    const api = await start({ smokeToken })
    const cookie = cookieFrom((await smokePost(api.base, bearer(smokeToken))).headers)
    if (cookie === undefined) throw new Error("cookie")
    const before = (await ask(api.base, "POST", "/decks/open", { deck: "smoke" }, cookie)).json as { revision: number }
    const value = `value-${randomBytes(4).toString("hex")}`
    const wrote = await ask(api.base, "POST", "/decks/commit", { deck: "smoke", batch: [{ value, node: "1.1" }] }, cookie)
    expect(wrote.json).toMatchObject({ ok: true, revision: before.revision + 1 })
    const after = await ask(api.base, "POST", "/decks/open", { deck: "smoke" }, cookie)
    expect(after.json).toMatchObject({
      revision: before.revision + 1,
      register: { elements: { "1.1": { landed: [{ value }] } } },
    })
  })

  it("gives a cookie the other routes read as the smoke account", async () => {
    const api = await start({ smokeToken })
    const reply = await smokePost(api.base, bearer(smokeToken))
    const cookie = cookieFrom(reply.headers)
    if (cookie === undefined) throw new Error("cookie")
    const listed = await ask(api.base, "POST", "/decks/list", {}, cookie)
    expect(listed.status).toBe(200)
  })
})
