import { bytesOf, elementId, limits } from "@airdesign/document"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { firstAccount, installIndexedDb, node, other, signInAs, writeRows } from "./browser-fixtures.js"
import { connect, deleteDatabase, memoryRemote, type Remote } from "./index.js"
import { rowKey, type PendingRow } from "./store.js"

beforeEach(() => {
  installIndexedDb()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

const large = '"'.repeat(7_000)

function measuredRemote(): { remote: Remote; bodies: number[]; values: unknown[] } {
  const real = memoryRemote()
  const bodies: number[] = []
  const values: unknown[] = []
  return {
    bodies,
    values,
    remote: {
      open: (body) => real.open(body),
      watch: (body) => real.watch(body),
      commit: async (body) => {
        bodies.push(bytesOf(JSON.stringify(body)))
        const answer = await real.commit(body)
        if (answer.ok) for (const edit of body.batch) values.push("slide" in edit ? edit.slide : edit.value)
        return answer
      },
    },
  }
}

it("refuses a commit body over the server's limit as size, as the server does", async () => {
  const server = memoryRemote()
  await server.open({ deck: "deck" })
  const batch = Array.from({ length: 100 }, (_, index) => ({ value: large, node: index % 2 === 0 ? node : other }))
  expect(bytesOf(JSON.stringify({ deck: "deck", batch }))).toBeGreaterThan(limits.body)
  expect(await server.commit({ deck: "deck", batch })).toEqual({ ok: false, refusal: "size" })
  expect(await server.commit({ deck: "deck", batch: batch.slice(0, 2) })).toMatchObject({ ok: true })
})

it("sends pending edits larger than one request in batches that each fit, then saves a later edit", async () => {
  const { remote, bodies, values } = measuredRemote()
  const cache = connect(remote)
  for (let index = 0; index < 100; index += 1)
    expect(await cache.enqueue("deck", `${large}${index}`, index % 2 === 0 ? node : other, "")).toMatchObject({
      ok: true,
    })
  expect(await cache.flush("deck")).toMatchObject({ ok: true })
  expect(bodies.length).toBeGreaterThan(1)
  expect(bodies.every((bytes) => bytes <= limits.body)).toBe(true)
  expect(values).toEqual(Array.from({ length: 100 }, (_, index) => `${large}${index}`))
  expect(await cache.pending("deck")).toEqual([])
  await cache.enqueue("deck", "small", node, "")
  expect(await cache.flush("deck")).toMatchObject({ ok: true })
  expect(values.at(-1)).toBe("small")
  expect(await cache.pending("deck")).toEqual([])
})

it("refuses an edit too large for any request before it is queued, and saves the next edit", async () => {
  const { remote, values } = measuredRemote()
  const cache = connect(remote)
  const wide = elementId("258.9")
  expect(await cache.enqueue("deck", "v", wide, "x".repeat(limits.body))).toEqual({ ok: false, refusal: "size" })
  expect(await cache.pending("deck")).toEqual([])
  await cache.enqueue("deck", "small", node, "")
  expect(await cache.flush("deck")).toMatchObject({ ok: true })
  expect(values).toEqual(["small"])
})

async function sealAll(cache: ReturnType<typeof connect>, once: string): Promise<void> {
  const pending = await cache.pending("deck")
  await writeRows(
    pending.map((row) => ({ key: rowKey("deck", "pending", row.order), row: { ...row, once } })),
    [],
  )
  signInAs(firstAccount)
}

it("recovers a device whose sealed batch the server refused as too large", async () => {
  const { remote, bodies, values } = measuredRemote()
  const queued = connect(remote)
  for (let index = 0; index < 100; index += 1)
    await queued.enqueue("deck", `${large}${index}`, index % 2 === 0 ? node : other, "")
  await sealAll(queued, "stuck")
  const cache = connect(remote)
  expect(await cache.flush("deck")).toMatchObject({ ok: true })
  expect(bodies[0]).toBeGreaterThan(limits.body)
  expect(bodies.slice(1).every((bytes) => bytes <= limits.body)).toBe(true)
  expect(values).toEqual(Array.from({ length: 100 }, (_, index) => `${large}${index}`))
  expect(await cache.pending("deck")).toEqual([])
})

it("sets aside a pending edit too large for any request, says so once, and saves the edits after it", async () => {
  const { remote, values } = measuredRemote()
  const wide = elementId("258.9")
  const cache = connect(remote)
  await cache.enqueue("deck", "before", node, "")
  const deck = (await cache.pending("deck"))[0]?.deck
  if (deck === undefined) throw new Error("pending")
  const tooLarge: PendingRow = {
    kind: "pending",
    deck,
    order: 1,
    base: 0,
    node: wide,
    value: "v",
    floor: "x".repeat(limits.body),
  }
  await writeRows([{ key: rowKey("deck", "pending", 1), row: tooLarge }], [])
  signInAs(firstAccount)
  await cache.enqueue("deck", "after", other, "")
  expect(await connect(remote).flush("deck")).toMatchObject({ ok: true, aside: 1 })
  expect(values).toEqual(["before", "after"])
  expect(await cache.pending("deck")).toEqual([])
  expect(await connect(remote).flush("deck")).not.toHaveProperty("aside")
})
