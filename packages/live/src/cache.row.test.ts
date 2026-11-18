import type { WireEdit, WireSlide } from "@airdesign/catalog"
import { format, landedPatch, type Register, type Row } from "@airdesign/document"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { installSlowIndexedDb, memoryShelf, node, slowStore } from "./browser-fixtures.js"
import { connect, deleteDatabase, memoryRemote, type Remote } from "./index.js"

const slow = slowStore()
const accent: Row = { v: format, patch: { fills: { p0: { set: { solid: { scheme: "accent2" } } } } } }
const inherited: Row = { v: format, patch: { fills: { p0: "inherit" } } }

beforeEach(() => {
  installSlowIndexedDb(slow)
})

afterEach(async () => {
  slow.drop()
  vi.unstubAllGlobals()
  await deleteDatabase()
})

function fillOf(register: Register) {
  const body = register.elements[node]
  if (body === undefined) throw new Error("missing node")
  return landedPatch(body, "text").fills
}

function sending(remote: Remote, sent: (WireEdit | WireSlide)[]): Remote {
  return {
    ...remote,
    commit: (body) => {
      sent.push(...body.batch)
      return remote.commit(body)
    },
  }
}

it("keeps a person's fill rows on the device one by one, replays them after a reopen and sends each as a row", async () => {
  const sent: (WireEdit | WireSlide)[] = []
  const remote = sending(memoryRemote(), sent)
  const cache = connect(remote)
  expect(await cache.enqueueRow("deck", accent, node, "file text")).toEqual({ ok: true, painted: accent })
  expect(await cache.enqueueRow("deck", inherited, node, "file text")).toEqual({ ok: true, painted: inherited })
  const pending = await connect(remote).openDeck("deck")
  if (!pending.ok) throw new Error(pending.refusal)
  expect(pending.phase).toBe("on-device")
  expect(pending.pending.map((row) => row.v)).toEqual([format, format])
  expect(fillOf(pending.register)).toEqual({ p0: "inherit" })
  expect((await cache.flush("deck")).ok).toBe(true)
  expect(sent).toEqual([
    { ...accent, node, floor: "file text" },
    { ...inherited, node },
  ])
  const confirmed = await connect(remote).openDeck("deck")
  if (!confirmed.ok) throw new Error(confirmed.refusal)
  expect(confirmed.phase).toBe("confirmed")
  expect(fillOf(confirmed.register)).toEqual({ p0: "inherit" })
})

it("keeps a fill row that is still unsaved when the page reloads", async () => {
  const journal = new Map<string, string>()
  let count = 0
  const entry = () => `entry-${(count += 1)}`
  const cache = connect(memoryRemote(), { shelf: memoryShelf(journal), entry })
  slow.hold()
  void cache.enqueueRow("deck", accent, node, "file text")
  await new Promise((resolve) => setTimeout(resolve, 0))
  slow.drop()
  const opened = await connect(memoryRemote(), { shelf: memoryShelf(journal), entry }).openDeck("deck")
  if (!opened.ok) throw new Error(opened.refusal)
  expect(fillOf(opened.register)).toEqual(accent.patch.fills)
  expect(journal.size).toBe(0)
})

it("refuses a row it cannot read and keeps nothing on the device", async () => {
  const cache = connect(memoryRemote())
  const refused = { ok: false, refusal: "field" }
  expect(await cache.enqueueRow("deck", { v: format + 1, patch: accent.patch }, node, "")).toEqual(refused)
  const unknown = { fills: { p0: { set: { solid: { scheme: "accent9" } } } } }
  expect(await cache.enqueueRow("deck", { v: format, patch: unknown } as unknown as Row, node, "")).toEqual(refused)
  expect(await cache.pending("deck")).toEqual([])
})
