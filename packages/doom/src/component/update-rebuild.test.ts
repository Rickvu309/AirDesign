import { expect, it } from "vitest"
import { applyEdit, type Write } from "../index.js"
import { invertStep } from "../invert.js"
import { invertRun, undoSourceOf } from "../invert-run.js"
import { onDeck, propOf } from "../doom-walk.js"
import { frame, instance, measure, mint } from "./testing/linked-instance-fixtures.js"
import { prepareComponentEdit } from "./component-edit.js"
import {
  accepted,
  create,
  first,
  onSlideTwo,
  placedBy,
  requiringRows,
  spec,
  step,
  tileWidth,
  undone,
  updated,
  updating,
} from "./testing/deck-component-fixtures.js"

it("undoes and redoes a template update as a fresh update after another writer placed an instance of it", () => {
  const { linked, node, slide } = onSlideTwo()
  const changing = updating(linked, node, 200, 2)
  const changed = accepted(applyEdit(linked, changing))
  const { other, now } = placedBy(changed, node, slide, 2)

  const undoing = step(now, accepted(invertStep(linked, now, changing, new Set(), measure)))
  const reverted = accepted(applyEdit(now, undoing))
  expect(propOf(reverted.nodes.get(node), "spec")).toEqual(spec(100))
  expect(propOf(reverted.nodes.get(node), "revision")).toBe(3)
  for (const root of [frame, other]) {
    expect(propOf(reverted.nodes.get(root), "instance")?.component).toEqual({ node, revision: 3 })
    expect(tileWidth(reverted, root)).toBe(100)
  }

  const run = invertRun(now, [undoSourceOf(linked, changing)], new Set(), linked, measure)
  expect(run).toMatchObject({ kept: [], left: [], waiting: [] })
  expect(run.refused).toBeUndefined()
  expect(accepted(applyEdit(now, step(now, run.writes))).nodes).toEqual(reverted.nodes)

  const redone = accepted(
    applyEdit(reverted, step(reverted, accepted(invertStep(now, reverted, undoing, new Set(), measure)))),
  )
  expect(propOf(redone.nodes.get(node), "spec")).toEqual(spec(200))
  expect(propOf(redone.nodes.get(node), "revision")).toBe(4)
  for (const root of [frame, other]) {
    expect(propOf(redone.nodes.get(root), "instance")?.component).toEqual({ node, revision: 4 })
    expect(tileWidth(redone, root)).toBe(200)
  }
})

it("accepts only the next revision, so the largest legal revision stays out of reach", () => {
  const { linked, node } = onSlideTwo()
  const base = (prop: "spec" | "revision") => linked.revs.get(node)!.get(prop)!
  for (const revision of [Number.MAX_SAFE_INTEGER, 3]) {
    const writes: Write[] = [
      { node, prop: "spec", value: spec(200), base: base("spec") },
      { node, prop: "revision", value: revision, base: base("revision") },
    ]
    expect(prepareComponentEdit(linked, writes, measure)).toMatchObject({ refused: "shape", node, prop: "revision" })
    expect(applyEdit(linked, step(linked, writes))).toMatchObject({ refused: "shape", node, prop: "revision" })
  }
  const deck = [...linked.nodes.values()].find(({ type }) => type === "deck")!.id
  const skipped = mint()
  const created = create(deck, skipped, spec(100)).map((write) =>
    write.prop === "revision" ? { ...write, value: Number.MAX_SAFE_INTEGER } : write,
  )
  expect(applyEdit(linked, step(linked, created))).toMatchObject({ refused: "shape", node: skipped, prop: "revision" })
  expect(propOf(updated(linked, node, 200, 2).nodes.get(node), "revision")).toBe(2)
})

it("waits for a deleted template to come back before undoing an update to it, then rebuilds every instance", () => {
  const { linked, node } = onSlideTwo()
  const changing = updating(linked, node, 200, 2)
  const changed = accepted(applyEdit(linked, changing))
  const deleting = step(changed, [{ node, prop: "parent", value: null }])
  const deleted = accepted(applyEdit(changed, deleting))
  expect(deleted.nodes.get(frame)).not.toHaveProperty("instance")
  expect(invertStep(linked, deleted, changing, new Set(), measure)).toMatchObject({ refused: "stale" })
  expect(invertRun(deleted, [undoSourceOf(linked, changing)], new Set(), linked, measure).writes).toEqual([])

  const back = undone(changed, deleting, deleted)
  expect(instance(back).component).toEqual({ node, revision: 2 })
  const reverted = undone(linked, changing, back)
  expect(propOf(reverted.nodes.get(node), "spec")).toEqual(spec(100))
  expect(instance(reverted).component).toEqual({ node, revision: 3 })
  expect(tileWidth(reverted, frame)).toBe(100)
})

it("undoes a template update that an instance placed since cannot follow by detaching only that instance", () => {
  const { linked, node, slide } = onSlideTwo()
  const deleting = step(linked, [{ node: slide, prop: "parent", value: null }])
  const gone = accepted(applyEdit(linked, deleting))
  const changing = step(gone, [
    { node, prop: "spec", value: requiringRows, base: gone.revs.get(node)!.get("spec")! },
    { node, prop: "revision", value: 2, base: gone.revs.get(node)!.get("revision")! },
  ])
  const changed = accepted(applyEdit(gone, changing))
  const { other, now } = placedBy(changed, node, first(changed), 2, { rows: [{ id: "a", note: "later" }] })
  const kept = now.nodes.get(propOf(now.nodes.get(other), "instance")!.parts[0]!.node)

  const reverted = undone(gone, changing, now)
  expect(propOf(reverted.nodes.get(node), "revision")).toBe(3)
  expect(reverted.nodes.get(other)).not.toHaveProperty("instance")
  expect(reverted.nodes.get(kept!.id)).toEqual(kept)
  const run = invertRun(now, [undoSourceOf(gone, changing)], new Set(), gone, measure)
  expect(accepted(applyEdit(now, step(now, run.writes))).nodes).toEqual(reverted.nodes)

  const back = undone(linked, deleting, reverted)
  expect(onDeck(back.nodes, frame)).toBe(true)
  expect(instance(back).component).toEqual({ node, revision: 3 })
  expect(tileWidth(back, frame)).toBe(100)
})
