import { expect, it } from "vitest"

import { LocalOriginalStore } from "./local-original-store.js"

const bytes = new Uint8Array([1, 2, 3])

function clocked(): { store: LocalOriginalStore; move: (ms: number) => void } {
  let at = 0
  return { store: new LocalOriginalStore(() => at), move: (ms) => (at += ms) }
}

it("refuses an upload url after 15 minutes", async () => {
  const { store, move } = clocked()
  const signed = await store.upload("k", 3)
  move(15 * 60 * 1000)
  expect(() => store.put(signed.url, bytes, signed.headers)).toThrow("expired")
  expect(await store.size("k")).toBeUndefined()
})

it("refuses a download url after 15 minutes", async () => {
  const { store, move } = clocked()
  const signed = await store.upload("k", 3)
  store.put(signed.url, bytes, signed.headers)
  const read = await store.download("k")
  move(15 * 60 * 1000 - 1)
  expect(store.get(read.url)).toEqual(bytes)
  move(1)
  expect(() => store.get(read.url)).toThrow("expired")
})

it("refuses bytes of another size than the url promised", async () => {
  const { store } = clocked()
  const signed = await store.upload("k", 4)
  expect(() => store.put(signed.url, bytes, { ...signed.headers })).toThrow("size")
  expect(await store.size("k")).toBeUndefined()
})

it("refuses an upload that leaves out a required header", async () => {
  const { store } = clocked()
  const signed = await store.upload("k", 3)
  expect(() => store.put(signed.url, bytes, { "content-length": "3" })).toThrow("headers")
  expect(await store.size("k")).toBeUndefined()
})

it("refuses a download url used to upload", async () => {
  const { store } = clocked()
  const read = await store.download("k")
  expect(() => store.put(read.url, bytes, { "content-length": "3", "if-none-match": "*" })).toThrow("expired")
})
