import { readFileSync } from "node:fs"
import { createServer, type Server } from "node:http"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import worker, { signInPagePaths } from "./sign-in-forward.js"
import { signInRoutes, signOutRoutes } from "@airdesign/catalog"

type Seen = {
  method: string | undefined
  url: string | undefined
  cookie: string | undefined
  contentType: string | undefined
  body: string
}

const assets = { fetch: () => Promise.resolve(new Response("sign-in page")) }

let server: Server
let origin: string
let seen: Seen[]

beforeEach(async () => {
  seen = []
  server = createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on("data", (chunk: Buffer) => chunks.push(chunk))
    request.on("end", () => {
      seen.push({
        method: request.method,
        url: request.url,
        cookie: request.headers.cookie,
        contentType: request.headers["content-type"],
        body: Buffer.concat(chunks).toString(),
      })
      if (request.url?.startsWith("/sign-in/link")) {
        response.writeHead(302, { location: "/decks", "set-cookie": "airdesign.session=abc; Path=/" })
        response.end()
        return
      }
      response.writeHead(201, { "set-cookie": "airdesign.session=abc; Path=/" })
      response.end("saved")
    })
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (address === null || typeof address === "string") throw new Error("No server address")
  origin = `http://127.0.0.1:${address.port}`
})

afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
})

describe("sign-in forwarding", () => {
  it("forwards every catalog sign-in and sign-out path", async () => {
    for (const route of [...Object.values(signInRoutes), ...Object.values(signOutRoutes)]) {
      await worker.fetch(new Request(`https://airdesign.app${route.path}`, { method: route.method }), {
        API_ORIGIN: origin,
        ASSETS: assets,
      })
      expect(seen.at(-1)?.url).toBe(route.path)
      expect(seen.at(-1)?.method).toBe(route.method)
    }
  })
  it.each(["/sign-in/email", "/sign-in/code"])("forwards POST %s and returns the API response", async (path) => {
    const body = '{"email":"é@example.com"}'
    const response = await worker.fetch(
      new Request(`https://airdesign.app${path}`, {
        method: "POST",
        headers: { cookie: "airdesign.session=old", "content-type": "application/json" },
        body,
      }),
      { API_ORIGIN: origin, ASSETS: assets },
    )
    expect(seen).toEqual([
      { method: "POST", url: path, cookie: "airdesign.session=old", contentType: "application/json", body },
    ])
    expect(response.status).toBe(201)
    expect(await response.text()).toBe("saved")
    expect(response.headers.get("set-cookie")).toBe("airdesign.session=abc; Path=/")
  })

  it("returns the link redirect and cookie without following it", async () => {
    const response = await worker.fetch(new Request("https://airdesign.app/sign-in/link?token=t1"), {
      API_ORIGIN: origin,
      ASSETS: assets,
    })
    expect(seen).toHaveLength(1)
    expect(seen[0]?.method).toBe("GET")
    expect(seen[0]?.url).toBe("/sign-in/link?token=t1")
    expect(response.status).toBe(302)
    expect(response.headers.get("location")).toBe("/decks")
    expect(response.headers.get("set-cookie")).toBe("airdesign.session=abc; Path=/")
  })

  it.each(["/sign-in/check", "/sign-in/expired", "/sign-in/email/x", "/decks/open"])(
    "does not forward %s and answers 404",
    async (path) => {
      const response = await worker.fetch(new Request(`https://airdesign.app${path}`), {
        API_ORIGIN: origin,
        ASSETS: assets,
      })
      expect(response.status).toBe(404)
      expect(await response.text()).toBe("Not found")
      expect(seen).toEqual([])
    },
  )

  it.each([undefined, ""])("answers 503 for the forwarded paths when the API origin is %j", async (apiOrigin) => {
    for (const path of ["/sign-in/email", "/sign-in/code", "/sign-in/link", "/sign-out"]) {
      const response = await worker.fetch(new Request(`https://airdesign.app${path}`, { method: "POST" }), {
        API_ORIGIN: apiOrigin,
        ASSETS: assets,
      })
      expect(response.status).toBe(503)
    }
    expect(seen).toEqual([])
  })

  it("answers the site's own commit at /version and does not ask the API", async () => {
    const outbound = vi.spyOn(globalThis, "fetch")
    const commit = "a".repeat(40)
    const response = await worker.fetch(new Request("https://airdesign.app/version"), {
      API_ORIGIN: origin,
      COMMIT: commit,
      ASSETS: assets,
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ commit })
    expect(outbound).not.toHaveBeenCalled()
    expect(seen).toEqual([])
    outbound.mockRestore()
  })

  it("sends /version and the sign-in page to the Worker before site assets, with the app origin the site is built with", () => {
    const text = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8")
    const config = JSON.parse(text.replace(/,(\s*[}\]])/g, "$1")) as {
      assets: { binding?: string; run_worker_first?: string[] }
      vars?: { APP_ORIGIN?: string }
    }
    expect(config.assets.run_worker_first).toEqual(["/version", ...signInPagePaths])
    expect(config.assets.binding).toBe("ASSETS")
    const built = readFileSync(new URL("../.env.production", import.meta.url), "utf8")
    expect(`PUBLIC_APP_ORIGIN=${config.vars?.APP_ORIGIN ?? ""}\n`).toBe(built)
  })

  it.each(["/pricing", "/agents", "/status", "/assets", "/assets/logo.png", "/agent-instructions.txt"])(
    "answers the site's 404 for the retired path %s and fetches nothing",
    async (path) => {
      const outbound = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("old", { status: 308 }))
      const response = await worker.fetch(new Request(`https://airdesign.app${path}`), {
        API_ORIGIN: origin,
        ASSETS: assets,
      })
      expect(response.status).toBe(404)
      expect(await response.text()).toBe("Not found")
      expect(outbound).not.toHaveBeenCalled()
      expect(seen).toEqual([])
      outbound.mockRestore()
    },
  )
})

describe("sign-in page", () => {
  const app = "https://studio.airdesign.app"
  const account = `airdesign.account=${"a".repeat(32)}`

  function page(path: string, cookie?: string): Request {
    return new Request(`https://airdesign.app${path}`, cookie === undefined ? {} : { headers: { cookie } })
  }

  it.each(["/sign-in", "/sign-in/"])(
    "sends a browser that holds an account key from %s to the app's next path before any page is sent",
    async (path) => {
      const served = vi.fn(assets.fetch)
      const response = await worker.fetch(page(`${path}?next=%2Fs%2Fabc`, `theme=dark; ${account}`), {
        APP_ORIGIN: app,
        ASSETS: { fetch: served },
      })
      expect(response.status).toBe(302)
      expect(response.headers.get("location")).toBe(`${app}/s/abc`)
      expect(response.headers.get("cache-control")).toBe("private, no-store")
      expect(served).not.toHaveBeenCalled()
    },
  )

  it("keeps a hostile next path on the app host", async () => {
    const response = await worker.fetch(page("/sign-in?next=//evil.example", account), {
      APP_ORIGIN: app,
      ASSETS: assets,
    })
    expect(response.headers.get("location")).toBe(`${app}/`)
  })

  it.each([undefined, "airdesign.account=", "airdesign.account=not-a-key"])(
    "serves the sign-in page for the cookie %j",
    async (cookie) => {
      const response = await worker.fetch(page("/sign-in/?next=%2Fs%2Fabc", cookie), {
        APP_ORIGIN: app,
        ASSETS: assets,
      })
      expect(response.status).toBe(200)
      expect(await response.text()).toBe("sign-in page")
    },
  )

  it("serves the sign-in page when the app origin is missing, so the page never sends itself to itself", async () => {
    const response = await worker.fetch(page("/sign-in", account), { ASSETS: assets })
    expect(await response.text()).toBe("sign-in page")
  })
})
