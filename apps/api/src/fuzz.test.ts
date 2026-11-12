import { createHash } from "node:crypto"
import { createServer, type IncomingMessage, type Server } from "node:http"
import { connect, type AddressInfo } from "node:net"
import type { Pool } from "pg"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { airaFuzzGood, airaFuzzSettings } from "./aira-fuzz.js"
import { attacks, type Attack } from "./fuzz-attack.js"
import { badTargets } from "./fuzz-target.js"
import { ask, askForm, cookieFrom, postgresInfo, serve, testResource } from "./harness.js"
import type { CallerLog } from "@airdesign/mcp"
import { DeckListen, openPool, type Mail } from "./index.js"
import { serveMcp } from "./mcp.js"
import { challengeOf } from "./secrets.js"
import { limits } from "@airdesign/document"
import { routes } from "./server.js"

const { body: bodyCap, form: formCap } = limits

type Wire = {
  readonly method: string
  readonly target: string
  readonly headers: readonly string[]
  readonly body?: Buffer
  readonly chunked?: true
  readonly host?: string
}

type Answer = {
  readonly status: number
  readonly text: string
}

type Good = {
  readonly shape: "json" | "form" | "query" | "none"
  readonly fields?: unknown
  readonly headers?: readonly string[]
  readonly answers: number
  readonly says?: string
}

const smokeToken = "fuzz-smoke-token"
const jsonType = "application/json"
const formType = "application/x-www-form-urlencoded"
const mcpAccept = "accept: application/json, text/event-stream"
const unreadSentence = "The request could not be read."

const hostileValues: readonly unknown[] = [
  null,
  true,
  -1,
  1.5,
  1e308,
  Number.MAX_SAFE_INTEGER + 2,
  "",
  "\u0000",
  "a\u0000b",
  "\ud800",
  "a\udc00b",
  "x".repeat(70_000),
  [],
  [[]],
  {},
  JSON.parse('{"__proto__":{"deck":"x"}}'),
]

const hostileEscapes: readonly string[] = ["", "%00", "a%00b", "%ED%A0%80", "%", "%E0%A4%A", "x".repeat(70_000)]

const leaks: readonly RegExp[] = [
  /\n\s+at /,
  /\bat [^\n]+:\d+:\d+/,
  /node_modules|node:internal|\/home\/|\/src\/|\.[cm]?[jt]s:\d/,
  /postgres:\/\//,
  /\b(select .+ from|insert into|delete from|update .+ set)\b/i,
  /syntax error at|invalid input syntax|invalid byte sequence|violates .+ constraint|unsupported unicode/i,
]

function complete(text: string, method: string): boolean {
  const split = text.indexOf("\r\n\r\n")
  if (split < 0) return false
  const head = text.slice(0, split).toLowerCase()
  const length = /content-length: (\d+)/.exec(head)?.[1]
  if (length !== undefined) return text.length - split - 4 >= Number(length)
  if (method === "GET" && head.includes("text/event-stream")) return true
  return text.endsWith("0\r\n\r\n")
}

function exchange(port: number, wire: Wire): Promise<Answer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    const socket = connect(port, "127.0.0.1")
    const finish = () => {
      socket.destroy()
      const text = Buffer.concat(chunks).toString("latin1")
      const status = /^HTTP\/1\.1 (\d{3})/.exec(text)?.[1]
      resolve({ status: status === undefined ? 0 : Number(status), text })
    }
    socket.setTimeout(10_000, finish)
    socket.on("data", (chunk) => {
      chunks.push(chunk)
      if (complete(Buffer.concat(chunks).toString("latin1"), wire.method)) finish()
    })
    socket.on("end", finish)
    socket.on("error", finish)
    socket.on("close", finish)
    const length = wire.body === undefined || wire.chunked === true ? [] : [`content-length: ${wire.body.length}`]
    const framing = wire.chunked === true ? ["transfer-encoding: chunked"] : length
    const lines = [
      `${wire.method} ${wire.target} HTTP/1.1`,
      `host: ${wire.host ?? "127.0.0.1"}`,
      "connection: close",
      ...wire.headers,
      ...framing,
    ]
    socket.write(Buffer.from(`${lines.join("\r\n")}\r\n\r\n`, "latin1"))
    if (wire.body === undefined) return
    if (wire.chunked === true) {
      socket.write(Buffer.from(`${wire.body.length.toString(16)}\r\n`, "latin1"))
      socket.write(wire.body)
      socket.write(Buffer.from("\r\n0\r\n\r\n", "latin1"))
      return
    }
    socket.write(wire.body)
  })
}

function replaced(value: unknown, path: readonly (string | number)[], hostile: unknown): unknown {
  const [step, ...rest] = path
  if (step === undefined) return hostile
  if (Array.isArray(value)) return value.map((item, index) => (index === step ? replaced(item, rest, hostile) : item))
  const record = value as Record<string, unknown>
  return { ...record, [step]: replaced(record[step], rest, hostile) }
}

function leaves(value: unknown, at: readonly (string | number)[] = []): (readonly (string | number)[])[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => leaves(item, [...at, index]))
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, item]) => leaves(item, [...at, key]))
  }
  return [at]
}

function encoded(fields: Readonly<Record<string, string>>): string {
  return Object.entries(fields)
    .map(([name, value]) => `${name}=${value}`)
    .join("&")
}

function methodsOf(method: string): readonly string[] {
  return method === "any" ? ["POST", "GET", "DELETE", "PUT", "HEAD", "OPTIONS", "PATCH"] : [method]
}

function shapedWire(method: string, path: string, good: Good, cookie: readonly string[], fields: unknown): Wire {
  const headers = [...cookie, ...(good.headers ?? [])]
  if (good.shape === "json") {
    return {
      method,
      target: path,
      headers: [...headers, `content-type: ${jsonType}`],
      body: Buffer.from(JSON.stringify(fields)),
    }
  }
  if (good.shape === "form") {
    return {
      method,
      target: path,
      headers: [...headers, `content-type: ${formType}`],
      body: Buffer.from(encoded(fields as Record<string, string>)),
    }
  }
  if (good.shape === "query") {
    return { method, target: `${path}?${encoded(fields as Record<string, string>)}`, headers }
  }
  return { method, target: path, headers }
}

function mutated(method: string, path: string, good: Good, cookie: readonly string[]): readonly [string, Wire][] {
  if (good.shape === "none") return []
  const paths = leaves(good.fields)
  const cases: [string, Wire][] = []
  for (const at of paths) {
    const values = good.shape === "json" ? hostileValues : hostileEscapes
    values.forEach((hostile, index) => {
      cases.push([
        `${at.join(".")} row ${String(index)}`,
        shapedWire(method, path, good, cookie, replaced(good.fields, at, hostile)),
      ])
    })
  }
  return cases
}

function attackWire(method: string, path: string, attack: Attack, signedInCookie: string | undefined): Wire {
  const cookie = [attack.cookie, signedInCookie].filter((part) => part !== undefined).join("; ")
  const body = typeof attack.body === "string" ? Buffer.from(attack.body, "latin1") : attack.body
  return {
    method: attack.method ?? method,
    target: `${attack.absolute ?? ""}${path}${attack.query ?? ""}`,
    headers: [
      ...(cookie.length === 0 ? [] : [`cookie: ${cookie}`]),
      ...(attack.type === undefined ? [] : [`content-type: ${attack.type}`]),
      ...(attack.headers ?? []),
      mcpAccept,
    ],
    ...(body === undefined ? {} : { body }),
    ...(attack.chunked === undefined ? {} : { chunked: attack.chunked }),
    ...(attack.host === undefined ? {} : { host: attack.host }),
  }
}

function wrongAnswer(answer: Answer): boolean {
  if (answer.status < 100 || answer.status >= 500) return true
  return answer.text.includes(unreadSentence) || leaks.some((leak) => leak.test(answer.text))
}

function record(name: string, answer: Answer): string {
  return `${name} answered ${String(answer.status)}: ${answer.text.slice(0, 300)}`
}

describe("hostile input over every route", () => {
  const mails: Mail[] = []
  const deck = "fuzzdeck"
  let base = ""
  let port = 0
  let cookie = ""
  const toolLogs = new Map<string, CallerLog>()
  let brokenBase = ""
  let sessionDb: Pool | undefined
  let apiServer: Server | undefined
  let accessToken = ""
  let thrown = new Error("unset")
  let close = async () => {}
  let goods: Readonly<Record<string, readonly Good[]>> = {}

  beforeAll(async () => {
    const info = await postgresInfo()
    const sessionPool = openPool(info.session, "fuzz-session")
    const deckPool = openPool(info.deck, "fuzz-deck")
    const listen = new DeckListen(info.listen)
    sessionDb = sessionPool
    const served = await serve({
      session: sessionPool,
      deck: deckPool,
      listen,
      publicOrigin: "https://app.example",
      siteOrigin: "https://site.example",
      smokeToken,
      logs: toolLogs,
      send: async (mail) => {
        mails.push(mail)
      },
      aira: airaFuzzSettings,
    })
    const broken = { query: () => Promise.reject(thrown) } as unknown as Pool
    const brokenListen = new DeckListen(info.listen)
    const brokenServed = await serve({
      session: broken,
      deck: broken,
      listen: brokenListen,
      publicOrigin: "https://app.example",
      siteOrigin: "https://site.example",
      send: async () => {},
    })
    brokenBase = brokenServed.base
    base = served.base
    apiServer = served.server
    port = Number(new URL(base).port)
    close = async () => {
      await brokenServed.close()
      await brokenListen.close()
      await served.close()
      await listen.close()
      await sessionPool.end()
      await deckPool.end()
    }
    await ask(base, "POST", "/sign-in/email", { email: "fuzz@example.com" })
    const code = mails[0]?.text.split("\n")[1]
    const signed = await ask(base, "POST", "/sign-in/code", { email: "fuzz@example.com", code })
    const signedCookie = cookieFrom(signed.headers)
    if (signedCookie === undefined) throw new Error("cookie")
    cookie = signedCookie
    await ask(base, "POST", "/decks/open", { deck }, cookie)
    const registered = await ask(base, "POST", "/oauth/register", { redirect_uris: ["https://client.example/cb"] })
    const clientId = (registered.json as { client_id: string }).client_id
    const redirect = "https://client.example/cb"
    const verifier = "v".repeat(43)
    const approved = await ask(
      base,
      "POST",
      "/oauth/approve",
      {
        client_id: clientId,
        redirect_uri: redirect,
        code_challenge: challengeOf(verifier),
        code_challenge_method: "S256",
      },
      cookie,
    )
    const issued = await askForm(base, "/oauth/token", {
      grant_type: "authorization_code",
      code: new URL((approved.json as { redirect: string }).redirect).searchParams.get("code") ?? "",
      code_verifier: verifier,
      client_id: clientId,
      redirect_uri: redirect,
    })
    accessToken = (issued.json as { access_token: string }).access_token
    goods = {
      "GET /.well-known/oauth-protected-resource": [{ shape: "none", answers: 200 }],
      "GET /.well-known/oauth-authorization-server": [{ shape: "none", answers: 200 }],
      "GET /health": [{ shape: "none", answers: 200 }],
      "GET /version": [{ shape: "none", answers: 200 }],
      "POST /smoke/session": [{ shape: "none", headers: [`authorization: Bearer ${smokeToken}`], answers: 200 }],
      "any /mcp": [
        {
          shape: "json",
          headers: [mcpAccept],
          answers: 200,
          says: "result",
          fields: {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: {
              name: "airdesign_edit_deck",
              arguments: { deck, base: 1, changes: [{ value: "v", node: "258.7", readAt: 0 }] },
            },
          },
        },
      ],
      "POST /oauth/register": [
        { shape: "json", answers: 201, fields: { redirect_uris: [redirect], client_name: "Fuzz" } },
      ],
      "POST /oauth/client": [
        { shape: "json", answers: 200, says: '"ok":true', fields: { client_id: clientId, redirect_uri: redirect } },
      ],
      "POST /oauth/approve": [
        {
          shape: "json",
          answers: 200,
          says: '"ok":true',
          fields: {
            client_id: clientId,
            redirect_uri: redirect,
            code_challenge: "a".repeat(43),
            code_challenge_method: "S256",
            state: "s",
            resource: testResource,
          },
        },
      ],
      "POST /oauth/token": [
        {
          shape: "form",
          answers: 400,
          says: "invalid_grant",
          fields: {
            grant_type: "authorization_code",
            code: "c",
            code_verifier: "v".repeat(43),
            client_id: clientId,
            redirect_uri: "https%3A%2F%2Fclient.example%2Fcb",
          },
        },
        {
          shape: "form",
          answers: 400,
          says: "invalid_grant",
          fields: { grant_type: "refresh_token", refresh_token: "r", client_id: clientId },
        },
      ],
      "POST /oauth/revoke": [{ shape: "form", answers: 200, fields: { token: "t" } }],
      ...airaFuzzGood,
      "POST /sign-in/email": [{ shape: "json", answers: 202, fields: { email: "good@example.com" } }],
      "POST /sign-in/code": [{ shape: "json", answers: 401, fields: { email: "good@example.com", code: "000000" } }],
      "GET /sign-in/link": [{ shape: "query", answers: 302, fields: { token: "t" } }],
      "POST /sign-out": [{ shape: "none", answers: 200 }],
      "POST /decks/open": [{ shape: "json", answers: 200, says: '"ok":true', fields: { deck } }],
      "POST /decks/commit": [
        {
          shape: "json",
          answers: 200,
          says: '"ok":true',
          fields: { deck, batch: [{ value: "v", node: "258.7", floor: "f" }] },
        },
        {
          shape: "json",
          answers: 200,
          says: '"ok":true',
          fields: { deck, batch: [{ value: "w", node: "258.7" }], once: "fuzzonce" },
        },
      ],
      "POST /decks/watch": [{ shape: "json", answers: 200, says: '"ok":true', fields: { deck, cursor: null } }],
      "POST /decks/list": [{ shape: "json", answers: 200, says: '"ok":true', fields: {} }],
      "POST /decks/rename": [{ shape: "json", answers: 200, says: '"ok":true', fields: { deck, name: "n" } }],
      "POST /decks/trash": [{ shape: "json", answers: 200, says: '"ok":true', fields: { deck } }],
      "POST /decks/restore": [{ shape: "json", answers: 200, says: '"ok":true', fields: { deck } }],
      "POST /decks/delete": [{ shape: "json", answers: 200, says: '"ok":true', fields: { decks: ["fuzzmissing"] } }],
      "POST /decks/original/upload": [
        {
          shape: "json",
          answers: 200,
          says: '"refusal":"storage"',
          fields: { deck, bytes: 4, sha256: "a".repeat(64) },
        },
      ],
      "POST /decks/original/done": [{ shape: "json", answers: 200, says: '"refusal":"storage"', fields: { deck } }],
      "POST /decks/original": [{ shape: "json", answers: 200, says: '"refusal":"storage"', fields: { deck } }],
    }
  })

  afterAll(async () => {
    await close()
  })

  function send(wire: Wire): Promise<Answer> {
    toolLogs.clear()
    return exchange(port, wire)
  }

  function keyOf(route: (typeof routes)[number]): string {
    return `${route.method} ${route.path}`
  }

  function signedHeaders(): readonly string[] {
    return [`cookie: ${cookie}`]
  }

  it("names a good request for every route the server answers", () => {
    expect(routes.map(keyOf).filter((key) => goods[key] === undefined)).toEqual([])
  })

  it("is answered as it says when nothing is hostile, so the table reaches the code behind each reader", async () => {
    const wrong: string[] = []
    for (const route of routes) {
      for (const good of goods[keyOf(route)] ?? []) {
        const method = route.method === "any" ? "POST" : route.method
        const answer = await send(shapedWire(method, route.path, good, signedHeaders(), good.fields))
        if (answer.status !== good.answers || !answer.text.includes(good.says ?? "")) {
          wrong.push(record(keyOf(route), answer))
        }
      }
    }
    expect(wrong).toEqual([])
  }, 20_000)

  for (const signed of [true, false]) {
    const state = signed ? "signed in" : "signed out"
    for (const route of routes) {
      it(`${route.method} ${route.path} ${state} never answers 500 or internal text`, async () => {
        const wrong: string[] = []
        const held = signed ? cookie : undefined
        for (const method of methodsOf(route.method)) {
          for (const attack of attacks) {
            const answer = await send(attackWire(method, route.path, attack, held))
            if (wrongAnswer(answer)) wrong.push(record(`${method} ${attack.name}`, answer))
          }
          if (method !== methodsOf(route.method)[0]) continue
          for (const good of goods[keyOf(route)] ?? []) {
            for (const [name, wire] of mutated(method, route.path, good, signed ? signedHeaders() : [])) {
              const answer = await send(wire)
              if (wrongAnswer(answer)) wrong.push(record(`${method} ${name}`, answer))
            }
          }
        }
        expect(wrong).toEqual([])
      }, 30_000)
    }
  }

  it("puts the fuzz session back after sign-out", async () => {
    if (sessionDb === undefined) throw new Error("session")
    const token = decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1))
    await sessionDb.query(
      "insert into session.access (token, email, issued) values ($1, 'fuzz@example.com', now()) on conflict (token) do update set issued = now()",
      [createHash("sha256").update(token).digest("hex")],
    )
  })

  it("never answers 500 to a request target that is not a URL", async () => {
    const wrong: string[] = []
    for (const target of badTargets) {
      const answer = await send({ method: "GET", target, headers: [] })
      if (wrongAnswer(answer)) wrong.push(record(target, answer))
    }
    expect(wrong).toEqual([])
  })

  it("refuses a method /mcp does not serve before the SDK sees it, signed in", async () => {
    for (const method of ["TRACE", "PUT", "PROPFIND"]) {
      const answer = await send({ method, target: "/mcp", headers: signedHeaders() })
      expect(answer.status).toBe(405)
      expect(answer.text).toContain('"refusal":"This address does not answer that method."')
    }
  })

  it("refuses an absolute target before the SDK sees it, signed in", async () => {
    const answer = await send({
      method: "POST",
      target: "http://evil.example/mcp",
      host: "127.0.0.1:8080",
      headers: [...signedHeaders(), `content-type: ${jsonType}`, mcpAccept],
      body: Buffer.from("{}"),
    })
    expect(answer.status).toBe(400)
    expect(answer.text).toContain('"refusal":"The request target could not be read."')
  })

  it("refuses a target naming another origin before the SDK sees it, signed in", async () => {
    for (const target of ["//evil.example/mcp", "/\\evil.example/mcp"]) {
      const answer = await send({
        method: "POST",
        target,
        headers: [...signedHeaders(), `content-type: ${jsonType}`, mcpAccept],
        body: Buffer.from("{}"),
      })
      expect(record(target, answer)).toContain("answered 400")
      expect(answer.text).toContain('"refusal":"The request target could not be read."')
    }
  })

  for (const host of [
    "user@127.0.0.1",
    "user:pass@127.0.0.1",
    "",
    "127.0.0.1:port",
    "127.0.0.1 evil",
    "caf\u00e9.example",
  ]) {
    it(`refuses the Host ${JSON.stringify(host)} on /mcp before the SDK sees it, signed in`, async () => {
      const answer = await send({
        method: "POST",
        target: "/mcp",
        host,
        headers: [...signedHeaders(), `content-type: ${jsonType}`, mcpAccept],
        body: Buffer.from("{}"),
      })
      expect(record(host, answer)).toContain("answered 400")
      expect(answer.text).toContain('"refusal":"The request host could not be read."')
    })
  }

  it("does not log a client that hangs up mid-body", async () => {
    const write = vi.spyOn(process.stderr, "write").mockReturnValue(true)
    const seen = new Promise<void>((resolve) => {
      apiServer?.once("request", (req: IncomingMessage) => {
        req.once("close", () => setImmediate(resolve))
        socket.destroy()
      })
    })
    const socket = connect(port, "127.0.0.1")
    socket.on("error", () => undefined)
    socket.write("POST /sign-in/email HTTP/1.1\r\nhost: 127.0.0.1\r\ncontent-length: 1000\r\n\r\n{")
    try {
      await seen
      await new Promise((resolve) => setImmediate(resolve))
      expect(write).not.toHaveBeenCalled()
    } finally {
      write.mockRestore()
    }
  })

  it("hands a failure inside the SDK to the boundary once", async () => {
    const failures: unknown[] = []
    const server = createServer((req, res) => {
      void serveMcp(
        {
          deck: {} as Pool,
          email: "a@example.com",
          logs: new Map(),
          turns: new Map(),
          now: () => 0,
          mint: () => "id",
          hosts: ["127.0.0.1"],
          bodyCap,
          fail: (error) => {
            failures.push(error)
            res.writeHead(500)
            res.end("fixed")
          },
        },
        req,
        res,
        Buffer.alloc(0),
      )
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()))
    try {
      const answer = await exchange((server.address() as AddressInfo).port, {
        method: "TRACE",
        target: "/mcp",
        headers: [],
      })
      expect(answer.status).toBe(500)
      expect(answer.text).toContain("fixed")
      expect(answer.text).not.toContain("jsonrpc")
      expect(failures).toHaveLength(1)
    } finally {
      await new Promise((resolve) => server.close(resolve))
    }
  })

  function mcpCall(toolArguments: unknown, headers: readonly string[]): Wire {
    return {
      method: "POST",
      target: "/mcp",
      headers: [...headers, `content-type: ${jsonType}`, mcpAccept],
      body: Buffer.from(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "airdesign_edit_deck", arguments: toolArguments },
        }),
      ),
    }
  }

  for (const hostile of ["a\u0000b", "\ud800", "a b"]) {
    it(`refuses MCP tool arguments naming the deck ${JSON.stringify(hostile)} before Postgres`, async () => {
      const answer = await send(mcpCall({ deck: hostile, base: 0, changes: [] }, signedHeaders()))
      expect(answer.status).toBe(200)
      expect(answer.text).not.toContain('"refusal":"store"')
      expect(answer.text).toContain('"refusal":"deck"')
    })
  }

  it("takes a bearer on /mcp only in the Bearer scheme", async () => {
    const good = await send(mcpCall({ deck, base: 0, changes: [] }, [`authorization: Bearer ${accessToken}`]))
    expect(good.status).toBe(200)
    for (const header of [accessToken, `Basic ${accessToken}`, `Basic  ${accessToken}`, `Bearer ${accessToken} x`]) {
      const answer = await send(mcpCall({ deck, base: 0, changes: [] }, [`authorization: ${header}`]))
      expect(record(header.slice(0, 7), answer)).toContain("answered 401")
    }
  })

  it("takes the smoke token only in the Bearer scheme", async () => {
    for (const header of [smokeToken, `Basic ${smokeToken}`, `Basic  ${smokeToken}`, `Bearer ${smokeToken} x`]) {
      const answer = await send({
        method: "POST",
        target: "/smoke/session",
        headers: [`authorization: ${header}`],
      })
      expect(record(header.slice(0, 7), answer)).toContain("answered 404")
    }
  })

  it("refuses a stored redirect address that does not parse", async () => {
    await sessionDb?.query("insert into session.oauth_client (id, name, redirect_uris) values ($1, $2, $3)", [
      "old-row",
      null,
      ["not a url"],
    ])
    const request = { client_id: "old-row", redirect_uri: "not a url" }
    const described = await ask(base, "POST", "/oauth/client", request, cookie)
    expect(described.status).toBe(400)
    expect(described.json).toEqual({ ok: false, refusal: "redirect" })
    const approved = await ask(
      base,
      "POST",
      "/oauth/approve",
      { ...request, code_challenge: "a".repeat(43), code_challenge_method: "S256" },
      cookie,
    )
    expect(approved.status).toBe(400)
    expect(approved.json).toEqual({ ok: false, refusal: "redirect" })
  })

  for (const route of ["/oauth/token", "/oauth/revoke"]) {
    it(`never parses a form over the form cap on ${route}`, async () => {
      const parse = vi.spyOn(globalThis, "URLSearchParams")
      try {
        for (const size of [formCap + 1, 980_000]) {
          const answer = await send({
            method: "POST",
            target: route,
            headers: [`content-type: ${formType}`],
            body: Buffer.from("a&".repeat(size).slice(0, size)),
          })
          expect(answer.status).toBe(413)
          expect(answer.text.endsWith('{"ok":false,"refusal":"size"}')).toBe(true)
        }
        expect(parse).not.toHaveBeenCalled()
      } finally {
        parse.mockRestore()
      }
    })

    it(`parses a form exactly at the form cap on ${route}, once`, async () => {
      const parse = vi.spyOn(globalThis, "URLSearchParams")
      try {
        const answer = await send({
          method: "POST",
          target: route,
          headers: [`content-type: ${formType}`],
          body: Buffer.from("a&".repeat(formCap / 2)),
        })
        expect(answer.status).toBeLessThan(413)
        expect(parse).toHaveBeenCalledTimes(1)
      } finally {
        parse.mockRestore()
      }
    })
  }

  const unstorable = ["a\u0000b", "\ud800", "a\udc00b"]

  it("refuses a commit value or floor Postgres cannot store and writes nothing", async () => {
    let node = 1000
    for (const text of unstorable) {
      for (const edit of [{ value: text }, { value: "ok", floor: text }]) {
        node += 1
        const batch = [{ node: `258.${String(node)}`, ...edit }]
        const answer = await ask(base, "POST", "/decks/commit", { deck, batch }, cookie)
        expect(answer.status).toBe(200)
        expect(answer.json).toEqual({ ok: false, refusal: "field" })
      }
    }
  })

  it("refuses a deck name Postgres cannot store and keeps the old name", async () => {
    await ask(base, "POST", "/decks/rename", { deck, name: "kept" }, cookie)
    for (const name of unstorable) {
      const answer = await ask(base, "POST", "/decks/rename", { deck, name }, cookie)
      expect(answer.json).toEqual({ ok: false, refusal: "field" })
    }
    const listed = await ask(base, "POST", "/decks/list", {}, cookie)
    expect(listed.json).toMatchObject({ decks: [{ deck, name: "kept" }] })
  })

  it("answers every body over the cap with 413 size, whatever its framing", async () => {
    const wrong: string[] = []
    const framings = [
      { size: bodyCap + 1 },
      { size: bodyCap * 3 },
      { size: bodyCap + 1, chunked: true as const },
      { size: bodyCap * 3, chunked: true as const },
    ]
    for (const route of routes) {
      const good = goods[keyOf(route)]?.[0]
      if (good === undefined || (good.shape !== "json" && good.shape !== "form")) continue
      const type = `content-type: ${good.shape === "json" ? jsonType : formType}`
      for (const { size, ...framing } of framings) {
        const answer = await send({
          method: route.method === "any" ? "POST" : route.method,
          target: route.path,
          headers: [...signedHeaders(), type],
          body: Buffer.alloc(size, 0x78),
          ...framing,
        })
        if (answer.status !== 413 || !answer.text.endsWith('{"ok":false,"refusal":"size"}')) {
          wrong.push(record(`${keyOf(route)} ${String(size)} ${JSON.stringify(framing)}`, answer))
        }
      }
    }
    expect(wrong).toEqual([])
  }, 20_000)

  it("answers an MCP body over the cap with 413, whatever its framing", async () => {
    const over = Buffer.alloc(bodyCap * 3, 0x78)
    for (const chunked of [false, true]) {
      const answer = await send({
        method: "POST",
        target: "/mcp",
        headers: [...signedHeaders(), `content-type: ${jsonType}`, mcpAccept],
        body: over,
        ...(chunked ? { chunked: true as const } : {}),
      })
      expect(record(`chunked ${String(chunked)}`, answer)).toContain("answered 413")
    }
  })

  it("waits for the rest of a body over the cap, so the upload is not cut off", async () => {
    const received: Buffer[] = []
    const socket = connect(port, "127.0.0.1")
    const ended = new Promise<void>((resolve) => socket.on("close", () => resolve()))
    socket.on("data", (chunk) => received.push(chunk))
    socket.on("error", () => undefined)
    const size = bodyCap * 2
    socket.write(`POST /sign-in/email HTTP/1.1\r\nhost: 127.0.0.1\r\ncontent-length: ${String(size)}\r\n\r\n`)
    socket.write(Buffer.alloc(bodyCap + 1, 0x78))
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(received).toEqual([])
    socket.write(Buffer.alloc(size - bodyCap - 1, 0x78))
    await ended
    const text = Buffer.concat(received).toString("latin1")
    expect(text).toMatch(/^HTTP\/1\.1 413 /)
    expect(text.endsWith('{"ok":false,"refusal":"size"}')).toBe(true)
  })

  for (const route of ["/decks/open", "/oauth/client", "/mcp", "/no-such-route"]) {
    it(`reads the whole body before it refuses a signed-out request to ${route}`, async () => {
      const received: Buffer[] = []
      const socket = connect(port, "127.0.0.1")
      const ended = new Promise<void>((resolve) => socket.on("close", () => resolve()))
      socket.on("data", (chunk) => received.push(chunk))
      socket.on("error", () => undefined)
      socket.write(`POST ${route} HTTP/1.1\r\nhost: 127.0.0.1\r\nconnection: close\r\ncontent-length: 1000\r\n\r\n`)
      socket.write(Buffer.alloc(500, 0x78))
      await new Promise((resolve) => setTimeout(resolve, 150))
      expect(received).toEqual([])
      socket.write(Buffer.alloc(500, 0x78))
      await ended
      expect(Buffer.concat(received).toString("latin1")).toMatch(/^HTTP\/1\.1 40[14] /)
    })
  }

  it("lets the client read the 413 and make its next request", async () => {
    const over = await fetch(`${base}/sign-in/email`, {
      method: "POST",
      headers: { "content-type": jsonType },
      body: Buffer.alloc(bodyCap * 3, 0x78),
    })
    expect(over.status).toBe(413)
    expect(over.headers.get("connection")).toBe("close")
    expect(await over.json()).toEqual({ ok: false, refusal: "size" })
    const next = await fetch(`${base}/health`)
    expect(next.status).toBe(200)
  })

  it("accepts a body exactly at the cap", async () => {
    const padded = JSON.stringify({ email: `${"a".repeat(bodyCap)}@example.com` }).slice(0, bodyCap - 2)
    const answer = await send({
      method: "POST",
      target: "/sign-in/email",
      headers: [`content-type: ${jsonType}`],
      body: Buffer.from(`${padded}"}`),
    })
    expect(Buffer.from(`${padded}"}`).length).toBe(bodyCap)
    expect(answer.status).toBe(400)
  })

  function coded(message: string, code: string): Error {
    return Object.assign(new Error(message), { code })
  }

  const inputThrows: readonly [string, Error][] = [
    ["a bad escape", new URIError("URI malformed in /home/secret.ts")],
    ["a bad url", coded("Invalid URL: postgres://secret", "ERR_INVALID_URL")],
    ["bad text for a column", coded("invalid input syntax for type uuid", "22P02")],
    ["a byte Postgres refuses", coded("invalid byte sequence for encoding", "22021")],
    ["an escape jsonb refuses", coded("unsupported Unicode escape sequence", "22P05")],
  ]

  for (const [name, error] of inputThrows) {
    it(`answers a throw caused by input as 400 with a sentence: ${name}`, async () => {
      thrown = error
      const write = vi.spyOn(process.stderr, "write").mockReturnValue(true)
      try {
        const answer = await ask(brokenBase, "POST", "/sign-in/code", { email: "a@example.com", code: "123456" })
        expect(answer.status).toBe(400)
        expect(answer.json).toEqual({ ok: false, refusal: unreadSentence })
        expect(write).not.toHaveBeenCalled()
      } finally {
        write.mockRestore()
      }
    })
  }

  const internalThrows: readonly [string, Error, string][] = [
    [
      "the database is down",
      coded("connect ECONNREFUSED postgres://session:secret@db:5432", "ECONNREFUSED"),
      "Error ECONNREFUSED",
    ],
    ["a bad password", coded('password authentication failed for user "secret"', "28P01"), "Error 28P01"],
    ["a missing table", coded('relation "session.secret" does not exist', "42P01"), "Error 42P01"],
    ["a bug with no code", new TypeError("cannot read secret of undefined"), "TypeError none"],
  ]

  for (const [name, error, logged] of internalThrows) {
    it(`answers an internal failure with the fixed 500 and one clean log line: ${name}`, async () => {
      thrown = error
      const write = vi.spyOn(process.stderr, "write").mockReturnValue(true)
      try {
        const answer = await ask(brokenBase, "POST", "/sign-in/code", { email: "person@example.com", code: "123456" })
        expect(answer.status).toBe(500)
        expect(answer.json).toEqual({ ok: false, refusal: "server" })
        expect(write.mock.calls.map((call) => String(call[0]))).toEqual([`api POST /sign-in/code failed: ${logged}\n`])
      } finally {
        write.mockRestore()
      }
    })
  }
})
