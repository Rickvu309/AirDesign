import type { WireEdit, WireSlide } from "@airdesign/catalog"
import { currentBox, currentValue, decide, version, type Register } from "@airdesign/document"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { installIndexedDb, node } from "./browser-fixtures.js"
import { connect, deleteDatabase, memoryRemote, type Remote } from "./index.js"

const first = { x: 914400, y: 457200, cx: 1828800, cy: 914400 }
const second = { x: -1, y: 0, cx: 0, cy: 7 }

beforeEach(() => {
  installIndexedDb()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

function shown(register: Register) {
  const body = register.elements[node]
  if (body === undefined) throw new Error("missing node")
  return { text: currentValue(body), box: currentBox(body), version: version(body) }
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

it("keeps a box on the device, replays it after a reopen and sends it as a box", async () => {
  const sent: (WireEdit | WireSlide)[] = []
  const remote = sending(memoryRemote(), sent)
  const cache = connect(remote)
  expect(await cache.enqueue("deck", "typed", node, "file text")).toEqual({ ok: true, painted: "typed" })
  expect(await cache.enqueueBox("deck", first, node, "file text")).toEqual({ ok: true, painted: first })
  expect(await cache.enqueueBox("deck", second, node, "file text")).toEqual({ ok: true, painted: second })
  const pending = await connect(remote).openDeck("deck")
  if (!pending.ok) throw new Error(pending.refusal)
  expect(pending.phase).toBe("on-device")
  expect(shown(pending.register)).toEqual({ text: "typed", box: second, version: 3 })
  expect((await cache.flush("deck")).ok).toBe(true)
  expect(sent).toEqual([
    { value: "typed", node, floor: "file text" },
    { property: "box", value: first, node },
    { property: "box", value: second, node },
  ])
  const confirmed = await connect(remote).openDeck("deck")
  if (!confirmed.ok) throw new Error(confirmed.refusal)
  expect(confirmed.phase).toBe("confirmed")
  expect(shown(confirmed.register)).toEqual({ text: "typed", box: second, version: 3 })
})

it("stores an agent's box from the server and shows it after the device store is gone", async () => {
  const remote = memoryRemote()
  const opened = await remote.open({ deck: "deck" })
  if (!opened.ok) throw new Error(opened.refusal)
  const added = decide(opened.register, { command: "add", node, floor: "file text", route: "deck" })
  if (added.decision !== "apply") throw new Error(added.code)
  const started = decide(added.register, { command: "start", node, runId: "run" })
  if (started.decision !== "apply") throw new Error(started.code)
  const moved = decide(started.register, {
    command: "agent",
    node,
    runId: "run",
    readAt: 0,
    property: "box",
    value: first,
  })
  if (moved.decision !== "apply") throw new Error(moved.code)
  const stored: Remote = { ...remote, open: async () => ({ ...opened, revision: 1, register: moved.register }) }
  const read = await connect(stored).openDeck("deck")
  if (!read.ok) throw new Error(read.refusal)
  expect(shown(read.register).box).toEqual(first)
  expect(read.confirmed).toEqual([
    { kind: "confirmed", deck: "deck", revision: 0, property: "box", value: first, node },
  ])
  const again = await connect(stored).openDeck("deck")
  if (!again.ok) throw new Error(again.refusal)
  expect(shown(again.register).box).toEqual(first)
})

it("refuses a box that is not whole and keeps nothing on the device", async () => {
  const cache = connect(memoryRemote())
  expect(await cache.enqueueBox("deck", { ...first, cx: -1 }, node, "")).toEqual({ ok: false, refusal: "field" })
  expect(await cache.pending("deck")).toEqual([])
})
