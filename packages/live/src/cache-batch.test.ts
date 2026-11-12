import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { installIndexedDb, node, other, countingRemote } from "./browser-fixtures.js"
import { type CommitResult, connect, deleteDatabase, memoryRemote, type Remote } from "./index.js"

beforeEach(() => {
  installIndexedDb()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

describe("live cache batches", () => {
  it("sends 101 pending edits in batches of at most 100", async () => {
    const { remote, commits } = countingRemote()
    const cache = connect(remote)
    for (let index = 0; index < 101; index += 1)
      await cache.enqueue("deck", `v${index}`, index % 2 === 0 ? node : other, "")
    expect(await cache.flush("deck")).toMatchObject({ ok: true })
    expect(commits.map((batch) => batch.length)).toEqual([100, 1])
    expect(commits.flat()).toEqual(Array.from({ length: 101 }, (_, index) => `v${index}`))
    expect(await cache.pending("deck")).toEqual([])
    expect((await cache.rows("deck")).filter((row) => row.kind === "confirmed")).toHaveLength(101)
  })

  it("sends exactly 100 pending edits in one batch", async () => {
    const { remote, commits } = countingRemote()
    const cache = connect(remote)
    for (let index = 0; index < 100; index += 1)
      await cache.enqueue("deck", `v${index}`, index % 2 === 0 ? node : other, "")
    expect(await cache.flush("deck")).toMatchObject({ ok: true })
    expect(commits.map((batch) => batch.length)).toEqual([100])
    expect(await cache.pending("deck")).toEqual([])
  })

  it("keeps the last row pending when the second batch is refused", async () => {
    const real = memoryRemote()
    const sizes: number[] = []
    let refuse = true
    const remote: Remote = {
      open: (body) => real.open(body),
      watch: (body) => real.watch(body),
      commit: async (body) => {
        sizes.push(body.batch.length)
        if (sizes.length === 2 && refuse) return { ok: false, refusal: "session" }
        return real.commit(body)
      },
    }
    const cache = connect(remote)
    for (let index = 0; index < 101; index += 1)
      await cache.enqueue("deck", `v${index}`, index % 2 === 0 ? node : other, "")
    expect(await cache.flush("deck")).toEqual({ ok: false, refusal: "session" })
    expect(sizes).toEqual([100, 1])
    const kept = await cache.rows("deck")
    expect(kept.filter((row) => row.kind === "confirmed")).toHaveLength(100)
    expect((await cache.pending("deck")).map((row) => row.value)).toEqual(["v100"])
    refuse = false
    expect(await cache.flush("deck")).toMatchObject({ ok: true })
    expect(sizes).toEqual([100, 1, 1])
    expect(await cache.pending("deck")).toEqual([])
    expect((await cache.rows("deck")).filter((row) => row.kind === "confirmed")).toHaveLength(101)
  })

  it("stops at a refused batch and sends no later batch", async () => {
    const real = memoryRemote()
    const sizes: number[] = []
    const remote: Remote = {
      open: (body) => real.open(body),
      watch: (body) => real.watch(body),
      commit: async (body) => {
        sizes.push(body.batch.length)
        if (sizes.length === 2) return { ok: false, refusal: "session" }
        return real.commit(body)
      },
    }
    const cache = connect(remote)
    for (let index = 0; index < 201; index += 1)
      await cache.enqueue("deck", `v${index}`, index % 2 === 0 ? node : other, "")
    expect(await cache.flush("deck")).toEqual({ ok: false, refusal: "session" })
    expect(sizes).toEqual([100, 100])
    expect(await cache.pending("deck")).toHaveLength(101)
  })

  it("keeps the second batch pending when its commit key does not match", async () => {
    const real = memoryRemote()
    let calls = 0
    const remote: Remote = {
      open: (body) => real.open(body),
      watch: (body) => real.watch(body),
      commit: async (body) => {
        calls += 1
        const answer = await real.commit(body)
        if (calls === 2 && answer.ok) return { ...answer, key: "deck:9" } as CommitResult
        return answer
      },
    }
    const cache = connect(remote)
    for (let index = 0; index < 101; index += 1)
      await cache.enqueue("deck", `v${index}`, index % 2 === 0 ? node : other, "")
    expect(await cache.flush("deck")).toEqual({ ok: false, refusal: "payload" })
    expect((await cache.rows("deck")).filter((row) => row.kind === "confirmed")).toHaveLength(100)
    expect((await cache.pending("deck")).map((row) => row.value)).toEqual(["v100"])
  })

  it("returns the answer of the last batch", async () => {
    const real = memoryRemote()
    const answers: CommitResult[] = []
    const remote: Remote = {
      open: (body) => real.open(body),
      watch: (body) => real.watch(body),
      commit: async (body) => {
        const answer = await real.commit(body)
        answers.push(answer)
        return answer
      },
    }
    const cache = connect(remote)
    for (let index = 0; index < 101; index += 1)
      await cache.enqueue("deck", `v${index}`, index % 2 === 0 ? node : other, "")
    const result = await cache.flush("deck")
    expect(answers).toHaveLength(2)
    expect(result).toEqual(answers[1])
  })
})
