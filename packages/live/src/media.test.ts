import { deckRoutes } from "@airdesign/catalog"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { installIndexedDb, installParts } from "./browser-fixtures.js"
import { deleteDatabase, flushMedia, flushOriginal, keepMedia, readMedia } from "./index.js"

const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])

async function hashOf(data: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(data)))
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

type Call = { readonly path: string; readonly body: unknown }

function server(answer: (call: Call) => Response) {
  const calls: Call[] = []
  vi.stubGlobal("fetch", async (path: string, init?: RequestInit) => {
    const call = { path, body: init?.method === "PUT" ? init.body : JSON.parse(String(init?.body ?? "null")) }
    calls.push(call)
    return answer(call)
  })
  return calls
}

const signed = { ok: true, url: "https://bucket.test/put", expires: "2026-11-12T00:00:00Z", headers: {} }

beforeEach(() => {
  installIndexedDb()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

it("keeps a picture's bytes on the device first and uploads them on the next flush, retrying after a failure", async () => {
  installParts()
  const sha256 = await hashOf(bytes)
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")))
  expect(await keepMedia("deck-one", bytes)).toBe(sha256)
  expect(await flushMedia("deck-one")).toEqual({ ok: false })
  expect((await readMedia("deck-one", [sha256])).get(sha256)).toEqual(bytes)
  const calls = server((call) =>
    call.path === deckRoutes.mediaUpload.path ? Response.json(signed) : new Response(null, { status: 200 }),
  )
  expect(await flushMedia("deck-one")).toEqual({ ok: true })
  expect(calls.map((call) => call.path)).toEqual([deckRoutes.mediaUpload.path, "https://bucket.test/put"])
  expect(calls[0]?.body).toEqual({ deck: "deck-one", bytes: bytes.length, sha256 })
  expect(await flushMedia("deck-one")).toEqual({ ok: true })
  expect(calls).toHaveLength(2)
})

it("counts an upload the bucket already holds as sent", async () => {
  installParts()
  await keepMedia("deck-two", bytes)
  server((call) =>
    call.path === deckRoutes.mediaUpload.path ? Response.json(signed) : new Response(null, { status: 412 }),
  )
  expect(await flushMedia("deck-two")).toEqual({ ok: true })
})

it("fetches bytes another device uploaded, checks their hash, and keeps them for the next read", async () => {
  installParts()
  const sha256 = await hashOf(bytes)
  const calls = server((call) =>
    call.path === deckRoutes.media.path
      ? Response.json({ ok: true, url: "https://bucket.test/get", expires: "x", bytes: bytes.length, sha256 })
      : new Response(bytes),
  )
  expect((await readMedia("deck-three", [sha256])).get(sha256)).toEqual(bytes)
  expect((await readMedia("deck-three", [sha256])).get(sha256)).toEqual(bytes)
  expect(calls.filter((call) => call.path === deckRoutes.media.path)).toHaveLength(1)
})

it("leaves out bytes that have not landed or do not match their hash", async () => {
  installParts()
  const sha256 = await hashOf(bytes)
  server((call) =>
    call.path === deckRoutes.media.path
      ? Response.json({ ok: false, refusal: "missing" })
      : new Response(new Uint8Array([9])),
  )
  expect((await readMedia("deck-four", [sha256])).has(sha256)).toBe(false)
  server((call) =>
    call.path === deckRoutes.media.path
      ? Response.json({ ok: true, url: "https://bucket.test/get", expires: "x", bytes: 1, sha256 })
      : new Response(new Uint8Array([9])),
  )
  expect((await readMedia("deck-four", [sha256])).has(sha256)).toBe(false)
})

it("retries a picture's upload when the editor flushes the original on open or back online", async () => {
  installParts()
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")))
  await keepMedia("deck-five", bytes)
  const calls = server((call) =>
    call.path === deckRoutes.mediaUpload.path ? Response.json(signed) : new Response(null, { status: 200 }),
  )
  expect(await flushOriginal("deck-five")).toEqual({ ok: true })
  expect(calls.map((call) => call.path)).toEqual([deckRoutes.mediaUpload.path, "https://bucket.test/put"])
})

it("keeps a picture queued while an earlier picture uploads", async () => {
  installParts()
  const first = await keepMedia("during-upload", bytes)
  let enter = () => {}
  let release = () => {}
  const entered = new Promise<void>((resolve) => {
    enter = resolve
  })
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  const uploaded: string[] = []
  vi.stubGlobal("fetch", async (path: string, init?: RequestInit) => {
    if (path === deckRoutes.mediaUpload.path) {
      const body = JSON.parse(String(init?.body))
      uploaded.push(body.sha256)
      return Response.json(signed)
    }
    enter()
    await held
    return new Response(null, { status: 200 })
  })
  const flushing = flushMedia("during-upload")
  await entered
  const second = await keepMedia("during-upload", new Uint8Array([9, 8, 7]))
  release()
  expect(await flushing).toEqual({ ok: true })
  expect(await flushMedia("during-upload")).toEqual({ ok: true })
  expect(uploaded).toEqual([first, second])
})

it("keeps every picture queued by concurrent adds", async () => {
  installParts()
  const added = await Promise.all([
    keepMedia("concurrent-adds", bytes),
    keepMedia("concurrent-adds", new Uint8Array([9, 8, 7])),
  ])
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")))
  expect([...(await readMedia("concurrent-adds", added)).keys()]).toEqual(added)
  const calls = server((call) =>
    call.path === deckRoutes.mediaUpload.path ? Response.json(signed) : new Response(null, { status: 200 }),
  )
  expect(await flushMedia("concurrent-adds")).toEqual({ ok: true })
  const uploads = calls.filter((call) => call.path === deckRoutes.mediaUpload.path)
  expect(uploads.map((call) => call.body)).toEqual(
    expect.arrayContaining(added.map((sha256) => expect.objectContaining({ sha256 }))),
  )
})
