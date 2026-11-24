import { describe, expect, it } from "vitest"
import type { NodeId } from "./ids.js"
import { invert, invertRun, orderKeyBetween, replacedBy, type Doom, type Write } from "./index.js"
import { attached, deck, detach, lineOf, startOf, step } from "./testing/line-end-fixtures.js"

const lineWrite = (doom: Doom, line: NodeId, change: object): Write => ({
  node: line,
  prop: "geometry",
  value: { ...lineOf(doom, line), ...change },
})

describe("a write that names a shape no longer on the deck", () => {
  it("keeps the end the line holds and lands the rest of the write", () => {
    const grown = deck()
    const l = grown.ids.l!
    const freed = step(grown.doom, "free", [
      ...detach([grown.ids.t!]),
      lineWrite(grown.doom, l, { start: { x: 300, y: 225 } }),
    ])
    const stale = step(freed.after, "stale", [lineWrite(grown.doom, l, { end: { x: 40, y: 10 } })]).after
    expect(lineOf(stale, l).start).toEqual({ x: 300, y: 225 })
    expect(lineOf(stale, l).end).toEqual({ x: 40, y: 10 })
  })

  it("keeps the reference when the same write moves the line to another frame, so the end paints at the shape's last place", () => {
    const grown = deck()
    const [t, l, slide] = [grown.ids.t!, grown.ids.l!, grown.slides[0]!]
    const seen = startOf(grown.doom, slide, l)
    const moved = step(grown.doom, "free", [
      { node: l, prop: "parent", value: { id: slide, at: orderKeyBetween(null, null) } },
      lineWrite(grown.doom, l, { start: { x: 5, y: 5 } }),
    ]).after
    const gone = step(moved, "gone", detach([t])).after
    const back = step(gone, "back", [
      { node: l, prop: "parent", value: { id: grown.ids.j!, at: orderKeyBetween(null, null) } },
      lineWrite(grown.doom, l, {}),
    ]).after
    expect(lineOf(back, l).start).toEqual(attached(grown.ids).geometry.start)
    expect(startOf(back, slide, l)).toEqual(seen)
  })
})

describe("undoing a change to one end of a line", () => {
  it("puts back that end when someone else has since changed the other end", () => {
    const grown = deck()
    const l = grown.ids.l!
    const freed = step(grown.doom, "free", [
      ...detach([grown.ids.t!]),
      lineWrite(grown.doom, l, { start: { x: 300, y: 225 } }),
    ])
    const moved = step(freed.after, "other", [lineWrite(freed.after, l, { end: { x: 40, y: 10 } })]).after
    const undone = step(moved, "undo", invert(freed.before, moved, freed.edit)).after
    expect(lineOf(undone, l)).toEqual({ ...attached(grown.ids).geometry, end: { x: 40, y: 10 } })
  })

  it("puts back that end when an agent's run is undone after someone else changed the other end", () => {
    const grown = deck()
    const l = grown.ids.l!
    const run = step(grown.doom, "run", [
      ...detach([grown.ids.t!]),
      lineWrite(grown.doom, l, { start: { x: 300, y: 225 } }),
    ])
    const moved = step(run.after, "other", [lineWrite(run.after, l, { end: { x: 40, y: 10 } })]).after
    const undone = invertRun(moved, [{ ...run.edit, replaced: replacedBy(run.before, run.edit) }])
    const back = step(moved, "undo", undone.writes).after
    expect(lineOf(back, l)).toEqual({ ...attached(grown.ids).geometry, end: { x: 40, y: 10 } })
  })

  it("leaves an end someone else changed since", () => {
    const grown = deck()
    const l = grown.ids.l!
    const mine = step(grown.doom, "mine", [lineWrite(grown.doom, l, { start: { x: 1, y: 1 } })])
    const theirs = step(mine.after, "theirs", [lineWrite(mine.after, l, { start: { x: 2, y: 2 } })]).after
    expect(invert(mine.before, theirs, mine.edit)).toEqual([])
  })
})

describe("an end whose shape left the deck without the change freeing it", () => {
  it("paints at the shape's last place, never at the corner of the line's frame", () => {
    const grown = deck()
    const slide = grown.slides[0]!
    const seen = startOf(grown.doom, slide, grown.ids.l!)
    const gone = step(grown.doom, "gone", detach([grown.ids.t!])).after
    expect(startOf(gone, slide, grown.ids.l!)).toEqual(seen)
  })
})
