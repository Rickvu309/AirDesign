import { orderKeyBetween, scene } from "@airdesign/document"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { installIndexedDb } from "./browser-fixtures.js"
import { deleteDatabase } from "./device.js"
import { createSceneDeck, openSceneDeck } from "./scene-deck.js"
import { memorySceneRemote, type SceneRemote } from "./scene-remote.js"
import { memoryStorage } from "./scene-storage.js"

const id = scene.nodeId
const deckNode = id("s:1")
const row = id("s:2")
const slide = id("s:3")
const title = id("s:4")
const card = id("s:5")
const at = (parent: scene.NodeId) => ({ id: parent, at: orderKeyBetween(null, null) })
const box = (x: number) => ({ x, y: 0, w: 100, h: 50, rotation: 0, flipH: false, flipV: false })
const words = (chars: string): scene.Text => ({
  chars,
  spans: [],
  paras: [{}],
  style: "body",
  resize: "height",
  alignV: "top",
})
const person: scene.Author = { kind: "person", id: "start" }

const start: scene.Edit = {
  once: "start",
  author: person,
  writes: [
    { node: deckNode, prop: "type", value: "deck" },
    { node: row, prop: "type", value: "slideRow" },
    { node: row, prop: "parent", value: at(deckNode) },
    { node: slide, prop: "type", value: "slide" },
    { node: slide, prop: "parent", value: at(row) },
    { node: title, prop: "type", value: "shape" },
    { node: title, prop: "parent", value: at(slide) },
    { node: title, prop: "text", value: words("one") },
    { node: title, prop: "box", value: box(0) },
    { node: title, prop: "name", value: "Title" },
    { node: card, prop: "type", value: "frame" },
    { node: card, prop: "parent", value: at(slide) },
    { node: card, prop: "name", value: "Card" },
  ],
}

type Spied = SceneRemote & {
  readonly sent: scene.Edit[]
  offline: boolean
  blockEdits: boolean
  loseNextAnswer: boolean
  beforeSend?: () => void
}

function spied(remote: SceneRemote): Spied {
  const spy: Spied = {
    sent: [],
    offline: false,
    blockEdits: false,
    loseNextAnswer: false,
    create: (body) => remote.create(body),
    open: (body) => remote.open(body),
    since: async (body, signal) => {
      if (spy.offline) throw new TypeError("offline")
      return remote.since(body, signal)
    },
    edit: async (body) => {
      if (spy.offline || spy.blockEdits) throw new TypeError("offline")
      spy.beforeSend?.()
      spy.sent.push(JSON.parse(JSON.stringify(body.edit)) as scene.Edit)
      const answer = await remote.edit(body)
      if (spy.loseNextAnswer) {
        spy.loseNextAnswer = false
        throw new TypeError("answer lost")
      }
      return answer
    },
  }
  return spy
}

let names = 0
const named = () => `deck${(names += 1)}`

function counter(prefix: string) {
  let next = 0
  return () => `${prefix}-${(next += 1)}`
}

async function open(remote: SceneRemote, deck: string, client: string, how: "create" | "open" = "open") {
  const opened = await (how === "create" ? createSceneDeck : openSceneDeck)(remote, deck, {
    once: counter(client),
    client,
    storage: memoryStorage(),
    pause: () => new Promise((resolve) => setTimeout(resolve, 5)),
  })
  if (!opened.ok) throw new Error(JSON.stringify(opened))
  return opened.deck
}

async function pair() {
  const shared = memorySceneRemote(start)
  const remote = spied(shared)
  const other = spied(shared)
  const deck = named()
  const first = await open(remote, deck, "a", "create")
  const second = await open(other, deck, "b")
  return { remote, other, deck, first, second }
}

const nameOf = (view: scene.Scene, node: scene.NodeId) => (view.nodes.get(node) as { name?: string }).name
const boxOf = (view: scene.Scene, node: scene.NodeId) => (view.nodes.get(node) as { box?: { x: number } }).box?.x
const textOf = (view: scene.Scene, node: scene.NodeId) => (view.nodes.get(node) as { text?: scene.Text }).text?.chars
const json = (view: scene.Scene) => scene.foldToJson(view)

function must(result: { readonly ok: boolean }) {
  expect(result.ok).toBe(true)
}

describe("a local edit", () => {
  it("paints at once, before the network is asked, and lands when sent", async () => {
    const { remote, first } = await pair()
    let seenWhenSent: string | undefined
    remote.beforeSend = () => {
      seenWhenSent = nameOf(first.view(), card)
    }
    const told = vi.fn()
    first.subscribe(told)
    must(first.push([{ node: card, prop: "name", value: "Painted" }]))
    expect(nameOf(first.view(), card)).toBe("Painted")
    expect(told).toHaveBeenCalled()
    expect(first.pending()).toHaveLength(1)
    expect(await first.sync()).toEqual({ ok: true })
    expect(seenWhenSent).toBe("Painted")
    expect(first.pending()).toEqual([])
    expect(nameOf(first.server(), card)).toBe("Painted")
    expect(json(first.view())).toEqual(json(first.server()))
  })

  it("is refused at once when the view would refuse it, and is never queued", async () => {
    const { remote, first } = await pair()
    const refused = first.push([{ node: card, prop: "name", value: 7 }])
    expect(refused).toMatchObject({ ok: false, refused: { refused: "shape" } })
    const unknown = first.push([{ node: id("zz:1"), prop: "name", value: "x" }])
    expect(unknown).toMatchObject({ ok: false, refused: { refused: "missing" } })
    expect(first.pending()).toEqual([])
    expect(remote.sent).toEqual([])
  })

  it("lands several edits in order, each built on the one before", async () => {
    const { remote, first } = await pair()
    for (const chars of ["two", "three", "four"]) must(first.push([{ node: title, prop: "text", value: words(chars) }]))
    expect(textOf(first.view(), title)).toBe("four")
    expect(await first.sync()).toEqual({ ok: true })
    expect(textOf(first.server(), title)).toBe("four")
    expect(remote.sent.map((edit) => edit.once)).toEqual(["a-1", "a-2", "a-3"])
  })
})

describe("restamping a base", () => {
  it("sends each write with the real rev of the edit that wrote the property before it, not the rev it had in the view", async () => {
    const { remote, first, second } = await pair()
    remote.offline = true
    must(first.push([{ node: title, prop: "text", value: words("a one") }]))
    must(first.push([{ node: title, prop: "text", value: words("a two") }]))
    must(second.push([{ node: card, prop: "name", value: "from b" }]))
    must(second.push([{ node: card, prop: "name", value: "from b again" }]))
    await second.sync()
    remote.offline = false
    await first.sync()
    const mine = remote.sent.filter((edit) => edit.once.startsWith("a-"))
    const landedAt = first.server().onces
    expect(landedAt.get("a-1")).toBe(4)
    expect(landedAt.get("a-2")).toBe(5)
    const firstBase = (mine[0]!.writes[0] as { base: number }).base
    expect(firstBase).toBe(1)
    const secondBase = (mine[1]!.writes[0] as { base: number }).base
    expect(secondBase).toBe(landedAt.get("a-1"))
    expect(secondBase).not.toBe(2)
    expect(textOf(first.server(), title)).toBe("a two")
  })
})

describe("an edit built on a refused one", () => {
  it("is dropped with a notice that names the edit it was built on, and the view goes back to the server's", async () => {
    const { first, second } = await pair()
    must(second.push([{ node: title, prop: "text", value: words("b wins") }]))
    await second.sync()
    expect(first.server().rev).toBe(1)
    must(first.push([{ node: title, prop: "text", value: words("a one") }]))
    must(first.push([{ node: title, prop: "text", value: words("a two") }]))
    must(first.push([{ node: card, prop: "name", value: "unrelated" }]))
    expect(await first.sync()).toEqual({ ok: true })
    expect(first.pending()).toEqual([])
    expect(textOf(first.view(), title)).toBe("b wins")
    expect(nameOf(first.view(), card)).toBe("unrelated")
    expect(first.notices()).toEqual([
      { once: "a-1", refused: "stale", node: title, prop: "text" },
      { once: "a-2", refused: "stale", because: "a-1" },
    ])
    first.clearNotices()
    expect(first.notices()).toEqual([])
  })

  it("drops an undo built on a refused step even when the step's rev in the view is the rev of another writer's landed edit", async () => {
    const { remote, first, second } = await pair()
    expect(first.server().rev).toBe(1)
    remote.offline = true
    must(first.push([{ node: title, prop: "text", value: words("a step") }]))
    expect(first.view().revs.get(title)?.get("text")).toBe(2)
    must(first.undo())
    expect(textOf(first.view(), title)).toBe("one")
    must(second.push([{ node: title, prop: "text", value: words("b wrote") }]))
    await second.sync()
    expect(second.server().revs.get(title)?.get("text")).toBe(2)
    remote.offline = false
    expect(await first.sync()).toEqual({ ok: true })
    expect(textOf(first.server(), title)).toBe("b wrote")
    expect(textOf(first.view(), title)).toBe("b wrote")
    expect(first.notices().map((notice) => notice.once)).toEqual(["a-1", "a-2"])
    expect(remote.sent.filter((edit) => edit.once.startsWith("a-")).map((edit) => edit.once)).toEqual(["a-1"])
  })
})

describe("offline", () => {
  it("keeps painting and queueing while the network is down, and replays in order on reconnect", async () => {
    const { remote, first, second } = await pair()
    remote.offline = true
    must(first.push([{ node: card, prop: "name", value: "off one" }]))
    must(first.push([{ node: title, prop: "box", value: box(40) }]))
    expect(await first.sync()).toEqual({ ok: false, reason: "offline" })
    expect(nameOf(first.view(), card)).toBe("off one")
    expect(first.pending()).toHaveLength(2)
    remote.offline = false
    expect(await first.sync()).toEqual({ ok: true })
    expect(first.pending()).toEqual([])
    await second.catchUp()
    expect(nameOf(second.view(), card)).toBe("off one")
    expect(boxOf(second.view(), title)).toBe(40)
    expect(json(second.view())).toEqual(json(first.view()))
  })

  it("creates and places new nodes while offline with ids that carry the client", async () => {
    const { remote, first, second } = await pair()
    remote.offline = true
    const made = first.mint()
    const child = first.mint()
    expect(made).toMatch(/^a:1$/)
    expect(child).toMatch(/^a:2$/)
    must(
      first.push([
        { node: made, prop: "type", value: "frame" },
        { node: made, prop: "parent", value: at(slide) },
        { node: child, prop: "type", value: "shape" },
        { node: child, prop: "parent", value: at(made) },
      ]),
    )
    expect(first.view().children.get(made)).toEqual([child])
    remote.offline = false
    await first.sync()
    await second.catchUp()
    expect(second.view().children.get(made)).toEqual([child])
  })

  it("lands an edit once when the answer was lost, and does not send it twice as new", async () => {
    const { remote, first, second } = await pair()
    remote.loseNextAnswer = true
    must(first.push([{ node: card, prop: "name", value: "Lost" }]))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(remote.sent.map((edit) => edit.once)).toEqual(["a-1"])
    expect(first.pending()).toHaveLength(1)
    expect(first.server().rev).toBe(1)
    await second.catchUp()
    expect(second.server().rev).toBe(2)
    expect(await first.sync()).toEqual({ ok: true })
    expect(first.pending()).toEqual([])
    expect(remote.sent.map((edit) => edit.once)).toEqual(["a-1", "a-1"])
    expect(first.server().rev).toBe(2)
    expect(nameOf(first.server(), card)).toBe("Lost")
    expect(json(first.view())).toEqual(json(second.view()))
  })
})

describe("two tabs", () => {
  it("converge on the server's fold after each catches up", async () => {
    const { first, second } = await pair()
    must(first.push([{ node: card, prop: "name", value: "from a" }]))
    must(second.push([{ node: title, prop: "box", value: box(77) }]))
    must(first.push([{ node: title, prop: "name", value: "Heading" }]))
    await Promise.all([first.sync(), second.sync()])
    await first.catchUp()
    await second.catchUp()
    expect(json(first.view())).toEqual(json(second.view()))
    expect(nameOf(first.view(), card)).toBe("from a")
    expect(boxOf(first.view(), title)).toBe(77)
    expect(nameOf(second.view(), title)).toBe("Heading")
  })

  it("rebase a local edit onto the other tab's landed edit by applying it again on the new server fold", async () => {
    const { remote, first, second } = await pair()
    remote.blockEdits = true
    must(first.push([{ node: title, prop: "box", value: box(5) }]))
    must(second.push([{ node: card, prop: "name", value: "other" }]))
    await second.sync()
    await first.catchUp()
    expect(nameOf(first.view(), card)).toBe("other")
    expect(boxOf(first.view(), title)).toBe(5)
    expect(first.pending()).toHaveLength(1)
    expect(boxOf(first.server(), title)).toBe(0)
  })

  it("follows the other tab's edits as they land and replays its own edits after a gap", async () => {
    const { remote, first, second } = await pair()
    const stop = new AbortController()
    const following = first.follow(stop.signal)
    must(second.push([{ node: card, prop: "name", value: "followed" }]))
    await second.sync()
    await vi.waitFor(() => expect(nameOf(first.view(), card)).toBe("followed"))
    remote.offline = true
    must(first.push([{ node: title, prop: "box", value: box(9) }]))
    await first.sync()
    expect(first.pending()).toHaveLength(1)
    remote.offline = false
    must(second.push([{ node: card, prop: "name", value: "wakes the follower" }]))
    await second.sync()
    await vi.waitFor(() => expect(first.pending()).toEqual([]))
    await second.catchUp()
    expect(boxOf(second.view(), title)).toBe(9)
    stop.abort()
    await following
  })
})

describe("undo and redo", () => {
  it("undo puts back each property the step wrote, and redo puts back the step's own values", async () => {
    const { first } = await pair()
    must(
      first.push([
        { node: title, prop: "box", value: box(30) },
        { node: title, prop: "name", value: "Renamed" },
      ]),
    )
    await first.sync()
    must(first.undo())
    expect(boxOf(first.view(), title)).toBe(0)
    expect(nameOf(first.view(), title)).toBe("Title")
    must(first.redo())
    expect(boxOf(first.view(), title)).toBe(30)
    expect(nameOf(first.view(), title)).toBe("Renamed")
    expect(await first.sync()).toEqual({ ok: true })
    must(first.undo())
    expect(await first.sync()).toEqual({ ok: true })
    expect(nameOf(first.server(), title)).toBe("Title")
  })

  it("undo leaves a property another writer changed since alone and puts back the others", async () => {
    const { first, second } = await pair()
    must(
      first.push([
        { node: title, prop: "box", value: box(30) },
        { node: title, prop: "name", value: "Mine" },
      ]),
    )
    await first.sync()
    must(second.push([{ node: title, prop: "name", value: "Theirs" }]))
    await second.sync()
    await first.catchUp()
    must(first.undo())
    expect(boxOf(first.view(), title)).toBe(0)
    expect(nameOf(first.view(), title)).toBe("Theirs")
    expect(await first.sync()).toEqual({ ok: true })
    expect(first.notices()).toEqual([])
    expect(nameOf(first.server(), title)).toBe("Theirs")
    expect(boxOf(first.server(), title)).toBe(0)
  })

  it("undo of a step that is still on its way lands on the step's real rev once the step has landed", async () => {
    const { remote, first, second } = await pair()
    must(second.push([{ node: card, prop: "name", value: "other" }]))
    await second.sync()
    must(first.push([{ node: title, prop: "text", value: words("typed") }]))
    must(first.undo())
    expect(textOf(first.view(), title)).toBe("one")
    expect(await first.sync()).toEqual({ ok: true })
    expect(first.notices()).toEqual([])
    expect(textOf(first.server(), title)).toBe("one")
    const undone = remote.sent.find((edit) => edit.once === "a-2")!
    expect((undone.writes[0] as { base: number }).base).toBe(first.server().onces.get("a-1"))
  })

  it("says there is nothing to undo when every property was overwritten since, and when no step is left", async () => {
    const { first, second } = await pair()
    must(first.push([{ node: title, prop: "name", value: "Mine" }]))
    await first.sync()
    must(second.push([{ node: title, prop: "name", value: "Theirs" }]))
    await second.sync()
    await first.catchUp()
    expect(first.undo()).toEqual({ ok: false, reason: "nothing" })
    expect(first.undo()).toEqual({ ok: false, reason: "nothing" })
    expect(first.redo()).toEqual({ ok: false, reason: "nothing" })
    expect(nameOf(first.view(), title)).toBe("Theirs")
  })

  it("undoes the creation of a node by deleting it, and redoes it by putting it back", async () => {
    const { first } = await pair()
    const made = first.mint()
    must(
      first.push([
        { node: made, prop: "type", value: "frame" },
        { node: made, prop: "parent", value: at(slide) },
      ]),
    )
    await first.sync()
    expect(first.view().children.get(slide)).toContain(made)
    must(first.undo())
    expect(first.view().children.get(slide) ?? []).not.toContain(made)
    expect(await first.sync()).toEqual({ ok: true })
    must(first.redo())
    expect(first.view().children.get(slide)).toContain(made)
    expect(await first.sync()).toEqual({ ok: true })
    expect(first.server().children.get(slide)).toContain(made)
  })

  it("forgets the redo steps when a new edit is made", async () => {
    const { first } = await pair()
    must(first.push([{ node: card, prop: "name", value: "One" }]))
    must(first.undo())
    must(first.push([{ node: card, prop: "name", value: "Two" }]))
    expect(first.redo()).toEqual({ ok: false, reason: "nothing" })
  })
})

describe("on this device", () => {
  beforeEach(installIndexedDb)
  afterEach(async () => {
    await deleteDatabase()
  })

  it("keeps the fold and the queue in IndexedDB, so a reload offline paints the same and replays on reconnect", async () => {
    const remote = spied(memorySceneRemote(start))
    const deck = named()
    const opened = await createSceneDeck(remote, deck, { once: counter("a"), client: "a" })
    if (!opened.ok) throw new Error("open")
    must(opened.deck.push([{ node: card, prop: "name", value: "Kept" }]))
    remote.offline = true
    must(opened.deck.push([{ node: title, prop: "text", value: words("kept text") }]))
    must(opened.deck.push([{ node: title, prop: "text", value: words("kept more") }]))
    await opened.deck.sync()
    expect(opened.deck.pending().length).toBeGreaterThan(0)
    const before = json(opened.deck.view())
    await vi.waitFor(async () => {
      const again = await openSceneDeck(remote, deck, { once: counter("a2"), client: "a" })
      if (!again.ok) throw new Error("reopen")
      expect(json(again.deck.view())).toEqual(before)
    })
    const reloaded = await openSceneDeck(remote, deck, { once: counter("a2"), client: "a" })
    if (!reloaded.ok) throw new Error("reload")
    expect(reloaded.deck.pending().length).toBe(opened.deck.pending().length)
    remote.offline = false
    expect(await reloaded.deck.sync()).toEqual({ ok: true })
    expect(textOf(reloaded.deck.server(), title)).toBe("kept more")
    expect(reloaded.deck.pending()).toEqual([])
    const third = await openSceneDeck(remote, deck, { client: "a" })
    if (!third.ok) throw new Error("third")
    expect(third.deck.pending()).toEqual([])
  })

  it("refuses a deck the server does not know and a deck id it cannot read", async () => {
    const remote = spied(memorySceneRemote(start))
    expect(await openSceneDeck(remote, "nowhere", { client: "a" })).toEqual({ ok: false, refusal: "deck" })
    expect(await openSceneDeck(remote, "not a deck id", { client: "a" })).toEqual({ ok: false, refusal: "deck" })
  })
})
