import type { DeckId } from "@airdesign/catalog"
import { legacyElement, rootElement } from "@airdesign/document"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { installIndexedDb, node, countingRemote } from "./browser-fixtures.js"
import { connect, deleteDatabase, memoryRemote } from "./index.js"
import { readRows, rowKey } from "./store.js"
import { writeRows } from "./browser-fixtures.js"

beforeEach(() => {
  installIndexedDb()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

describe("live cache", () => {
  it("drops a stored row that has no node and flushes the row after it", async () => {
    const { remote, commits } = countingRemote()
    const cache = connect(remote)
    await writeRows(
      [
        {
          key: rowKey("deck", "pending", 0),
          row: { kind: "pending", deck: "deck" as DeckId, order: 0, base: 0, value: "orphan" },
        },
      ],
      [],
    )
    expect(await cache.enqueue("deck", "named", node, "file")).toEqual({ ok: true, painted: "named" })
    expect(await cache.flush("deck")).toMatchObject({ ok: true, revision: 1 })
    expect(commits).toEqual([["named"]])
    expect(await cache.pending("deck")).toEqual([])
    expect((await cache.rows("deck")).map((row) => row.value)).toEqual(["named"])
  })

  it("drops a stored row on the old node a and flushes the row before it", async () => {
    const { remote, commits } = countingRemote()
    const cache = connect(remote)
    expect(await cache.enqueue("deck", "named", node, "file")).toEqual({ ok: true, painted: "named" })
    await writeRows(
      [
        {
          key: rowKey("deck", "pending", 1),
          row: { kind: "pending", deck: "deck" as DeckId, order: 1, base: 1, value: "legacy", node: rootElement },
        },
      ],
      [],
    )
    expect(await cache.flush("deck")).toMatchObject({ ok: true, revision: 1 })
    expect(commits).toEqual([["named"]])
    expect(await cache.rows("deck")).toEqual([expect.objectContaining({ kind: "confirmed", value: "named", node })])
    expect(await cache.flush("deck")).toEqual({ ok: false, refusal: "batch", empty: true })
  })

  it("drops a stored confirmed row with a malformed node and keeps the legacy node row", async () => {
    const cache = connect(memoryRemote())
    await writeRows(
      [
        {
          key: rowKey("deck", "confirmed", 1),
          row: { kind: "confirmed", deck: "deck" as DeckId, revision: 1, value: "kept", node: legacyElement },
        },
        {
          key: rowKey("deck", "confirmed", 2),
          row: { kind: "confirmed", deck: "deck" as DeckId, revision: 2, value: "bad", node: "toString" as never },
        },
      ],
      [],
    )
    expect((await cache.rows("deck")).map((row) => row.value)).toEqual(["kept"])
    expect((await readRows("deck")).map((row) => row.value)).toEqual(["kept"])
  })
})
