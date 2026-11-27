import fc from "fast-check"
import * as doom from "@airdesign/doom"
import { expect, it } from "vitest"
import { wrapWrites, ungroupWrites } from "./group-writes"
import { moveWrites } from "./move-writes"
import { geometryOf, type Point, type SlideGeometry } from "@/editing/slide-geometry"
import { grow, landed, paint, spot } from "./testing/doom-fixtures"

type Op =
  | { readonly kind: "wrap"; readonly as: "group" | "frame"; readonly pick: readonly number[] }
  | { readonly kind: "ungroup"; readonly pick: number }
  | { readonly kind: "move"; readonly pick: number; readonly by: Point }
  | { readonly kind: "undo" }
  | { readonly kind: "redo" }

type Shown = ReadonlyMap<doom.NodeId, readonly Point[]>
type Step = { readonly before: doom.Doom; readonly writes: readonly doom.Write[]; readonly shown: Shown }
type Live = ReadonlySet<doom.NodeId>

const tolerance = 1.5
const leaves = ["a", "b", "c", "d"] as const

const ops: fc.Arbitrary<Op> = fc.oneof(
  fc.record({
    kind: fc.constant("wrap" as const),
    as: fc.constantFrom("group" as const, "frame" as const),
    pick: fc.uniqueArray(fc.nat(9), { minLength: 1, maxLength: 3 }),
  }),
  fc.record({ kind: fc.constant("ungroup" as const), pick: fc.nat(9) }),
  fc.record({
    kind: fc.constant("move" as const),
    pick: fc.nat(9),
    by: fc.record({ x: fc.integer({ min: -80, max: 80 }), y: fc.integer({ min: -80, max: 80 }) }),
  }),
  fc.constant({ kind: "undo" as const }),
  fc.constant({ kind: "redo" as const }),
)

const turns = fc.array(fc.constantFrom(0, 30, 90, 135), { minLength: 4, maxLength: 4 })

function opened(rotations: readonly number[]) {
  return grow(
    leaves.map((name, index) => ({
      type: "shape" as const,
      name,
      props: { box: spot(100 + index * 220, 120 + (index % 2) * 160, 160, 90, rotations[index] ?? 0), fills: paint },
    })),
  )
}

function minter() {
  let next = 0
  return () => doom.nodeId(`m:${String((next += 1))}`)
}

const geometryIn = (view: doom.Doom, slide: doom.NodeId): SlideGeometry =>
  geometryOf(doom.resolveSlide(view, slide, doom.measureWith({})))

function shownOf(geometry: SlideGeometry, ids: readonly doom.NodeId[]): Shown {
  return new Map(ids.map((id) => [id, geometry.byId.get(id)?.corners ?? []]))
}

function liveOn(view: doom.Doom, slide: doom.NodeId): Live {
  const found = new Set<doom.NodeId>()
  const visit = (parent: doom.NodeId) => {
    for (const child of view.children.get(parent) ?? []) {
      found.add(child)
      visit(child)
    }
  }
  visit(slide)
  return found
}

function descendants(view: doom.Doom, id: doom.NodeId): readonly doom.NodeId[] {
  return [id, ...(view.children.get(id) ?? []).flatMap((child) => descendants(view, child))]
}

const framesIn = (view: doom.Doom, slide: doom.NodeId) =>
  [...liveOn(view, slide)].filter((id) => view.nodes.get(id)?.type === "frame")

const shifted = (corners: readonly Point[], by: Point) =>
  corners.map((point) => ({ x: point.x + by.x, y: point.y + by.y }))

function apart(expected: Shown, found: Shown): readonly string[] {
  const off: string[] = []
  for (const [id, corners] of expected) {
    const now = found.get(id) ?? []
    const far = corners.some(
      (point, index) =>
        Math.abs(point.x - (now[index]?.x ?? Infinity)) > tolerance ||
        Math.abs(point.y - (now[index]?.y ?? Infinity)) > tolerance,
    )
    if (far) off.push(`${id} shows at ${JSON.stringify(now)}, expected ${JSON.stringify(corners)}`)
  }
  return off
}

function sameNodes(left: Live, right: Live): boolean {
  return left.size === right.size && [...left].every((id) => right.has(id))
}

it("keeps every layer where it showed through wrap, ungroup and their undo and redo, and moves it only with its group", () => {
  fc.assert(
    fc.property(turns, fc.array(ops, { minLength: 1, maxLength: 8 }), (rotations, sequence) => {
      const built = opened(rotations)
      const slide = built.slides[0]!
      const shapes = leaves.map((name) => built.ids[name]!)
      const mint = minter()
      let view = built.view
      let expected = shownOf(built.geometry, shapes)
      const undo: Step[] = []
      const redo: Step[] = []
      const turned = new Set<doom.Rev>()
      const land = (writes: readonly doom.Write[], next: Shown, stack: Step[]) => {
        stack.push({ before: view, writes, shown: expected })
        view = landed(view, writes)
        expected = next
      }
      for (const op of sequence) {
        const geometry = geometryIn(view, slide)
        const live = [...liveOn(view, slide)]
        if (op.kind === "wrap") {
          const top = view.children.get(slide) ?? []
          const ids = [...new Set(op.pick.map((index) => top[index % top.length]!))]
          const made = wrapWrites(view, geometry, ids, op.as, mint)
          if (made === null) continue
          redo.length = 0
          land(made.writes, expected, undo)
        } else if (op.kind === "ungroup") {
          const frames = framesIn(view, slide)
          if (frames.length === 0) continue
          const made = ungroupWrites(view, geometry, [frames[op.pick % frames.length]!])
          if (made === null) continue
          redo.length = 0
          land(made.writes, expected, undo)
        } else if (op.kind === "move") {
          const id = live[op.pick % live.length]!
          const writes = moveWrites(view, geometry, [id], op.by)
          if (writes.length === 0) continue
          const moved = new Set(descendants(view, id))
          const next = new Map(
            [...expected].map(([shape, corners]) => [shape, moved.has(shape) ? shifted(corners, op.by) : corners]),
          )
          redo.length = 0
          land(writes, next, undo)
        } else {
          const [from, to] = op.kind === "undo" ? [undo, redo] : [redo, undo]
          const last = from.pop()
          if (last === undefined) continue
          const edit = { once: `step-${String(last.before.rev)}`, author: { kind: "person" as const, id: "test" } }
          const writes = doom.invert(
            last.before,
            view,
            { ...edit, writes: last.writes, rev: doom.rev(last.before.rev + 1) },
            turned,
          )
          expect(writes.length, `${op.kind} put nothing back`).toBeGreaterThan(0)
          land(writes, last.shown, to)
          turned.add(view.rev)
          expect(sameNodes(liveOn(view, slide), liveOn(last.before, slide)), `${op.kind} left other layers`).toBe(true)
        }
        expect(apart(expected, shownOf(geometryIn(view, slide), shapes)), JSON.stringify(op)).toEqual([])
      }
    }),
    { numRuns: 200 },
  )
})

it("takes back a group an agent's run made and leaves its layers where they showed, as the undo of the run", () => {
  const built = opened([0, 30, 0, 90])
  const slide = built.slides[0]!
  const shapes = leaves.map((name) => built.ids[name]!)
  const agent: doom.Author = { kind: "agent", id: "aira", run: "r" }
  const edit = (view: doom.Doom, writes: readonly doom.Write[], phase?: "start" | "stop"): doom.Landed => ({
    once: `run-${String(view.rev)}`,
    author: agent,
    writes,
    ...(phase === undefined ? {} : { phase }),
    rev: doom.rev(view.rev + 1),
  })
  const run: doom.Landed[] = []
  const land = (view: doom.Doom, landed: doom.Landed) => {
    const next = doom.applyEdit(view, landed)
    if (doom.isRefusal(next)) throw new Error(`refused ${JSON.stringify(next)}`)
    run.push(landed)
    return next
  }
  const started = built.view
  let view = land(started, edit(started, [], "start"))
  const made = wrapWrites(view, geometryIn(view, slide), [shapes[1]!, shapes[3]!], "group", minter())!
  view = land(view, edit(view, made.writes))
  view = land(view, edit(view, [], "stop"))
  const shown = shownOf(geometryIn(view, slide), shapes)
  const last = run.at(-1)!
  const writes = doom.invert(
    started,
    view,
    {
      once: last.once,
      author: { kind: "person", id: "quan" },
      writes: run.flatMap((each) => each.writes),
      rev: last.rev,
    },
    new Set(run.map((each) => each.rev)),
  )
  const undone = landed(view, writes)
  expect(framesIn(undone, slide)).toEqual([])
  expect(apart(shown, shownOf(geometryIn(undone, slide), shapes))).toEqual([])
})
