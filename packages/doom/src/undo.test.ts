import { describe, expect, it } from "vitest"
import { applyEdit } from "./apply-edit.js"
import type { Author, Doom, Landed, Write } from "./doom.js"
import { nodeId, rev } from "./ids.js"
import { replacedBy } from "./invert-run.js"
import { isRefusal } from "./refusal.js"
import { box, create, ids, person, sampleDeck } from "./sample-deck.js"
import { measure } from "./testing/doom-fixtures-art.js"
import { undo } from "./undo.js"

const other: Author = { kind: "person", id: "other" }
const by = { author: person, once: "undo", measure, owned: new Set<never>() }

function step(fold: Doom, writes: readonly Write[], author: Author = person) {
  const phase = author.run === undefined ? {} : { phase: "start" as const }
  const edit: Landed = { once: `o-${String(fold.rev)}`, author, writes, ...phase, rev: rev(fold.rev + 1) }
  const after = applyEdit(fold, edit)
  if (isRefusal(after)) throw new Error(JSON.stringify(after))
  return { before: fold, edit, after }
}

describe("undo", () => {
  it("lands nothing and keeps the fold when another writer changed every property the step wrote", () => {
    const nudged = step(sampleDeck(), [{ node: ids.card, prop: "box", value: box(300) }])
    const theirs = step(nudged.after, [{ node: ids.card, prop: "box", value: box(500) }], other)
    const undone = undo(theirs.after, { step: nudged.edit, before: nudged.before }, by)
    if (isRefusal(undone)) throw new Error(JSON.stringify(undone))
    expect(undone.edit.writes).toEqual([])
    expect(undone.after).toBe(theirs.after)
  })

  it("refuses what the deck would refuse: taking back a slide another writer left as the last one", () => {
    const added = nodeId("t:9")
    const two = step(sampleDeck(), create(added, "slide", ids.row))
    const theirs = step(two.after, [{ node: ids.slide, prop: "parent", value: null }], other)
    expect(undo(theirs.after, { step: two.edit, before: two.before }, by)).toMatchObject({ refused: "last-slide" })
  })

  it("names the frame a run made and a person filled since, and keeps it", () => {
    const frame = nodeId("t:9")
    const runner: Author = { kind: "agent", id: "aira", run: "a" }
    const made = step(sampleDeck(), create(frame, "frame", ids.slide), runner)
    const filled = step(made.after, [{ node: ids.caption, prop: "parent", value: { id: frame, at: "a0" } }])
    const run = [{ ...made.edit, replaced: replacedBy(made.before, made.edit) }]
    const undone = undo(filled.after, { run }, { ...by, runUndo: { run: "a", undone: true } })
    if (isRefusal(undone)) throw new Error(JSON.stringify(undone))
    expect(undone.kept).toEqual([frame])
    expect(undone.edit.writes).toEqual([])
    expect(undone.after).toBe(filled.after)
  })
})
