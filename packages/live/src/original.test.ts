import { deckRoutes } from "@airdesign/catalog"
import { afterEach, expect, it, vi } from "vitest"
import { fetchOriginal, sendOriginal } from "./original.js"
import { hex } from "./part.js"

const deck = "deck-one"
const file = new Uint8Array([80, 75, 3, 4, 9, 8, 7])
const sha256 = hex(await crypto.subtle.digest("SHA-256", file))
const expires = "2026-11-11T12:00:00.000Z"

type Call = { readonly url: string; readonly method: string; readonly headers: unknown; readonly body: unknown }

function served(answers: Readonly<Record<string, () => Response>>): Call[] {
  const calls: Call[] = []
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    calls.push({
      url,
      method: init.method ?? "GET",
      headers: init.headers,
      body: typeof init.body === "string" ? JSON.parse(init.body) : init.body,
    })
    const answer = answers[url]
    if (answer === undefined) throw new TypeError("offline")
    return answer()
  })
  return calls
}

const json = (body: unknown) => () => new Response(JSON.stringify(body))

afterEach(() => {
  vi.unstubAllGlobals()
})

it("sends the original through a signed upload and marks it done", async () => {
  const calls = served({
    [deckRoutes.originalUpload.path]: json({
      ok: true,
      url: "https://store.test/put",
      expires,
      headers: { "content-length": String(file.byteLength), "if-none-match": "*" },
    }),
    "https://store.test/put": () => new Response(null, { status: 200 }),
    [deckRoutes.originalDone.path]: json({ ok: true }),
  })
  expect(await sendOriginal(deck, file)).toEqual({ ok: true })
  expect(calls.map((call) => [call.method, call.url])).toEqual([
    ["POST", deckRoutes.originalUpload.path],
    ["PUT", "https://store.test/put"],
    ["POST", deckRoutes.originalDone.path],
  ])
  expect(calls[0]?.body).toEqual({ deck, bytes: file.byteLength, sha256 })
  expect(calls[1]?.headers).toEqual({ "if-none-match": "*" })
  expect([...(calls[1]?.body as Uint8Array)]).toEqual([...file])
})

it("does not mark the original done when the store refuses the upload", async () => {
  const calls = served({
    [deckRoutes.originalUpload.path]: json({ ok: true, url: "https://store.test/put", expires, headers: {} }),
    "https://store.test/put": () => new Response(null, { status: 412 }),
  })
  expect(await sendOriginal(deck, file)).toEqual({ ok: false })
  expect(calls.map((call) => call.url)).not.toContain(deckRoutes.originalDone.path)
})

it("reports an unsent original when the network is gone", async () => {
  served({})
  expect(await sendOriginal(deck, file)).toEqual({ ok: false })
})

it("fetches the stored original whose size and hash match", async () => {
  served({
    [deckRoutes.original.path]: json({
      ok: true,
      url: "https://store.test/get",
      expires,
      bytes: file.byteLength,
      sha256,
    }),
    "https://store.test/get": () => new Response(file.slice()),
  })
  const fetched = await fetchOriginal(deck)
  expect(fetched.ok && [...fetched.file]).toEqual([...file])
})

it("refuses a fetched original whose bytes differ from what the server recorded", async () => {
  served({
    [deckRoutes.original.path]: json({
      ok: true,
      url: "https://store.test/get",
      expires,
      bytes: file.byteLength,
      sha256,
    }),
    "https://store.test/get": () => new Response(new Uint8Array([80, 75, 3, 4, 9, 8, 6])),
  })
  expect(await fetchOriginal(deck)).toEqual({ ok: false, refusal: "storage" })
})

it("passes on the server's refusal when no original was stored", async () => {
  served({ [deckRoutes.original.path]: json({ ok: false, refusal: "missing" }) })
  expect(await fetchOriginal(deck)).toEqual({ ok: false, refusal: "missing" })
})
