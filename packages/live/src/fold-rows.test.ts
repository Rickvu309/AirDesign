import type { DeckId } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { foldToJson, testTheme } from "@airdesign/doom/testing"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { installIndexedDb, traffic } from "./browser-fixtures.js"
import { deleteDatabase, finished, scoped, storeName, transaction } from "./device.js"
import { openDoomDeck } from "./doom-deck.js"
import type { DoomRemote } from "./doom-remote.js"
import { deviceStorage, doomQueuePrefix } from "./doom-storage.js"
import { doomNodeKey, retiredFoldKey } from "./fold-rows.js"
import { readRange, readSlot, signedIn, writeSlot } from "./store.js"

const person: doom.Author = { kind: "person", id: "tab" }
const box = (x: number) => ({ x, y: 20, w: 300, h: 100, rotation: 0, flipH: false, flipV: false })

function boardOf(slides: number) {
  return doom.doomFromTree({
    theme: testTheme,
    slides: Array.from({ length: slides }, (_, slide) => ({
      children: Array.from({ length: 10 }, (_, shape) => ({
        type: "shape" as const,
        name: `${String(slide)}.${String(shape)}`,
        props: { box: box(10) },
      })),
    })),
  })
}

function landed(fold: doom.Doom, once: string, writes: readonly doom.Write[]): doom.Doom {
  const next = doom.applyEdit(fold, { once, author: person, writes, rev: doom.rev(fold.rev + 1) })
  if (doom.isRefusal(next)) throw new Error(JSON.stringify(next))
  return next
}

async function writtenByOneEdit(slides: number) {
  const grown = boardOf(slides)
  const storage = deviceStorage(`cost${String(slides)}`)
  await storage.write({ fold: grown.doom, queue: [] })
  const moved = landed(grown.doom, "move", [{ node: grown.ids["1.1"]!, prop: "box", value: box(50) }])
  const before = { ...traffic }
  await storage.write({ fold: moved })
  return { puts: traffic.puts - before.puts, bytes: traffic.bytes - before.bytes, moved }
}

describe("what one landed edit writes to the device", () => {
  beforeEach(installIndexedDb)
  afterEach(deleteDatabase)

  it("is the same on a 40-slide deck as on a 5-slide deck", async () => {
    const small = await writtenByOneEdit(5)
    const large = await writtenByOneEdit(40)
    expect(large.puts).toBe(small.puts)
    expect(large.bytes).toBeLessThan(small.bytes * 1.2)
    expect(large.bytes).toBeLessThan(2_000)
  })

  it("reopens as the fold it wrote", async () => {
    const { moved } = await writtenByOneEdit(5)
    expect(foldToJson((await deviceStorage("cost5").read())!.fold!)).toEqual(foldToJson(moved))
  })

  it("writes the whole fold again when another tab wrote an older one in between", async () => {
    const grown = boardOf(2)
    const first = landed(grown.doom, "one", [{ node: grown.ids["0.0"]!, prop: "name", value: "One" }])
    const second = landed(first, "two", [{ node: grown.ids["1.0"]!, prop: "name", value: "Two" }])
    const ahead = deviceStorage("tabs")
    const behind = deviceStorage("tabs")
    await ahead.write({ fold: first })
    await behind.write({ fold: grown.doom })
    await ahead.write({ fold: second })
    expect(foldToJson((await deviceStorage("tabs").read())!.fold!)).toEqual(foldToJson(second))
  })
})

async function removeRow(key: string) {
  const writing = await transaction("readwrite")
  writing.objectStore(storeName).delete(scoped(signedIn(), key))
  await finished(writing, () => undefined)
}

function renames(fold: doom.Doom, node: doom.NodeId, name: string) {
  const edit: doom.Edit = { once: `rename ${name}`, author: person, writes: [{ node, prop: "name", value: name }] }
  return { queued: { edit, after: [null] }, fold: landed(fold, edit.once, edit.writes) }
}

const unreachable = () => Promise.reject(new TypeError("offline"))
const offline: DoomRemote = { create: unreachable, open: unreachable, since: unreachable, edit: unreachable }

describe("two tabs that land the same edit", () => {
  beforeEach(installIndexedDb)
  afterEach(deleteDatabase)

  it("write its rows once", async () => {
    const grown = boardOf(2)
    const moved = renames(grown.doom, grown.ids["0.0"]!, "Both tabs").fold
    await deviceStorage("pair").write({ fold: grown.doom, queue: [] })
    const [one, other] = [deviceStorage("pair"), deviceStorage("pair")]
    await Promise.all([one.read(), other.read()])
    await one.write({ fold: moved })
    const before = traffic.puts
    await other.write({ fold: moved })
    expect(traffic.puts).toBe(before)
    const next = renames(moved, grown.ids["0.1"]!, "Then one").fold
    await other.write({ fold: next })
    expect(traffic.puts - before).toBe(3)
    expect(foldToJson((await deviceStorage("pair").read())!.fold!)).toEqual(foldToJson(next))
  })
})

describe("a device copy saved as one value by the earlier app", () => {
  beforeEach(installIndexedDb)
  afterEach(deleteDatabase)

  async function savedByTheEarlierApp(deck: string) {
    const grown = boardOf(2)
    const { queued } = renames(grown.doom, grown.ids["1.1"]!, "Typed offline")
    await writeSlot(retiredFoldKey(deck), foldToJson(grown.doom))
    await deviceStorage(deck).write({ queue: [queued] })
    return { grown, queued }
  }

  it("opens offline with its queued edit and moves to rows", async () => {
    const { grown, queued } = await savedByTheEarlierApp("upgrade")
    const opened = await openDoomDeck(offline, "upgrade", { client: "a" })
    if (!opened.ok) throw new Error("the earlier copy should open offline")
    expect(opened.deck.view().nodes.get(grown.ids["1.1"]!)?.name).toBe("Typed offline")
    expect(await readSlot(retiredFoldKey("upgrade"))).toBeNull()
    const kept = await deviceStorage("upgrade").read()
    expect(foldToJson(kept!.fold!)).toEqual(foldToJson(grown.doom))
    expect(kept!.queue).toEqual([queued])
  })

  it("leaves the earlier app no copy and the whole queue after a row save", async () => {
    const { grown, queued } = await savedByTheEarlierApp("rollback")
    const storage = deviceStorage("rollback")
    await storage.read()
    await storage.write({ fold: landed(grown.doom, "other", [{ node: grown.ids["0.0"]!, prop: "name", value: "A" }]) })
    expect(await readSlot(retiredFoldKey("rollback"))).toBeNull()
    expect((await readRange(doomQueuePrefix("rollback"))).map(({ value }) => value)).toEqual([queued])
  })

  it("wins over rows it is not behind, as after a rollback and a second upgrade", async () => {
    const grown = boardOf(2)
    await deviceStorage("again").write({ fold: grown.doom, queue: [] })
    const later = renames(grown.doom, grown.ids["0.1"]!, "Saved by the earlier app").fold
    await writeSlot(retiredFoldKey("again"), foldToJson(later))
    expect(foldToJson((await deviceStorage("again").read())!.fold!)).toEqual(foldToJson(later))
    expect(await readSlot(retiredFoldKey("again"))).toBeNull()
    expect(foldToJson((await deviceStorage("again").read())!.fold!)).toEqual(foldToJson(later))
  })

  it("loses to newer rows", async () => {
    const grown = boardOf(2)
    const later = renames(grown.doom, grown.ids["0.1"]!, "Saved as rows").fold
    await deviceStorage("behind").write({ fold: later, queue: [] })
    await writeSlot(retiredFoldKey("behind"), foldToJson(grown.doom))
    expect(foldToJson((await deviceStorage("behind").read())!.fold!)).toEqual(foldToJson(later))
    expect(await readSlot(retiredFoldKey("behind"))).toBeNull()
  })
})

describe("a device copy whose rows do not add up to its head", () => {
  beforeEach(installIndexedDb)
  afterEach(deleteDatabase)

  async function savedWithQueue(deck: string) {
    const grown = boardOf(2)
    const first = renames(grown.doom, grown.ids["1.1"]!, "Before").fold
    const { queued } = renames(first, grown.ids["1.1"]!, "Typed offline")
    await deviceStorage(deck).write({ fold: grown.doom, queue: [] })
    const storage = deviceStorage(deck)
    await storage.read()
    await storage.write({ fold: first, queue: [queued] })
    return { grown, first, queued, leaf: doomNodeKey(deck, grown.ids["1.1"]!) }
  }

  it("is no copy when a leaf row is gone, and keeps the queue", async () => {
    const { queued, leaf } = await savedWithQueue("partial")
    await removeRow(leaf)
    expect(await deviceStorage("partial").read()).toEqual({ queue: [queued] })
  })

  it("is no copy when a leaf row is from an older revision", async () => {
    const { grown, queued, leaf } = await savedWithQueue("mixed")
    await writeSlot(leaf, { node: grown.doom.nodes.get(grown.ids["1.1"]!) })
    expect(await deviceStorage("mixed").read()).toEqual({ queue: [queued] })
  })

  it("is no copy when a row was added", async () => {
    const { grown } = await savedWithQueue("extra")
    await writeSlot(doomNodeKey("extra", "stray"), {
      node: { ...grown.doom.nodes.get(grown.ids["1.1"]!), id: "stray" },
    })
    expect((await deviceStorage("extra").read())?.fold).toBeUndefined()
  })

  it("opens from the server, replays the queued edit and repairs the copy at the same revision", async () => {
    const { first, grown, leaf } = await savedWithQueue("repair")
    await removeRow(leaf)
    const server = {
      ...offline,
      open: async () => ({ ok: true as const, deck: "repair" as DeckId, rev: first.rev, fold: first }),
    }
    const opened = await openDoomDeck(server, "repair", { client: "a" })
    if (!opened.ok) throw new Error("the server copy should open")
    expect(opened.deck.view().nodes.get(grown.ids["1.1"]!)?.name).toBe("Typed offline")
    expect(foldToJson((await deviceStorage("repair").read())!.fold!)).toEqual(foldToJson(first))
  })

  it("does not open offline", async () => {
    const { leaf } = await savedWithQueue("unreachable")
    await removeRow(leaf)
    await expect(openDoomDeck(offline, "unreachable", { client: "a" })).rejects.toThrow("offline")
    expect((await readRange(doomQueuePrefix("unreachable"))).length).toBe(1)
  })
})

describe("a landed edit whose once starts with the last code unit", () => {
  beforeEach(installIndexedDb)
  afterEach(deleteDatabase)

  it("reopens with its once", async () => {
    const grown = boardOf(1)
    const fold = landed(grown.doom, "\uffffz", [{ node: grown.ids["0.0"]!, prop: "name", value: "Edge" }])
    await deviceStorage("edge").write({ fold, queue: [] })
    expect((await deviceStorage("edge").read())!.fold!.onces.get("\uffffz")).toBe(fold.rev)
  })
})
