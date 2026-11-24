import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { createDoomDeck, openDoomDeck, type DoomDeck } from "./doom-deck.js"
import { memoryDoomRemote } from "./doom-remote.js"
import { memoryStorage } from "./doom-storage.js"

const id = doom.nodeId
const [deckNode, row, slide, target, holder, line] = ["t:1", "t:2", "t:3", "t:4", "t:5", "t:6"].map(id) as [
  doom.NodeId,
  doom.NodeId,
  doom.NodeId,
  doom.NodeId,
  doom.NodeId,
  doom.NodeId,
]
const estimate = doom.measureWith({})
const first = doom.orderKeyBetween(null, null)
const at = (parent: doom.NodeId) => ({ id: parent, at: first })
const box = (x: number, y: number, w = 100, h = 50) => ({ x, y, w, h, rotation: 0, flipH: false, flipV: false })
const lineOf = (start: doom.End, end: doom.End = { x: 10, y: 10 }) => ({
  kind: "line" as const,
  start,
  end,
  route: "straight" as const,
  arrows: ["none", "none"] as const,
})
const onTarget: doom.End = { node: target, site: "r" }

const targetWrites: readonly doom.Write[] = [
  { node: target, prop: "type", value: "shape" },
  { node: target, prop: "parent", value: at(slide) },
  { node: target, prop: "box", value: box(300, 200) },
]

const seed = (targetToo: boolean): doom.Edit => ({
  once: "start",
  author: { kind: "person", id: "start" },
  writes: [
    { node: deckNode, prop: "type", value: "deck" },
    { node: row, prop: "type", value: "slideRow" },
    { node: row, prop: "parent", value: at(deckNode) },
    { node: slide, prop: "type", value: "slide" },
    { node: slide, prop: "parent", value: at(row) },
    ...(targetToo ? targetWrites : []),
    { node: holder, prop: "type", value: "frame" },
    { node: holder, prop: "parent", value: at(slide) },
    { node: holder, prop: "box", value: box(100, 100, 400, 200) },
    { node: line, prop: "type", value: "shape" },
    { node: line, prop: "parent", value: at(holder) },
    { node: line, prop: "box", value: box(0, 0, 10, 10) },
    { node: line, prop: "geometry", value: lineOf(targetToo ? onTarget : { x: 0, y: 0 }) },
  ],
})

async function tabs(start: doom.Edit) {
  const remote = memoryDoomRemote(start)
  let serial = 0
  const join = async (client: string, how: "create" | "open") => {
    const opened = await (how === "create" ? createDoomDeck : openDoomDeck)(remote, "ends", {
      once: () => `${client}-${(serial += 1)}`,
      client,
      storage: memoryStorage(),
      pause: () => Promise.resolve(),
      measure: () => estimate,
    })
    if (!opened.ok) throw new Error(JSON.stringify(opened))
    return opened.deck
  }
  return { a: await join("a", "create"), b: await join("b", "open") }
}

function geometry(view: doom.Doom) {
  const value = doom.propOf(view.nodes.get(line), "geometry")
  if (value?.kind !== "line") throw new Error("no line")
  return value
}

function painted(view: doom.Doom): { readonly from: doom.Point; readonly to: doom.Point } {
  const walk = (nodes: readonly doom.Resolved[], x: number, y: number): ReturnType<typeof painted> | null => {
    for (const node of nodes) {
      const here = { x: x + node.box.x, y: y + node.box.y }
      if (node.id === line && node.geometry?.kind === "line")
        return {
          from: { x: here.x + node.geometry.from.x, y: here.y + node.geometry.from.y },
          to: { x: here.x + node.geometry.to.x, y: here.y + node.geometry.to.y },
        }
      const inner = walk(node.children, here.x, here.y)
      if (inner !== null) return inner
    }
    return null
  }
  const found = walk(doom.resolveSlide(view, slide, estimate), 0, 0)
  if (found === null) throw new Error("line not painted")
  return found
}

async function saved(result: ReturnType<DoomDeck["push"]> | ReturnType<DoomDeck["undo"]>) {
  if (!result.ok || !("saved" in result)) throw new Error(JSON.stringify(result))
  await result.saved
}

async function settle(...decks: readonly DoomDeck[]) {
  for (const deck of decks) await deck.sync()
  for (const deck of decks) await deck.catchUp()
}

const gone = (node: doom.NodeId): doom.Write => ({ node, prop: "parent", value: null })
const onShape = { x: 400, y: 225 }

describe("a connector end whose shape leaves the deck stays where it painted, whichever tab writes last", () => {
  it("keeps the freed end when a tab that still saw the attachment moves the line's other end", async () => {
    const { a, b } = await tabs(seed(true))
    expect(painted(a.view()).from).toEqual(onShape)
    await saved(a.push([gone(target)]))
    await saved(b.push([{ node: line, prop: "geometry", value: lineOf(onTarget, { x: 40, y: 10 }) }]))
    await settle(a, b)
    for (const view of [a.view(), b.view()]) {
      expect(painted(view).from).toEqual(onShape)
      expect(geometry(view)).toEqual(lineOf({ x: 300, y: 125 }, { x: 40, y: 10 }))
    }
    await saved(a.undo())
    await settle(a, b)
    expect(geometry(b.view()).start).toEqual(onTarget)
    await saved(a.redo())
    await settle(a, b)
    expect(painted(b.view()).from).toEqual(onShape)
    expect(geometry(b.view()).start).toEqual({ x: 300, y: 125 })
  })

  it("frees an end another tab attached when an undo takes its shape off the deck, and redo attaches it again", async () => {
    const { a, b } = await tabs(seed(false))
    await saved(a.push(targetWrites))
    await settle(a, b)
    await saved(b.push([{ node: line, prop: "geometry", value: lineOf(onTarget) }]))
    await settle(b, a)
    expect(painted(a.view()).from).toEqual(onShape)
    await saved(a.undo())
    await settle(a, b)
    for (const view of [a.view(), b.view()]) {
      expect(painted(view).from).toEqual(onShape)
      expect(geometry(view).start).toEqual({ x: 300, y: 125 })
    }
    await saved(a.redo())
    await settle(a, b)
    expect(geometry(b.view()).start).toEqual(onTarget)
  })

  it("lands a delete from a tab that never saw another tab attach the line, and its whole line write wins", async () => {
    const { a, b } = await tabs(seed(true))
    await saved(b.push([{ node: line, prop: "geometry", value: lineOf({ x: 0, y: 0 }, onTarget) }]))
    await b.sync()
    await saved(a.push([gone(target)]))
    await settle(a, b)
    expect(a.notices()).toEqual([])
    for (const view of [a.view(), b.view()]) {
      expect(doom.parentOf(view.nodes.get(target))).toBe(null)
      expect(geometry(view)).toEqual(lineOf({ x: 300, y: 125 }))
      expect(painted(view).from).toEqual(onShape)
    }
  })

  it("frees an end attached unseen to a shape inside a frame where the shape painted, never out of the frame", async () => {
    const framed: doom.Edit = {
      ...seed(true),
      writes: [
        ...seed(true).writes.filter((write) => write.node !== target),
        ...targetWrites.map((write) => (write.prop === "parent" ? { ...write, value: at(holder) } : write)),
      ].map((write) =>
        write.node === line && write.prop === "parent"
          ? { ...write, value: at(slide) }
          : write.node === line && write.prop === "geometry"
            ? { ...write, value: lineOf({ x: 500, y: 325 }) }
            : write,
      ),
    }
    const { a, b } = await tabs(framed)
    await saved(b.push([{ node: line, prop: "geometry", value: lineOf(onTarget) }]))
    await b.sync()
    expect(painted(b.view()).from).toEqual({ x: 500, y: 325 })
    await saved(a.push([gone(target)]))
    await settle(a, b)
    expect(a.notices()).toEqual([])
    for (const view of [a.view(), b.view()]) {
      expect(geometry(view).start).toEqual({ x: 500, y: 325 })
      expect(painted(view).from).toEqual({ x: 500, y: 325 })
    }
  })

  it("lands a delete read before another tab moved the shape, freeing the end where the deleting tab painted it", async () => {
    const { a, b } = await tabs(seed(true))
    await saved(b.push([{ node: target, prop: "box", value: box(550, 200) }]))
    await b.sync()
    expect(painted(b.view()).from).toEqual({ x: 650, y: 225 })
    await saved(a.push([gone(target)]))
    await settle(a, b)
    expect(a.notices()).toEqual([])
    for (const view of [a.view(), b.view()]) {
      expect(doom.parentOf(view.nodes.get(target))).toBe(null)
      expect(geometry(view).start).toEqual({ x: 300, y: 125 })
      expect(painted(view).from).toEqual(onShape)
    }
  })

  it("puts the end back on its shape when an undo sent late finds another tab moved only the other end", async () => {
    const { a, b } = await tabs(seed(true))
    await saved(a.push([gone(target)]))
    await settle(a, b)
    await saved(b.push([{ node: line, prop: "geometry", value: lineOf({ x: 300, y: 125 }, { x: 40, y: 10 }) }]))
    await b.sync()
    await saved(a.undo())
    await settle(a, b)
    expect(a.notices()).toEqual([])
    for (const view of [a.view(), b.view()]) {
      expect(doom.parentOf(view.nodes.get(target))).toEqual(at(slide))
      expect(geometry(view)).toEqual(lineOf(onTarget, { x: 40, y: 10 }))
      expect(painted(view).from).toEqual(onShape)
    }
  })

  it("lands a redo sent late where the redoing tab painted, its line write winning over the other tab's", async () => {
    const { a, b } = await tabs(seed(true))
    await saved(a.push([gone(target)]))
    await settle(a, b)
    await saved(a.undo())
    await settle(a, b)
    await saved(b.push([{ node: target, prop: "box", value: box(550, 200) }]))
    await saved(b.push([{ node: line, prop: "geometry", value: lineOf(onTarget, { x: 40, y: 10 }) }]))
    await b.sync()
    await saved(a.redo())
    await settle(a, b)
    expect(a.notices()).toEqual([])
    for (const view of [a.view(), b.view()]) {
      expect(view.nodes.get(target) === undefined || doom.parentOf(view.nodes.get(target)) === null).toBe(true)
      expect(geometry(view)).toEqual(lineOf({ x: 300, y: 125 }))
      expect(painted(view).from).toEqual(onShape)
    }
  })

  it("lands a delete read before another tab changed the line, quietly, with the deleting tab's line", async () => {
    const { a, b } = await tabs(seed(true))
    await saved(b.push([{ node: line, prop: "geometry", value: lineOf(onTarget, { x: 40, y: 10 }) }]))
    await b.sync()
    await saved(a.push([gone(target)]))
    await settle(a, b)
    expect(a.notices()).toEqual([])
    for (const view of [a.view(), b.view()]) {
      expect(geometry(view)).toEqual(lineOf({ x: 300, y: 125 }))
      expect(painted(view).from).toEqual(onShape)
    }
  })

  it("moves a freed end with the line's frame, as any free point moves", async () => {
    const { a } = await tabs(seed(true))
    await saved(a.push([gone(target)]))
    await saved(a.push([{ node: holder, prop: "box", value: box(150, 100, 400, 200) }]))
    expect(painted(a.view()).from).toEqual({ x: onShape.x + 50, y: onShape.y })
  })
})
