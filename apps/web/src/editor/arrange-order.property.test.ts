import fc from "fast-check"
import * as doom from "@airdesign/doom"
import { expect, it } from "vitest"
import { orderWrites, type Reorder } from "./order-writes"
import { grow, landed, paint, spot } from "./testing/doom-fixtures"

type Op =
  | { readonly kind: "press"; readonly how: Reorder; readonly pick: readonly number[] }
  | { readonly kind: "agent"; readonly pick: number; readonly after: number | null | undefined }
  | { readonly kind: "undo" }
  | {
      readonly kind: "offline"
      readonly how: Reorder
      readonly pick: number
      readonly agent: number
      readonly after: number | null | undefined
    }

const ops: fc.Arbitrary<Op> = fc.oneof(
  fc.record({
    kind: fc.constant("press" as const),
    how: fc.constantFrom<Reorder>("front", "back", "forward", "backward"),
    pick: fc.uniqueArray(fc.nat(9), { minLength: 1, maxLength: 3 }),
  }),
  fc.record({
    kind: fc.constant("agent" as const),
    pick: fc.nat(9),
    after: fc.option(fc.option(fc.nat(9), { nil: null }), { nil: undefined }),
  }),
  fc.constant({ kind: "undo" as const }),
  {
    weight: 3,
    arbitrary: fc.record({
      kind: fc.constant("offline" as const),
      how: fc.constantFrom<Reorder>("front", "back", "forward", "backward"),
      pick: fc.nat(9),
      agent: fc.nat(9),
      after: fc.option(fc.option(fc.nat(9), { nil: null }), { nil: undefined }),
    }),
  },
)

const content = ["a", "b", "c", "d"].map((name, index) => ({
  type: "shape" as const,
  name,
  props: { box: spot(100 + index * 200, 200, 150, 100), fills: paint },
}))

it("moves one neighbour on a bracket key and brings the chosen layers to the front, never throwing, whatever a person offline, an agent and undo do to the order", () => {
  fc.assert(
    fc.property(fc.array(ops, { minLength: 1, maxLength: 12 }), (sequence) => {
      const built = grow(content)
      const slide = built.slides[0]!
      let view = built.view
      let made = 0
      const mint = () => doom.nodeId(`g:${String((made += 1))}`)
      const steps: { readonly before: doom.Doom; readonly edit: doom.Landed; readonly after: doom.Doom }[] = []
      const land = (writes: readonly doom.Write[]) => {
        if (writes.length === 0) return
        const before = view
        view = landed(view, writes)
        const edit = { once: `step-${String(view.rev)}`, author: { kind: "person", id: "test" }, writes, rev: view.rev }
        steps.push({ before, edit: edit as doom.Landed, after: view })
      }
      const agentMove = (on: doom.Doom, pick: number, rawAfter: number | null | undefined) => {
        const painted = on.children.get(slide) ?? []
        const node = painted[pick % painted.length]!
        const after = rawAfter == null ? rawAfter : painted[rawAfter % painted.length]!
        if (after === node) return []
        const writes = doom.compileAgentChange(
          on,
          { op: "move", node, ...(after === undefined ? {} : { after }) },
          mint,
          {},
        )
        return "refused" in writes ? [] : writes
      }
      for (const op of sequence) {
        const painted = view.children.get(slide) ?? []
        if (op.kind === "press") {
          const ids = [...new Set(op.pick.map((index) => painted[index % painted.length]!))]
          const content = painted
          land(orderWrites(view, ids, op.how))
          const moved = view.children.get(slide) ?? []
          const [only] = ids
          if (ids.length === 1 && op.how === "forward" && content.includes(only!)) {
            const was = content.indexOf(only!)
            expect(moved.indexOf(only!)).toBe(Math.min(was + 1, content.length - 1))
          }
          if (op.how === "front")
            expect(moved.slice(moved.length - content.filter((id) => ids.includes(id)).length)).toEqual(
              content.filter((id) => ids.includes(id)),
            )
        } else if (op.kind === "agent") {
          land(agentMove(view, op.pick, op.after))
        } else if (op.kind === "offline") {
          const pressed = orderWrites(view, [painted[op.pick % painted.length]!], op.how)
          land(agentMove(view, op.agent, op.after))
          land(pressed)
        } else {
          const last = steps.pop()
          if (last === undefined) continue
          view = landed(view, doom.invert(last.before, last.after, last.edit))
        }
      }
    }),
    { numRuns: 1000 },
  )
})
