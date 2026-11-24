import { describe, expect, it } from "vitest"
import { applyMatrix, invert, nodeId, type Box, type Doom, type NodeId } from "./index.js"
import { worldMatrix } from "./replant.js"
import { box, create, ids, land, place, revOf, sampleDeck, tryLand } from "./sample-deck.js"
import { step } from "./testing/invert-edit.js"

function seenAt(doom: Doom, node: NodeId) {
  const matrix = worldMatrix(doom, node)
  const here = (doom.nodes.get(node) as { box: Box }).box
  const centre = applyMatrix(matrix, { x: here.w / 2, y: here.h / 2 })
  return { ...centre, rotation: Math.atan2(matrix[1], matrix[0]) * (180 / Math.PI) }
}

describe("invert, for a layer whose parent goes back and whose box someone wrote since", () => {
  it("writes the box the layer has now in the frame it goes back to, so an undo that writes the parent but not the box leaves it where it is seen", () => {
    const { before, after, edit } = step(sampleDeck(), [
      { node: ids.title, prop: "parent", value: place(ids.side) },
      { node: ids.title, prop: "box", value: box(30, 40) },
    ])
    const theirs = step(after, [{ node: ids.title, prop: "box", value: box(50, 40) }])
    const writes = invert(before, theirs.after, edit)
    expect(writes).toEqual([
      { node: ids.title, prop: "parent", value: place(ids.card), base: edit.rev },
      { node: ids.title, prop: "box", value: box(350, 40), base: revOf(theirs.after, ids.title, "box") },
    ])
    const undone = tryLand(theirs.after, writes) as Doom
    expect(undone.nodes.get(ids.title)).toMatchObject({ parent: place(ids.card), box: box(350, 40) })
    expect(seenAt(undone, ids.title)).toEqual(seenAt(theirs.after, ids.title))
  })

  it("keeps the rotation, the size and the flips of the layer it writes the box of, and turns the place by the frames it crosses", () => {
    const turned = land(sampleDeck(), [
      { node: ids.card, prop: "box", value: { ...box(100, 20, 300, 200), rotation: 90 } },
      { node: ids.side, prop: "box", value: { ...box(700, 60, 300, 200), rotation: 30 } },
    ])
    const { before, after, edit } = step(turned, [
      { node: ids.title, prop: "parent", value: place(ids.side) },
      { node: ids.title, prop: "box", value: { ...box(30, 40, 80, 50), rotation: 15, flipH: true } },
    ])
    const theirs = step(after, [
      { node: ids.title, prop: "box", value: { ...box(50, 40, 80, 50), rotation: 15, flipH: true } },
    ])
    const undone = tryLand(theirs.after, invert(before, theirs.after, edit)) as Doom
    const now = undone.nodes.get(ids.title) as { parent: unknown; box: { w: number; h: number; flipH: boolean } }
    expect(now).toMatchObject({ parent: place(ids.card), box: { w: 80, h: 50, flipH: true } })
    const [seen, was] = [seenAt(undone, ids.title), seenAt(theirs.after, ids.title)]
    expect(Math.abs(seen.x - was.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(seen.y - was.y)).toBeLessThanOrEqual(1)
    expect(Math.abs(seen.rotation - was.rotation)).toBeLessThanOrEqual(0.2)
  })

  it("moves the ends of a line it writes the geometry of by the same frames", () => {
    const line = nodeId("t:11")
    const lineOf = { kind: "line", route: "straight", arrows: ["none", "none"] } as const
    const start = land(sampleDeck(), [
      ...create(line, "shape", ids.card),
      { node: line, prop: "geometry", value: { ...lineOf, start: { x: 10, y: 10 }, end: { x: 60, y: 10 } } },
    ])
    const { before, after, edit } = step(start, [
      { node: line, prop: "parent", value: place(ids.side) },
      { node: line, prop: "geometry", value: { ...lineOf, start: { x: -290, y: 10 }, end: { x: -240, y: 10 } } },
    ])
    const theirs = step(after, [
      { node: line, prop: "geometry", value: { ...lineOf, start: { x: -280, y: 10 }, end: { x: -230, y: 10 } } },
    ])
    const undone = tryLand(theirs.after, invert(before, theirs.after, edit)) as Doom
    expect(undone.nodes.get(line)).toMatchObject({
      parent: place(ids.card),
      geometry: { start: { x: 20, y: 10 }, end: { x: 70, y: 10 } },
    })
  })
})
