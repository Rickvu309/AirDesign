import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import {
  dropped,
  landed,
  provisionalRevs,
  queueEdit,
  sendable,
  shown,
  skipped,
  trimmed,
  type Queued,
} from "./doom-queue.js"

const person: doom.Author = { kind: "person", id: "tab" }
const id = doom.nodeId
const deck = id("s:1")
const row = id("s:2")
const slide = id("s:3")
const title = id("s:4")
const card = id("s:5")

const words = (chars: string): doom.Text => ({
  chars,
  spans: [],
  paras: [{}],
  style: "body",
  resize: "height",
  alignV: "top",
})
const box = (x: number) => ({ x, y: 0, w: 100, h: 50, rotation: 0, flipH: false, flipV: false })
const at = (parent: doom.NodeId) => ({ id: parent, at: orderKeyBetween(null, null) })

function server(): doom.Doom {
  const first = doom.applyEdit(doom.emptyDoom, {
    once: "start",
    author: person,
    rev: doom.rev(1),
    writes: [
      { node: deck, prop: "type", value: "deck" },
      { node: row, prop: "type", value: "slideRow" },
      { node: row, prop: "parent", value: at(deck) },
      { node: slide, prop: "type", value: "slide" },
      { node: slide, prop: "parent", value: at(row) },
      { node: title, prop: "type", value: "shape" },
      { node: title, prop: "parent", value: at(slide) },
      { node: title, prop: "text", value: words("one") },
      { node: title, prop: "box", value: box(0) },
      { node: card, prop: "type", value: "frame" },
      { node: card, prop: "parent", value: at(slide) },
      { node: card, prop: "name", value: "Card" },
    ],
  })
  if (doom.isRefusal(first)) throw new Error("start")
  return first
}

const edit = (once: string, writes: readonly doom.Write[]): doom.Edit => ({ once, author: person, writes })

function queued(base: doom.Doom, queue: readonly Queued[], next: doom.Edit): Queued[] {
  const made = queueEdit(base, queue, next)
  if (doom.isRefusal(made)) throw new Error(JSON.stringify(made))
  return [...queue, made]
}

describe("queueing an edit on the view", () => {
  it("gives a write to a compare-and-set property the rev the view holds, and leaves a last-writer property without a base", () => {
    const base = server()
    const [made] = queued(
      base,
      [],
      edit("a", [
        { node: title, prop: "text", value: words("two") },
        { node: title, prop: "box", value: box(9) },
      ]),
    )
    expect(made?.edit.writes).toEqual([
      { node: title, prop: "text", value: words("two"), base: doom.rev(1) },
      { node: title, prop: "box", value: box(9) },
    ])
    expect(made?.after).toEqual([null, null])
  })

  it("keeps the base an author sent when it names a rev the server holds", () => {
    const base = server()
    const [made] = queued(base, [], edit("a", [{ node: title, prop: "box", value: box(9), base: doom.rev(1) }]))
    expect(made?.edit.writes[0]).toMatchObject({ base: doom.rev(1) })
  })

  it("names the queued edit a base is built on, and holds no number for it", () => {
    const base = server()
    const first = queued(base, [], edit("a", [{ node: title, prop: "text", value: words("two") }]))
    const second = queued(base, first, edit("b", [{ node: title, prop: "text", value: words("three") }]))
    expect(second[1]?.after).toEqual(["a"])
    expect(second[1]?.edit.writes[0]).not.toHaveProperty("base")
    expect(second[0]?.after).toEqual([null])
  })

  it("names the queued edit an undo is built on when it carries that edit's provisional rev", () => {
    const base = server()
    const first = queued(base, [], edit("a", [{ node: title, prop: "box", value: box(5) }]))
    const provisional = [
      ...provisionalRevs(
        base,
        first.map((each) => each.edit),
      ),
    ]
    expect(provisional).toEqual([[doom.rev(2), "a"]])
    const second = queued(base, first, edit("undo", [{ node: title, prop: "box", value: box(0), base: doom.rev(2) }]))
    expect(second[1]?.after).toEqual(["a"])
  })

  it("refuses an edit whose base names a provisional rev no queued edit holds", () => {
    const base = server()
    expect(queueEdit(base, [], edit("a", [{ node: title, prop: "box", value: box(5), base: doom.rev(7) }]))).toEqual({
      refused: "stale",
      node: title,
      prop: "box",
    })
  })

  it("puts a queued edit on the server's fold as the view, and a second server fold under it rebases it", () => {
    const base = server()
    const queue = queued(base, [], edit("a", [{ node: card, prop: "name", value: "Mine" }]))
    expect(shown(base, queue).nodes.get(card)).toMatchObject({ name: "Mine" })
    const moved = doom.applyEdit(base, {
      once: "other",
      author: person,
      rev: doom.rev(2),
      writes: [{ node: title, prop: "box", value: box(40) }],
    })
    if (doom.isRefusal(moved)) throw new Error("moved")
    const view = shown(moved, queue)
    expect(view.nodes.get(card)).toMatchObject({ name: "Mine" })
    expect(view.nodes.get(title)).toMatchObject({ box: box(40) })
  })
})

describe("an edit landing", () => {
  it("leaves the queue and gives each edit built on it the real rev it landed at", () => {
    const base = server()
    let queue = queued(base, [], edit("a", [{ node: title, prop: "text", value: words("two") }]))
    queue = queued(base, queue, edit("b", [{ node: title, prop: "text", value: words("three") }]))
    queue = queued(base, queue, edit("c", [{ node: card, prop: "name", value: "C" }]))
    const rest = landed(queue, "a", doom.rev(5))
    expect(rest.map((each) => each.edit.once)).toEqual(["b", "c"])
    expect(rest[0]?.after).toEqual([null])
    expect(rest[0]?.edit.writes[0]).toMatchObject({ base: doom.rev(5) })
    expect(sendable(rest[0]!)).toEqual(rest[0]?.edit)
    expect(rest[1]).toEqual(queue[2])
  })

  it("is not sendable while its base still names a queued edit", () => {
    const base = server()
    let queue = queued(base, [], edit("a", [{ node: title, prop: "text", value: words("two") }]))
    queue = queued(base, queue, edit("b", [{ node: title, prop: "text", value: words("three") }]))
    expect(() => sendable(queue[1]!)).toThrow("queued")
  })
})

describe("a turn skipped", () => {
  it("leaves the queue and gives each edit built on it the base the turn had, as if it never was", () => {
    const base = server()
    let queue = queued(base, [], edit("undo", [{ node: title, prop: "text", value: words("two"), base: doom.rev(1) }]))
    queue = queued(base, queue, edit("redo", [{ node: title, prop: "text", value: words("one") }]))
    expect(queue[1]?.after).toEqual(["undo"])
    queue = queued(base, queue, edit("other", [{ node: card, prop: "name", value: "C" }]))
    const rest = skipped(queue, "undo")
    expect(rest.map((each) => each.edit.once)).toEqual(["redo", "other"])
    expect(rest[0]?.after).toEqual([null])
    expect(rest[0]?.edit.writes[0]).toMatchObject({ base: doom.rev(1) })
    expect(sendable(rest[0]!)).toEqual(rest[0]?.edit)
    expect(rest[1]).toEqual(queue[2])
  })
})

describe("a turn trimmed to some of its writes", () => {
  it("gives a write built on a write it lost that write's base, and keeps the base to come for one it kept", () => {
    const filled = doom.applyEdit(server(), {
      once: "fill",
      author: person,
      rev: doom.rev(2),
      writes: [{ node: title, prop: "fills", value: [{ kind: "solid", color: { var: "accent1" } }] }],
    })
    if (doom.isRefusal(filled)) throw new Error("fill")
    const red = [{ kind: "solid", color: { var: "accent2" } }]
    let queue = queued(
      filled,
      [],
      edit("undo", [
        { node: title, prop: "text", value: words("two") },
        { node: title, prop: "fills", value: red },
      ]),
    )
    queue = queued(
      filled,
      queue,
      edit("redo", [
        { node: title, prop: "text", value: words("one") },
        { node: title, prop: "fills", value: [] },
      ]),
    )
    expect(queue[1]?.after).toEqual(["undo", "undo"])
    const kept = queue[0]!.edit.writes.filter((write) => write.prop === "fills")
    const rest = trimmed(queue, "undo", kept)
    expect(rest[0]?.edit.writes).toEqual(kept)
    expect(rest[0]?.after).toEqual([null])
    expect(rest[1]?.after).toEqual([null, "undo"])
    expect(rest[1]?.edit.writes[0]).toMatchObject({ prop: "text", base: doom.rev(1) })
    expect(rest[1]?.edit.writes[1]).not.toHaveProperty("base")
    expect(landed(rest, "undo", doom.rev(5))[0]?.edit.writes[1]).toMatchObject({ prop: "fills", base: doom.rev(5) })
  })
})

describe("an edit dropped", () => {
  it("takes the edits built on it, and the edits built on those, and nothing else", () => {
    const base = server()
    let queue = queued(base, [], edit("a", [{ node: title, prop: "text", value: words("two") }]))
    queue = queued(base, queue, edit("b", [{ node: title, prop: "text", value: words("three") }]))
    queue = queued(base, queue, edit("c", [{ node: title, prop: "text", value: words("four") }]))
    queue = queued(base, queue, edit("d", [{ node: card, prop: "name", value: "D" }]))
    const rest = dropped(queue, "a")
    expect(rest.gone).toEqual(["a", "b", "c"])
    expect(rest.queue.map((each) => each.edit.once)).toEqual(["d"])
  })

  it("takes an undo built on a refused step even when the step's provisional rev equals another edit's real rev", () => {
    const base = server()
    let queue = queued(base, [], edit("step", [{ node: title, prop: "box", value: box(5) }]))
    queue = queued(base, queue, edit("undo", [{ node: title, prop: "box", value: box(0), base: doom.rev(2) }]))
    const rest = dropped(queue, "step")
    expect(rest.gone).toEqual(["step", "undo"])
    expect(rest.queue).toEqual([])
  })

  it("takes the follow-up that names it, such as the deck name a title edit derived", () => {
    const base = server()
    const [typed, named] = queued(
      base,
      queued(base, [], edit("title", [{ node: title, prop: "text", value: words("Q3") }])),
      edit("name", [{ node: deck, prop: "name", value: "Q3" }]),
    )
    const queue = [typed!, { ...named!, follows: "title" }]
    const rest = dropped(queue, "title")
    expect(rest.gone).toEqual(["title", "name"])
    expect(rest.queue).toEqual([])
  })

  it("drops one that is not queued as nothing", () => {
    const base = server()
    const queue = queued(base, [], edit("a", [{ node: card, prop: "name", value: "A" }]))
    expect(dropped(queue, "zzz")).toEqual({ queue, gone: [] })
  })
})
