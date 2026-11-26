import fc from "fast-check"
import { describe, expect, it } from "vitest"
import {
  applyEdit,
  invert,
  isRefusal,
  nodeId,
  onDeck,
  parentOf,
  rev,
  viewOf,
  type Doom,
  type Edit,
  type Write,
} from "./index.js"
import { parentLanding, type ParentFate } from "./parent-landing.js"
import { box, create, ids, land, once, person, place, revOf, sampleDeck } from "./sample-deck.js"

const slide2 = nodeId("t:8")
const made = nodeId("t:9")
const nodes = [ids.card, ids.side, ids.title, ids.caption] as const
const slides = [ids.slide, slide2] as const

type TargetKind = "live" | "deleted" | "created" | "missing"
type BaseKind = "none" | "saw-live" | "delete"
type DeckFate = "drop" | "restore" | "refuse" | "land"

const deckWithTwoSlides = () =>
  land(sampleDeck(), [...create(slide2, "slide", ids.row), { node: slide2, prop: "name", value: "Slide 2" }])

function stage(nodeDeleted: boolean, target: TargetKind) {
  let doom = deckWithTwoSlides()
  const node = ids.card
  const targetId = target === "deleted" ? ids.side : target === "live" ? slide2 : made
  if (target === "deleted") doom = land(doom, [{ node: ids.side, prop: "parent", value: null }])
  const sawLive = revOf(doom, node, "parent")!
  if (nodeDeleted) doom = land(doom, [{ node, prop: "parent", value: null }])
  return { doom, node, targetId, sawLive, deleteRev: revOf(doom, node, "parent")! }
}

function editFor(row: { readonly nodeDeleted: boolean; readonly base: BaseKind; readonly target: TargetKind }): {
  readonly doom: Doom
  readonly edit: Edit
  readonly node: (typeof ids)["card"]
  readonly targetId: ReturnType<typeof nodeId>
} {
  const staged = stage(row.nodeDeleted, row.target)
  const base = row.base === "none" ? undefined : row.base === "delete" ? staged.deleteRev : staged.sawLive
  const writes: Write[] = []
  if (row.target === "created") {
    writes.push(
      { node: made, prop: "type", value: "frame" },
      { node: made, prop: "parent", value: place(ids.slide) },
      { node: made, prop: "box", value: box(0, 0, 10, 10) },
    )
  }
  writes.push({
    node: staged.node,
    prop: "parent",
    value: place(staged.targetId),
    ...(base === undefined ? {} : { base }),
  })
  writes.push({ node: staged.node, prop: "name", value: "Back" })
  writes.push({ node: ids.caption, prop: "name", value: "Kept" })
  return {
    doom: staged.doom,
    edit: { once: once(), author: person, writes },
    node: staged.node,
    targetId: staged.targetId,
  }
}

const fateOf = (doom: Doom, writes: readonly Write[], write: Write): ParentFate => parentLanding(doom, writes, write)

function landedFate(
  before: Doom,
  edit: Edit,
  node: (typeof ids)["card"],
  targetId: ReturnType<typeof nodeId>,
): DeckFate {
  const server = applyEdit(before, { ...edit, rev: rev(before.rev + 1) })
  const client = viewOf(before, [edit])
  const serverDeck = isRefusal(server) ? before : server
  const parentKey = (doom: Doom) => {
    const parent = parentOf(doom.nodes.get(node))
    return parent === undefined ? "none" : parent === null ? "deleted" : parent.id
  }
  expect(parentKey(client)).toBe(parentKey(serverDeck))
  expect(onDeck(client.nodes, node)).toBe(onDeck(serverDeck.nodes, node))
  if (isRefusal(server)) return "refuse"
  const wasDeleted = parentOf(before.nodes.get(node)) === null
  const now = parentOf(server.nodes.get(node))
  if (wasDeleted && now === null) return "drop"
  if (wasDeleted) {
    expect(now?.id).toBe(targetId)
    return "restore"
  }
  expect(now?.id).toBe(targetId)
  return "land"
}

const rows: readonly {
  readonly name: string
  readonly nodeDeleted: boolean
  readonly base: BaseKind
  readonly target: TargetKind
  readonly fate: ParentFate
  readonly deck: DeckFate
}[] = [
  { name: "fresh edit, live target", nodeDeleted: true, base: "none", target: "live", fate: "drop", deck: "drop" },
  {
    name: "fresh edit, parent created in the edit",
    nodeDeleted: true,
    base: "none",
    target: "created",
    fate: "drop",
    deck: "drop",
  },
  {
    name: "fresh edit, deleted target",
    nodeDeleted: true,
    base: "none",
    target: "deleted",
    fate: "pass",
    deck: "refuse",
  },
  {
    name: "fresh edit, missing target",
    nodeDeleted: true,
    base: "none",
    target: "missing",
    fate: "pass",
    deck: "refuse",
  },
  {
    name: "undo of a move, live target",
    nodeDeleted: true,
    base: "saw-live",
    target: "live",
    fate: "drop",
    deck: "drop",
  },
  {
    name: "undo of a move, parent created in the edit",
    nodeDeleted: true,
    base: "saw-live",
    target: "created",
    fate: "drop",
    deck: "drop",
  },
  {
    name: "undo of a move, deleted target",
    nodeDeleted: true,
    base: "saw-live",
    target: "deleted",
    fate: "drop",
    deck: "drop",
  },
  {
    name: "redo of a move after a delete, live target",
    nodeDeleted: true,
    base: "saw-live",
    target: "live",
    fate: "drop",
    deck: "drop",
  },
  {
    name: "undo of the delete, live target",
    nodeDeleted: true,
    base: "delete",
    target: "live",
    fate: "restore",
    deck: "restore",
  },
  {
    name: "undo of the delete, parent created in the edit",
    nodeDeleted: true,
    base: "delete",
    target: "created",
    fate: "restore",
    deck: "restore",
  },
  {
    name: "undo of the delete, deleted target",
    nodeDeleted: true,
    base: "delete",
    target: "deleted",
    fate: "restore",
    deck: "restore",
  },
  {
    name: "fresh edit of a live layer, live target",
    nodeDeleted: false,
    base: "none",
    target: "live",
    fate: "pass",
    deck: "land",
  },
  {
    name: "fresh edit of a live layer, parent created in the edit",
    nodeDeleted: false,
    base: "none",
    target: "created",
    fate: "pass",
    deck: "land",
  },
  {
    name: "fresh edit of a live layer, deleted target",
    nodeDeleted: false,
    base: "none",
    target: "deleted",
    fate: "pass",
    deck: "refuse",
  },
  {
    name: "undo of a move of a live layer, live target",
    nodeDeleted: false,
    base: "saw-live",
    target: "live",
    fate: "pass",
    deck: "land",
  },
  {
    name: "undo of a move of a live layer, deleted target",
    nodeDeleted: false,
    base: "saw-live",
    target: "deleted",
    fate: "pass",
    deck: "refuse",
  },
]

describe("a parent write on a deleted node", () => {
  it.each(rows)("$name", (row) => {
    const { doom, edit, node, targetId } = editFor(row)
    const write = edit.writes.find((each) => each.node === node && each.prop === "parent")!
    expect(fateOf(doom, edit.writes, write)).toBe(row.fate)
    expect(landedFate(doom, edit, node, targetId)).toBe(row.deck)
    const server = applyEdit(doom, { ...edit, rev: rev(doom.rev + 1) })
    if (row.deck === "refuse") {
      expect(isRefusal(server)).toBe(true)
      return
    }
    const after = server as Doom
    expect(after.nodes.get(ids.caption)).toMatchObject({ name: "Kept" })
    if (row.deck === "drop") expect(after.nodes.get(node)).not.toHaveProperty("name")
    if (row.deck === "restore") {
      expect(after.nodes.get(node)).toMatchObject({ name: "Back" })
      expect(onDeck(after.nodes, node)).toBe(row.target !== "deleted")
    }
  })

  it("does not restore a deleted slide from a parent write with no base", () => {
    const added = nodeId("t:21")
    const doom = land(deckWithTwoSlides(), [{ node: ids.slide, prop: "parent", value: null }])
    const edit: Edit = {
      once: once(),
      author: person,
      writes: [
        { node: ids.slide, prop: "parent", value: place(ids.row) },
        { node: added, prop: "type", value: "slide" },
        { node: added, prop: "parent", value: place(ids.row) },
      ],
    }
    expect(parentLanding(doom, edit.writes, edit.writes[0]!)).toBe("drop")
    const server = applyEdit(doom, { ...edit, rev: rev(doom.rev + 1) })
    expect(isRefusal(server)).toBe(false)
    const client = viewOf(doom, [edit])
    for (const deck of [server as Doom, client]) {
      expect(parentOf(deck.nodes.get(ids.slide))).toBeNull()
      expect(parentOf(deck.nodes.get(added))?.id).toBe(ids.row)
    }
  })
})

describe("the queued undo and the group the verifier ran", () => {
  it("keeps a layer deleted when a queued undo of its move is projected after another tab deletes it", () => {
    const start = deckWithTwoSlides()
    const red = ids.card
    const move: Write[] = [
      { node: red, prop: "parent", value: place(slide2) },
      { node: red, prop: "box", value: box(12, 14) },
    ]
    const moved = land(start, move)
    const undoWrites = invert(start, moved, { once: "move", author: person, writes: move, rev: moved.rev })
    const parent = undoWrites.find((write) => write.node === red && write.prop === "parent")
    expect(parent?.base).toBe(moved.rev)
    const deleted = land(moved, [{ node: red, prop: "parent", value: null }])
    expect(parent?.base).not.toBe(revOf(deleted, red, "parent"))
    const undo: Edit = { once: "undo-move", author: person, writes: undoWrites }
    const client = viewOf(deleted, [undo])
    const server = applyEdit(deleted, { ...undo, rev: rev(deleted.rev + 1) })
    expect(isRefusal(server)).toBe(false)
    expect(parentOf(client.nodes.get(red))).toBeNull()
    expect(parentOf((server as Doom).nodes.get(red))).toBeNull()
    expect(client.nodes.get(red)).toMatchObject({ box: box(12, 14) })
    expect((server as Doom).nodes.get(red)).toMatchObject({ box: box(12, 14) })
  })

  it.each(["group", "frame"] as const)(
    "a %s leaves a concurrently deleted member deleted and groups the live one",
    (kind) => {
      const wrapper = nodeId("t:9")
      const doom = land(sampleDeck(), [{ node: ids.card, prop: "parent", value: null }])
      const writes: Write[] = [
        { node: wrapper, prop: "type", value: "frame" },
        { node: wrapper, prop: "parent", value: place(ids.slide) },
        { node: wrapper, prop: "name", value: kind === "group" ? "Group" : "Frame" },
        { node: wrapper, prop: "box", value: box(0, 0, 20, 20) },
        kind === "group"
          ? { node: wrapper, prop: "sizing", value: { w: "hug", h: "hug" } }
          : { node: wrapper, prop: "clip", value: true },
        { node: ids.card, prop: "parent", value: place(wrapper) },
        { node: ids.card, prop: "box", value: box(1, 1, 4, 4) },
        { node: ids.side, prop: "parent", value: place(wrapper) },
        { node: ids.side, prop: "box", value: box(2, 2, 4, 4) },
      ]
      const edit: Edit = { once: once(), author: person, writes }
      expect(parentLanding(doom, writes, writes[5]!)).toBe("drop")
      const client = viewOf(doom, [edit])
      const server = applyEdit(doom, { ...edit, rev: rev(doom.rev + 1) })
      expect(isRefusal(server)).toBe(false)
      for (const deck of [client, server as Doom]) {
        expect(parentOf(deck.nodes.get(ids.card))).toBeNull()
        expect(deck.nodes.get(ids.card)).toMatchObject({ box: box(100) })
        expect(parentOf(deck.nodes.get(ids.side))?.id).toBe(wrapper)
        expect(parentOf(deck.nodes.get(wrapper))?.id).toBe(ids.slide)
        expect(onDeck(deck.nodes, ids.card)).toBe(false)
        expect(onDeck(deck.nodes, ids.side)).toBe(true)
      }
    },
  )
})

function shapeOf(doom: Doom): string {
  return [...doom.nodes.keys()]
    .sort()
    .map(
      (id) =>
        `${id} ${parentOf(doom.nodes.get(id)) === null ? "deleted" : parentOf(doom.nodes.get(id)) === undefined ? "none" : parentOf(doom.nodes.get(id))!.id} ${onDeck(doom.nodes, id) ? "paints" : "hidden"}`,
    )
    .join("\n")
}

function orphanOf(doom: Doom): string | undefined {
  for (const [id, node] of doom.nodes) {
    const parent = parentOf(node)
    if (parent === undefined || parent === null) {
      for (const [list, kids] of doom.children) if (kids.includes(id)) return `${id} listed under ${list}`
      continue
    }
    if (!doom.nodes.has(parent.id)) return `${id} parent ${parent.id} missing`
    if (!(doom.children.get(parent.id) ?? []).includes(id)) return `${id} missing from ${parent.id}`
    if (parentOf(doom.nodes.get(parent.id)) === null && onDeck(doom.nodes, id))
      return `${id} paints under deleted ${parent.id}`
  }
  for (const [list, kids] of doom.children) {
    if (!doom.nodes.has(list)) return `list ${list} missing`
    for (const id of kids) {
      const parent = parentOf(doom.nodes.get(id))
      if (parent == null || parent.id !== list) return `${id} list ${list}`
    }
  }
  return undefined
}

function deletesHold(server: Doom, pending: readonly Edit[], project: boolean): void {
  let doom = server
  for (const edit of pending) {
    const deleted = [...doom.nodes.keys()].filter((id) => parentOf(doom.nodes.get(id)) === null)
    const next = project ? viewOf(doom, [edit]) : applyEdit(doom, { ...edit, rev: rev(doom.rev + 1) })
    if (!project && isRefusal(next)) continue
    if (project && next === doom) continue
    const after = next as Doom
    for (const id of deleted) {
      const write = edit.writes.find((each) => each.node === id && each.prop === "parent" && each.value !== null)
      const restores = write?.base !== undefined && write.base === doom.revs.get(id)?.get("parent")
      if (!restores) expect(parentOf(after.nodes.get(id))).toBeNull()
    }
    expect(orphanOf(after)).toBeUndefined()
    doom = after
  }
}

describe("two clients", () => {
  it("converge on deletes, with nothing deleted painted and no orphan", () => {
    const op = fc.record({
      t: fc.constantFrom("move", "group", "delete", "undo", "sync"),
      c: fc.constantFrom(0, 1),
      n: fc.integer({ min: 0, max: 3 }),
      s: fc.integer({ min: 0, max: 1 }),
    })
    const opening = [
      { t: "move", c: 0, n: 0, s: 1 },
      { t: "sync", c: 0, n: 0, s: 0 },
      { t: "undo", c: 0, n: 0, s: 0 },
      { t: "delete", c: 1, n: 0, s: 0 },
      { t: "sync", c: 1, n: 0, s: 0 },
      { t: "group", c: 0, n: 0, s: 0 },
      { t: "delete", c: 1, n: 1, s: 0 },
      { t: "sync", c: 1, n: 0, s: 0 },
    ]
    fc.assert(
      fc.property(fc.array(op, { maxLength: 12 }), (extra) => {
        const ops = [...opening, ...extra]
        let server = deckWithTwoSlides()
        const pending: Edit[][] = [[], []]
        const steps: { before: Doom; edit: Edit & { rev: ReturnType<typeof rev> } }[][] = [[], []]
        let minted = 30
        const queue = (client: number, writes: readonly Write[]) => {
          const before = viewOf(server, pending[client]!)
          const edit: Edit = { once: once(), author: { kind: "person", id: client === 0 ? "a" : "b" }, writes }
          const after = viewOf(before, [edit])
          if (after === before) return
          pending[client]!.push(edit)
          steps[client]!.push({ before, edit: { ...edit, rev: after.rev } })
        }
        const view = (client: number) => viewOf(server, pending[client]!)
        for (const each of ops) {
          const client = each.c
          const seen = view(client)
          if (each.t === "sync") {
            let next = server
            for (const edit of pending[client]!) {
              const landed = applyEdit(next, { ...edit, rev: rev(next.rev + 1) })
              if (!isRefusal(landed)) next = landed
            }
            server = next
            pending[client] = []
          } else if (each.t === "undo") {
            const step = steps[client]!.pop()
            if (step !== undefined) {
              const writes = invert(step.before, seen, step.edit)
              if (writes.length > 0) queue(client, writes)
            }
          } else if (each.t === "delete") {
            const live = nodes.filter((id) => onDeck(seen.nodes, id))
            const id = live[each.n % Math.max(live.length, 1)]
            if (id !== undefined) queue(client, [{ node: id, prop: "parent", value: null }])
          } else if (each.t === "move") {
            const live = nodes.filter((id) => onDeck(seen.nodes, id))
            const id = live[each.n % Math.max(live.length, 1)]
            const slide = slides[each.s]!
            if (id !== undefined && onDeck(seen.nodes, slide))
              queue(client, [
                { node: id, prop: "parent", value: place(slide) },
                { node: id, prop: "box", value: box(12, 14) },
              ])
          } else {
            const live = nodes.filter((id) => onDeck(seen.nodes, id))
            const groups = new Map<string, (typeof nodes)[number][]>()
            for (const id of live) {
              const parent = parentOf(seen.nodes.get(id))?.id
              if (parent === undefined) continue
              const list = groups.get(parent) ?? []
              list.push(id)
              groups.set(parent, list)
            }
            const members = [...groups.values()].find((list) => list.length >= 2)
            if (members !== undefined) {
              const wrapper = nodeId(`w:${minted}`)
              minted += 1
              const parent = parentOf(seen.nodes.get(members[0]!))!
              queue(client, [
                { node: wrapper, prop: "type", value: "frame" },
                { node: wrapper, prop: "parent", value: { id: parent.id, at: parent.at } },
                { node: wrapper, prop: "box", value: box(0, 0, 8, 8) },
                ...members.flatMap((id) => [
                  { node: id, prop: "parent" as const, value: place(wrapper) },
                  { node: id, prop: "box" as const, value: box(1, 1, 4, 4) },
                ]),
              ])
            }
          }
          expect(orphanOf(server)).toBeUndefined()
          for (const side of [0, 1]) {
            const projected = view(side)
            expect(orphanOf(projected)).toBeUndefined()
            deletesHold(server, pending[side]!, true)
            deletesHold(server, pending[side]!, false)
            expect(shapeOf(projected).includes("deleted paints")).toBe(false)
          }
        }
        for (const side of [0, 1]) {
          let next = server
          for (const edit of pending[side]!) {
            const landed = applyEdit(next, { ...edit, rev: rev(next.rev + 1) })
            if (!isRefusal(landed)) next = landed
          }
          server = next
          pending[side] = []
        }
        expect(viewOf(server, pending[0]!)).toBe(server)
        expect(viewOf(server, pending[1]!)).toBe(server)
        expect(orphanOf(server)).toBeUndefined()
        expect(shapeOf(server).includes("deleted paints")).toBe(false)
      }),
      { numRuns: 40 },
    )
  })
})
