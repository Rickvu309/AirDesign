import { readFileSync } from "node:fs"
import { createServer, type Server } from "node:http"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import worker from "./api-forward.js"
import {
  accountPaths,
  accountRoutes,
  airaPaths,
  countryHeader,
  deckPaths,
  scenePaths,
  deckRoutes,
  forwardSecretHeader,
  mcpPaths,
  oauthPaths,
  oauthRoutes,
  signInPaths,
  signInRoutes,
  signOutPaths,
  signOutRoutes,
} from "@airdesign/catalog"

type Seen = {
  method: string | undefined
  url: string | undefined
  cookie: string | undefined
  contentType: string | undefined
  country: string | string[] | undefined
  forwardSecret: string | string[] | undefined
  body: string
}

let server: Server
let origin: string
let seen: Seen[]
let assets: Request[]
let finish: () => void
let turnClosed = "open"

beforeEach(async () => {
  seen = []
  assets = []
  finish = () => undefined
  turnClosed = "open"
  server = createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on("data", (chunk: Buffer) => chunks.push(chunk))
    request.on("end", () => {
      seen.push({
        method: request.method,
        url: request.url,
        cookie: request.headers.cookie,
        contentType: request.headers["content-type"],
        country: request.headers[countryHeader],
        forwardSecret: request.headers[forwardSecretHeader],
        body: Buffer.concat(chunks).toString(),
      })
      if (request.url === "/aira/turn") {
        response.writeHead(200, { "content-type": "application/x-ndjson; charset=utf-8" })
        response.write('{"type":"text","text":"Lead"}\n')
        response.on("close", () => {
          turnClosed = response.writableFinished ? "ended" : "closed"
        })
        finish = () => {
          finish = () => undefined
          response.end('{"type":"end","ok":true}\n')
        }
        return
      }
      if (request.url?.startsWith("/sign-in/link")) {
        response.writeHead(302, { location: "/", "set-cookie": "airdesign.session=abc; Path=/" })
        response.end()
        return
      }
      response.writeHead(201)
      response.end("saved")
    })
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (address === null || typeof address === "string") throw new Error("No server address")
  origin = `http://127.0.0.1:${address.port}`
})

afterEach(async () => {
  finish()
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
})

function env(extra: { FORWARD_SECRET?: string; COMMIT?: string } = {}) {
  return {
    API_ORIGIN: origin,
    ...extra,
    ASSETS: {
      fetch: async (request: Request) => {
        assets.push(request)
        return new Response("asset")
      },
    },
  }
}

describe("API forwarding", () => {
  it("forwards every catalog deck and sign-in path instead of serving assets", async () => {
    for (const route of [
      ...Object.values(deckRoutes),
      ...Object.values(signInRoutes),
      ...Object.values(signOutRoutes),
      ...Object.values(accountRoutes),
    ]) {
      const method = "method" in route ? route.method : "POST"
      const response = await worker.fetch(new Request(`https://example.com${route.path}`, { method }), env())
      expect(seen.at(-1)?.url).toBe(route.path)
      expect(response.status).toBe(route.path === signInRoutes.link.path ? 302 : 201)
    }
    expect(assets).toEqual([])
  })
  it("forwards every catalog oauth path instead of serving assets", async () => {
    for (const route of Object.values(oauthRoutes)) {
      const response = await worker.fetch(
        new Request(`https://example.com${route.path}`, { method: route.method }),
        env(),
      )
      expect(seen.at(-1)?.url).toBe(route.path)
      expect(response.status).toBe(201)
    }
    expect(assets).toEqual([])
  })

  it("routes every catalog path to the Worker before assets", () => {
    const text = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8")
    const config = JSON.parse(text.replace(/,(\s*[}\]])/g, "$1")) as { assets: { run_worker_first: string[] } }
    const entries = config.assets.run_worker_first
    const matches = (entry: string, path: string) =>
      entry.endsWith("/*") ? path.startsWith(entry.slice(0, -1)) : path === entry
    const routed = (path: string) =>
      entries.some((entry) => !entry.startsWith("!") && matches(entry, path)) &&
      !entries.some((entry) => entry.startsWith("!") && matches(entry.slice(1), path))
    expect(
      [
        ...signInPaths,
        ...signOutPaths,
        ...accountPaths,
        ...deckPaths,
        ...scenePaths,
        ...oauthPaths,
        ...mcpPaths,
        ...airaPaths,
      ].filter((path) => !routed(path)),
    ).toEqual([])
    expect(routed("/version")).toBe(true)
  })

  it("answers its own commit at /version and does not ask the API or the assets", async () => {
    const commit = "b".repeat(40)
    const stamped = await worker.fetch(new Request("https://studio.airdesign.app/version"), env({ COMMIT: commit }))
    expect(stamped.status).toBe(200)
    expect(await stamped.json()).toEqual({ commit })
    const missing = await worker.fetch(new Request("https://studio.airdesign.app/version"), env())
    expect(await missing.json()).toEqual({ commit: "unknown" })
    expect(seen).toEqual([])
    expect(assets).toEqual([])
  })

  it("forwards the commit request and returns the API response", async () => {
    const body = '{"edits":["é"]}'
    const response = await worker.fetch(
      new Request("https://example.com/decks/commit", {
        method: "POST",
        headers: { cookie: "airdesign.session=abc", "content-type": "application/json" },
        body,
      }),
      env(),
    )
    expect(seen).toEqual([
      {
        method: "POST",
        url: "/decks/commit",
        cookie: "airdesign.session=abc",
        contentType: "application/json",
        country: undefined,
        body,
      },
    ])
    expect(response.status).toBe(201)
    expect(await response.text()).toBe("saved")
    expect(assets).toEqual([])
  })

  it("passes each line of an Aira turn through as the API writes it, before the turn ends", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/aira/turn", { method: "POST", headers: { cookie: "airdesign.session=abc" } }),
      env(),
    )
    expect(response.headers.get("content-type")).toBe("application/x-ndjson; charset=utf-8")
    const reader = response.body?.getReader()
    if (reader === undefined) throw new Error("body")
    const decoder = new TextDecoder()
    expect(decoder.decode((await reader.read()).value)).toBe('{"type":"text","text":"Lead"}\n')
    finish()
    expect(decoder.decode((await reader.read()).value)).toBe('{"type":"end","ok":true}\n')
    expect((await reader.read()).done).toBe(true)
    expect(assets).toEqual([])
  })

  it("passes the visitor's country from Cloudflare to the API", async () => {
    const request = new Request("https://example.com/decks/open", { method: "POST" })
    await worker.fetch(Object.assign(request, { cf: { country: "VN" } }), env())
    expect(seen[0]?.country).toBe("VN")
  })

  it("replaces a country the visitor sent with the one Cloudflare saw", async () => {
    const request = new Request("https://example.com/decks/open", {
      method: "POST",
      headers: { [countryHeader]: "US" },
    })
    await worker.fetch(Object.assign(request, { cf: { country: "VN" } }), env())
    expect(seen[0]?.country).toBe("VN")
  })

  it("forwards no country when Cloudflare gave none, even one the visitor sent", async () => {
    const request = new Request("https://example.com/decks/open", {
      method: "POST",
      headers: { [countryHeader]: "US" },
    })
    await worker.fetch(request, env())
    expect(seen[0]?.country).toBeUndefined()
  })

  it("forwards the shared secret to the API when set in the worker environment", async () => {
    const request = new Request("https://example.com/decks/open", { method: "POST" })
    await worker.fetch(request, env({ FORWARD_SECRET: "worker-secret" }))
    expect(seen[0]?.forwardSecret).toBe("worker-secret")
  })

  it("strips any forward secret header sent by the visitor", async () => {
    const request = new Request("https://example.com/decks/open", {
      method: "POST",
      headers: { [forwardSecretHeader]: "visitor-secret" },
    })
    await worker.fetch(request, env({ FORWARD_SECRET: "worker-secret" }))
    expect(seen[0]?.forwardSecret).toBe("worker-secret")
  })

  it("forwards no secret header when unset in worker environment, even if visitor sent one", async () => {
    const request = new Request("https://example.com/decks/open", {
      method: "POST",
      headers: { [forwardSecretHeader]: "visitor-secret" },
    })
    await worker.fetch(request, env())
    expect(seen[0]?.forwardSecret).toBeUndefined()
  })

  it("declares the forward secret in wrangler.jsonc for type generation without committing a value", () => {
    const text = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8")
    const config = JSON.parse(text.replace(/,(\s*[}\]])/g, "$1")) as { secrets?: { required?: string[] } }
    expect(config.secrets?.required).toContain("FORWARD_SECRET")
  })

  it("closes the API's Aira turn when the person's request is cancelled, so the API stops the model call", async () => {
    const leaving = new AbortController()
    const response = await worker.fetch(
      new Request("https://example.com/aira/turn", {
        method: "POST",
        headers: { cookie: "airdesign.session=abc" },
        signal: leaving.signal,
      }),
      env(),
    )
    const reader = response.body?.getReader()
    if (reader === undefined) throw new Error("body")
    expect(new TextDecoder().decode((await reader.read()).value)).toBe('{"type":"text","text":"Lead"}\n')
    leaving.abort()
    await vi.waitFor(() => {
      expect(turnClosed).toBe("closed")
    })
  })

  it("asks Cloudflare to signal a cancelled request to the Worker", () => {
    const text = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8")
    const config = JSON.parse(text.replace(/,(\s*[}\]])/g, "$1")) as { compatibility_flags?: string[] }
    expect(config.compatibility_flags).toContain("enable_request_signal")
  })

  it("returns the link redirect and cookie without following it", async () => {
    const response = await worker.fetch(new Request("https://example.com/sign-in/link?token=t1"), env())
    expect(seen).toHaveLength(1)
    expect(seen[0]?.url).toBe("/sign-in/link?token=t1")
    expect(response.status).toBe(302)
    expect(response.headers.get("location")).toBe("/")
    expect(response.headers.get("set-cookie")).toBe("airdesign.session=abc; Path=/")
  })

  it.each([
    "/deck/abc",
    "/settings/agents",
    "/sign-in/check",
    "/sign-in",
    "/decks",
    "/decks/open/x",
    "/screens/example",
  ])("serves %s from assets", async (path) => {
    const request = new Request(`https://example.com${path}`)
    const response = await worker.fetch(request, env())
    expect(await response.text()).toBe("asset")
    expect(assets).toEqual([request])
    expect(seen).toEqual([])
  })

  it.each([undefined, ""])("returns 503 when the API origin is absent or empty", async (apiOrigin) => {
    const response = await worker.fetch(new Request("https://example.com/decks/open", { method: "POST" }), {
      ...env(),
      API_ORIGIN: apiOrigin,
    })
    expect(response.status).toBe(503)
    expect(seen).toEqual([])
    expect(assets).toEqual([])
  })

  it.each([
    "/sign-in/email",
    "/sign-in/code",
    "/sign-out",
    "/account/delete",
    "/account/agents",
    "/account/agents/revoke",
    "/decks/open",
    "/decks/watch",
    "/decks/list",
    "/decks/rename",
    "/decks/star",
    "/decks/trash",
    "/decks/restore",
    "/decks/delete",
    "/oauth/client",
    "/oauth/approve",
    "/oauth/register",
    "/oauth/token",
    "/oauth/revoke",
    "/decks/undo",
    "/mcp",
    "/aira/turn",
    "/aira/usage",
    "/.well-known/oauth-protected-resource",
    "/.well-known/oauth-authorization-server",
  ])("forwards %s", async (path) => {
    await worker.fetch(new Request(`https://example.com${path}`, { method: "POST" }), env())
    expect(seen[0]?.url).toBe(path)
    expect(assets).toEqual([])
  })
})
