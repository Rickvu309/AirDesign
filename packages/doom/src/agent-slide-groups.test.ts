import { describe, expect, it } from "vitest"
import type { AgentChange } from "./agent-change.js"
import { compileAgentChange } from "./agent-compile.js"
import { compiled, minter } from "./testing/agent-fixtures.js"
import { slideForm } from "./agent-slide-fields.js"
import {
  applyEdit,
  childrenOf,
  doomFromTree,
  invert,
  isRefusal,
  nodeId,
  orderKeyBetween,
  parentOf,
  rev,
  slideGroups,
  slidesOf,
  type Doom,
  type NodeId,
  type OrderKey,
  type Write,
} from "./index.js"
import { agent, once } from "./sample-deck.js"
import { placement } from "./testing/placement-rules.js"
import { starts } from "./testing/start-rules.js"
import { testTheme } from "./testing/theme.js"

const change = (value: Record<string, unknown>) => value as AgentChange

function land(doom: Doom, writes: readonly Write[]): Doom {
  const next = applyEdit(doom, {
    once: once(),
    author: { kind: "person", id: "test" },
    writes,
    rev: rev(doom.rev + 1),
  })
  if (isRefusal(next)) throw new Error(JSON.stringify(next))
  return next
}

function placed(doom: Doom, value: Record<string, unknown>, mint = minter()): Doom {
  return land(doom, compiled(doom, change(value), mint))
}

function grouped(sizes: readonly number[]) {
  const total = sizes.reduce((sum, size) => sum + size, 0)
  const grown = doomFromTree({
    theme: testTheme,
    slides: Array.from({ length: total }, (_, at) => ({ name: `S${String(at + 1)}`, children: [] })),
  })
  const first = parentOf(grown.doom.nodes.get(grown.slides[0]!))!
  const deck = parentOf(grown.doom.nodes.get(first.id))!
  const writes: Write[] = []
  const groups = [first.id]
  let groupAt = first.at
  let start = 0
  sizes.forEach((size, number) => {
    const group = number === 0 ? first.id : nodeId(`g:${String(number + 1)}`)
    if (number > 0) {
      groups.push(group)
      groupAt = orderKeyBetween(groupAt, null)
      writes.push(
        { node: group, prop: "type", value: "slideRow" },
        { node: group, prop: "parent", value: { id: deck.id, at: groupAt } },
      )
    }
    let at: OrderKey | null = null
    for (const slide of grown.slides.slice(start, start + size)) {
      at = orderKeyBetween(at, null)
      writes.push({ node: slide, prop: "parent", value: { id: group, at } })
    }
    start += size
  })
  return { doom: land(grown.doom, writes), slides: grown.slides, groups, deck: deck.id }
}

function picture(doom: Doom): string[] {
  const deck = [...doom.nodes.values()].find((node) => node.type === "deck")
  if (deck === undefined) return []
  return childrenOf(doom, deck.id).map((row) => {
    const kids = childrenOf(doom, row.id)
      .map((slide) => `${slide.id}@${parentOf(slide)?.at ?? ""}`)
      .join(",")
    return `${row.id}@${parentOf(row)?.at ?? ""}:${kids}`
  })
}

function shown(doom: Doom): NodeId[][] {
  return slideGroups(doom).map((group) => [...group.slides])
}

function restored(before: Doom, writes: readonly Write[]): Doom {
  const asked = { once: "undo", author: agent("run-1"), writes, rev: rev(before.rev + 1) }
  const after = land(before, writes)
  return land(after, invert(before, after, asked))
}

function bothWays(before: Doom, left: readonly Write[], right: readonly Write[]): [Doom, Doom] {
  return [land(land(before, left), right), land(land(before, right), left)]
}

describe("an agent places slides and slide groups", () => {
  it("puts slides first in a group, or after a slide in that group", () => {
    const { doom, slides, groups } = grouped([2, 2, 1])
    const first = placed(doom, change({ op: "slide", move: { slide: slides[4], group: groups[0], after: null } }))
    expect(shown(first)).toEqual([
      [slides[4], slides[0], slides[1]],
      [slides[2], slides[3]],
    ])
    const after = placed(
      doom,
      change({ op: "slide", move: { slides: [slides[4]!, slides[0]!], group: groups[1], after: slides[2] } }),
    )
    expect(shown(after)).toEqual([[slides[1]], [slides[2], slides[4], slides[0], slides[3]]])
    expect(slideGroups(after).map((group) => group.group)).toEqual([groups[0], groups[1]])
    expect(childrenOf(after, groups[2]!).map((slide) => slide.id)).toEqual([])
  })

  it("starts a group after a group, with a new slide or with slides it already has", () => {
    const { doom, slides, groups } = grouped([1, 1, 1])
    const added = placed(doom, change({ op: "slide", add: { group: "new", after: groups[0] } }), minter("x"))
    const made = slidesOf(added).find((slide) => !slides.includes(slide.id))!
    expect(shown(added)).toEqual([[slides[0]], [made.id], [slides[1]], [slides[2]]])
    expect(parentOf(added.nodes.get(made.id))?.id).not.toBe(groups[0])
    const moved = placed(
      doom,
      change({ op: "slide", move: { slides: [slides[2], slides[0]], group: "new", after: null } }),
    )
    expect(shown(moved)).toEqual([[slides[2], slides[0]], [slides[1]]])
    const emptied = [...moved.nodes.values()].find(
      (node) => node.type === "slideRow" && childrenOf(moved, node.id).length === 0,
    )
    expect(emptied).toBeDefined()
    expect(parentOf(emptied)?.id).toBeDefined()
    expect(slideGroups(moved).some((group) => group.group === emptied?.id)).toBe(false)
  })

  it("moves a whole slide group before or after another", () => {
    const { doom, slides, groups } = grouped([1, 2, 1])
    expect(shown(placed(doom, change({ op: "slide", move: { group: groups[2], before: groups[1] } })))).toEqual([
      [slides[0]],
      [slides[3]],
      [slides[1], slides[2]],
    ])
    expect(shown(placed(doom, change({ op: "slide", move: { group: groups[0], after: groups[1] } })))).toEqual([
      [slides[1], slides[2]],
      [slides[0]],
      [slides[3]],
    ])
    const same = compiled(doom, change({ op: "slide", move: { group: groups[1], after: groups[0] } }))
    expect(same).toEqual([])
  })

  it("undoes creating a group or moving a whole group in one edit", () => {
    const { doom, slides, groups } = grouped([1, 2, 1])
    for (const ask of [
      { op: "slide", add: { group: "new", after: groups[0] } },
      { op: "slide", move: { slide: slides[3], group: "new", after: groups[0] } },
      { op: "slide", move: { group: groups[2], before: groups[1] } },
    ]) {
      expect(picture(restored(doom, compiled(doom, change(ask))))).toEqual(picture(doom))
    }
  })

  it("keeps a concurrently deleted slide deleted when a new group receives it in either order", () => {
    const { doom, slides, groups } = grouped([1, 1, 1])
    const make = compiled(doom, change({ op: "slide", move: { slide: slides[2], group: "new", after: groups[0] } }))
    const remove = compiled(doom, change({ op: "slide", delete: slides[2] }))
    const [one, other] = bothWays(doom, make, remove)
    expect(shown(one)).toEqual([[slides[0]], [slides[1]]])
    expect(picture(one)).toEqual(picture(other))
    expect(parentOf(one.nodes.get(slides[2]!))).toBeNull()
  })

  it("can put a slide first in an empty saved group", () => {
    const { doom, slides, groups } = grouped([1, 0, 1])
    const moved = placed(doom, { op: "slide", move: { slide: slides[1], group: groups[1], after: null } })
    expect(slideGroups(moved)).toEqual([
      { group: groups[0], slides: [slides[0]] },
      { group: groups[1], slides: [slides[1]] },
    ])
  })

  it("restores slides and groups, including an emptied group, with one undo", () => {
    const { doom, slides, groups } = grouped([1, 1, 1])
    const ask = change({ op: "slide", move: { slide: slides[1], group: groups[2], after: null } })
    const writes = compiled(doom, ask)
    const moved = land(doom, writes)
    expect(shown(moved)).toEqual([[slides[0]], [slides[1], slides[2]]])
    const empty = groups[1]!
    expect(childrenOf(moved, empty)).toEqual([])
    expect(parentOf(moved.nodes.get(empty))?.id).toBeDefined()
    expect(slideGroups(moved).some((group) => group.group === empty)).toBe(false)
    expect(picture(restored(doom, writes))).toEqual(picture(doom))
  })

  it("converges when two clients place into one tie, in either order", () => {
    const { doom, slides, groups } = grouped([3, 1])
    const row = groups[0]!
    const tied = parentOf(doom.nodes.get(slides[0]!))!.at
    const base = land(doom, [
      { node: slides[1]!, prop: "parent", value: { id: row, at: tied } },
      { node: slides[2]!, prop: "parent", value: { id: row, at: tied } },
    ])
    const left = compiled(base, change({ op: "slide", add: { group: row, after: slides[0] } }), minter("a"))
    const right = compiled(
      base,
      change({ op: "slide", move: { slide: slides[3], group: row, after: slides[1] } }),
      minter("b"),
    )
    const [one, other] = bothWays(base, left, right)
    expect(picture(one)).toEqual(picture(other))
    const order = slidesOf(one).map((slide) => slide.id)
    const added = order.find((id) => !slides.includes(id))!
    expect(order).toEqual([slides[0], added, slides[1], slides[3], slides[2]])
    const keys = slidesOf(one).map((slide) => parentOf(slide)!.at)
    expect(new Set(keys).size).toBe(keys.length)
    expect(childrenOf(one, groups[1]!).map((slide) => slide.id)).toEqual([])
  })

  it("converges when two clients move two groups to the front, or start a group at one spot", () => {
    const { doom, groups } = grouped([1, 1, 1])
    const frontA = compiled(doom, change({ op: "slide", move: { group: groups[1], after: null } }), minter("a"))
    const frontB = compiled(doom, change({ op: "slide", move: { group: groups[2], after: null } }), minter("b"))
    const [one, other] = bothWays(doom, frontA, frontB)
    expect(picture(one)).toEqual(picture(other))
    const startedA = compiled(doom, change({ op: "slide", add: { group: "new", after: groups[0] } }), minter("a"))
    const startedB = compiled(doom, change({ op: "slide", add: { group: "new", after: groups[0] } }), minter("b"))
    const [first, second] = bothWays(doom, startedA, startedB)
    expect(picture(first)).toEqual(picture(second))
    expect(slideGroups(first)).toHaveLength(5)
  })

  it("refuses without a change, and names the id to send", () => {
    const { doom, slides, groups } = grouped([1, 1])
    const before = picture(doom)
    const refuse = (value: Record<string, unknown>) =>
      compileAgentChange(doom, change(value), minter(), placement, starts)
    expect(refuse({ op: "slide", move: { after: null } })).toMatchObject({
      refused: "shape",
      field: "move",
      form: slideForm.moveWhat,
    })
    expect(refuse({ op: "slide", move: { group: "new", after: null } })).toMatchObject({
      refused: "shape",
      form: slideForm.newSlides,
    })
    expect(refuse({ op: "slide", move: { group: slides[0], after: null } })).toMatchObject({
      refused: "shape",
      field: "group",
      fault: "needs",
      needs: "a slide group id from get, where a slide line ends with group=<id>",
    })
    expect(refuse({ op: "slide", move: { slide: slides[1], group: groups[1], after: slides[0] } })).toMatchObject({
      refused: "shape",
      field: "after",
      fault: "needs",
      needs: "a slide id in that group, or null to put these first",
    })
    expect(refuse({ op: "slide", add: { after: null } })).toMatchObject({ form: slideForm.addFirst })
    expect(picture(doom)).toEqual(before)
  })
})
