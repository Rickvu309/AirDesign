import { createServer, type Server } from "node:http"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import worker from "./api-forward.js"

type Seen = {
  method: string | undefined
  url: string | undefined
  cookie: string | undefined
  contentType: string | undefined
  body: string
}

let server: Server
let origin: string
let seen: Seen[]
let assets: Request[]

beforeEach(async () => {
  seen = []
  assets = []
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
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
})

function env() {
  return {
    API_ORIGIN: origin,
    ASSETS: {
      fetch: async (request: Request) => {
        assets.push(request)
        return new Response("asset")
      },
    },
  }
}

describe("API forwarding", () => {
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
      { method: "POST", url: "/decks/commit", cookie: "airdesign.session=abc", contentType: "application/json", body },
    ])
    expect(response.status).toBe(201)
    expect(await response.text()).toBe("saved")
    expect(assets).toEqual([])
  })

  it("returns the link redirect and cookie without following it", async () => {
    const response = await worker.fetch(new Request("https://example.com/sign-in/link?token=t1"), env())
    expect(seen).toHaveLength(1)
    expect(seen[0]?.url).toBe("/sign-in/link?token=t1")
    expect(response.status).toBe(302)
    expect(response.headers.get("location")).toBe("/")
    expect(response.headers.get("set-cookie")).toBe("airdesign.session=abc; Path=/")
  })

  it.each(["/thin", "/sign-in/check", "/sign-in", "/decks", "/decks/open/x", "/screens/example"])(
    "serves %s from assets",
    async (path) => {
      const request = new Request(`https://example.com${path}`)
      const response = await worker.fetch(request, env())
      expect(await response.text()).toBe("asset")
      expect(assets).toEqual([request])
      expect(seen).toEqual([])
    },
  )

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
    "/decks/open",
    "/decks/watch",
    "/decks/list",
    "/decks/rename",
    "/decks/trash",
    "/decks/restore",
    "/decks/delete",
    "/oauth/client",
    "/oauth/approve",
  ])("forwards %s", async (path) => {
    await worker.fetch(new Request(`https://example.com${path}`, { method: "POST" }), env())
    expect(seen[0]?.url).toBe(path)
    expect(assets).toEqual([])
  })
})
