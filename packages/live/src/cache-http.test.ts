import { openRegister } from "@airdesign/document"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { installIndexedDb, node } from "./browser-fixtures.js"
import { connect, deleteDatabase, httpRemote } from "./index.js"

beforeEach(installIndexedDb)
afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

it("decodes an HTTP size refusal and keeps pending rows", async () => {
  for (const [status, refusal] of [[413, "size"]] as const) {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ ok: false, refusal }), { status }))
    const cache = connect(httpRemote())
    await cache.enqueue("http-refusal", "pending", node, "")
    const before = await cache.pending("http-refusal")
    expect(await cache.flush("http-refusal")).toEqual({ ok: false, refusal })
    expect(await cache.watch("http-refusal", null)).toEqual({ ok: false, refusal })
    expect(await httpRemote().commit({ deck: "http-refusal", batch: [{ node, value: "pending" }] })).toEqual({
      ok: false,
      refusal,
    })
    expect(await cache.pending("http-refusal")).toEqual(before)
  }
})

it("decodes the API's unreadable request sentence as payload and keeps pending rows", async () => {
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(
        JSON.stringify({
          ok: false,
          refusal: "The request could not be read.",
        }),
        { status: 400 },
      ),
  )
  const cache = connect(httpRemote())
  await cache.enqueue("request-sentence", "pending", node, "")
  const before = await cache.pending("request-sentence")
  expect(await cache.flush("request-sentence")).toEqual({ ok: false, refusal: "payload" })
  expect(await cache.pending("request-sentence")).toEqual(before)
})

it("refuses malformed HTTP open answers and keeps every pending row", async () => {
  const revision = { ok: true, deck: "malformed-open", revision: 0 }
  for (const answer of [
    null,
    [],
    {},
    { ok: false, refusal: "unknown" },
    { ...revision },
    { ...revision, register: {} },
    { ...revision, revision: -1, register: openRegister("", "") },
    { ...revision, register: { ...openRegister("", ""), landed: [{ actor: "owner", value: "", visible: true }] } },
  ]) {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify(answer)))
    const cache = connect(httpRemote())
    await cache.enqueue("malformed-open", "pending", node, "")
    const before = await cache.pending("malformed-open")
    expect(await cache.flush("malformed-open")).toEqual({ ok: false, refusal: "payload" })
    expect(await cache.pending("malformed-open")).toEqual(before)
  }
})

it("refuses malformed HTTP commit answers and keeps every pending row", async () => {
  const revision = { ok: true, deck: "malformed-commit", revision: 1, key: "malformed-commit:1" }
  for (const answer of [
    null,
    [],
    {},
    { ok: false, refusal: "unknown" },
    { ...revision, ok: "true" },
    { ...revision, deck: "bad deck" },
    { ...revision, revision: 0.5 },
    { ...revision, key: null },
    { ...revision, key: "malformed-commit:9" },
  ]) {
    vi.stubGlobal(
      "fetch",
      async (url: string) =>
        new Response(
          JSON.stringify(
            url === "/decks/open"
              ? { ok: true, deck: "malformed-commit", revision: 0, register: openRegister("", "") }
              : answer,
          ),
        ),
    )
    const cache = connect(httpRemote())
    await cache.enqueue("malformed-commit", "pending", node, "")
    const before = await cache.pending("malformed-commit")
    expect(await cache.flush("malformed-commit")).toEqual({ ok: false, refusal: "payload" })
    expect(await cache.pending("malformed-commit")).toMatchObject(before)
  }
})

it("refuses malformed HTTP watch answers and keeps every pending row", async () => {
  for (const answer of [
    null,
    [],
    {},
    { ok: false, refusal: "unknown" },
    { ok: true, deck: "malformed-watch" },
    { ok: true, deck: "malformed-watch", revision: -1 },
    { ok: true, deck: "bad deck", revision: 0 },
  ]) {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify(answer)))
    const cache = connect(httpRemote())
    await cache.enqueue("malformed-watch", "pending", node, "")
    const before = await cache.pending("malformed-watch")
    expect(await cache.watch("malformed-watch", null)).toEqual({ ok: false, refusal: "payload" })
    expect(await cache.pending("malformed-watch")).toEqual(before)
  }
})

it.each([
  { status: 200, body: "not JSON" },
  { status: 500, body: JSON.stringify({ ok: false, refusal: "server" }) },
])("reads a $status answer it cannot use as no answer and keeps the pending rows", async ({ status, body }) => {
  vi.stubGlobal("fetch", async () => new Response(body, { status }))
  const remote = httpRemote()
  const cache = connect(remote)
  await cache.enqueue("unreadable", "pending", node, "")
  const before = await cache.pending("unreadable")
  await expect(cache.flush("unreadable")).rejects.toBeInstanceOf(TypeError)
  await expect(remote.commit({ deck: "unreadable", batch: [{ node, value: "pending" }] })).rejects.toBeInstanceOf(
    TypeError,
  )
  await expect(cache.watch("unreadable", null)).rejects.toBeInstanceOf(TypeError)
  expect(await cache.pending("unreadable")).toEqual(before)
})
