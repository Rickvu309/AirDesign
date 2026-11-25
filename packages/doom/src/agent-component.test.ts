import { describe, expect, it } from "vitest"

import { compileAgentEdit, readingOf } from "./agent-edit.js"
import { readAgentChange } from "./agent-change.js"
import { firstSlide, minter } from "./agent-fixtures.js"
import { readForAgent } from "./agent-read.js"
import { propOf } from "./doom-walk.js"
import { isRefusal } from "./refusal.js"
import { applyEdit } from "./apply-edit.js"
import { rev } from "./ids.js"
import { sampleDeck } from "./sample-deck.js"

function compile(fold: ReturnType<typeof sampleDeck>, raw: unknown, once: string) {
  const change = readAgentChange(raw, true)
  if (isRefusal(change)) throw new Error(JSON.stringify(change))
  const result = compileAgentEdit(fold, [change], {
    author: { kind: "agent", id: "agent", run: once },
    phase: "start",
    once,
    mint: minter(once),
  })
  if (isRefusal(result)) throw new Error(JSON.stringify(result))
  return result
}

describe("linked components in agent edits", () => {
  it("places the named sample, regenerates it in one guarded edit, and detaches without losing its layers", () => {
    const before = sampleDeck()
    const slide = firstSlide(before)
    const placed = compile(before, { op: "add", kind: "component", component: "column", slide }, "place")
    const instance = placed.added.find(({ kind }) => kind === "component")?.id
    if (instance === undefined) throw new Error("No component was added")
    expect(placed.edit.readBase).toBe(before.rev)
    expect(readForAgent(placed.after, [slide])).toContain(`${instance} component column r1`)

    const data = { rows: [{ id: "q1", label: "New Q1", value: 100 }] }
    const variant = { labels: false }
    const tokens = { digits: 1 }
    const updated = compile(placed.after, { op: "set", target: instance, data, variant, tokens }, "update")
    expect(updated.edit.readBase).toBe(placed.after.rev)
    const linked = propOf(updated.after.nodes.get(instance), "instance")
    expect(linked).toMatchObject({ data, variant, tokens })

    const detached = compile(updated.after, { op: "detach", target: instance }, "detach")
    expect(detached.edit.readBase).toBe(updated.after.rev)
    expect(propOf(detached.after.nodes.get(instance), "instance")).toBeUndefined()
    expect(detached.after.nodes.size).toBe(updated.after.nodes.size)
  })

  it("refuses stale preparations and protects a label changed by a person in the same run", () => {
    const before = sampleDeck()
    const placed = compile(
      before,
      {
        op: "add",
        kind: "component",
        component: "column",
        slide: firstSlide(before),
      },
      "place",
    )
    const root = placed.added.find(({ kind }) => kind === "component")?.id
    if (root === undefined) throw new Error("No component was added")
    const instance = propOf(placed.after.nodes.get(root), "instance")
    const label = instance?.parts.find(({ key }) => key.includes("q1") && key[0] === "category")?.node
    if (label === undefined) throw new Error("No generated category label")
    const person = applyEdit(placed.after, {
      once: "name",
      rev: rev(placed.after.rev + 1),
      author: { kind: "person", id: "person" },
      writes: [{ node: label, prop: "name", value: "Person label" }],
    })
    if (isRefusal(person)) throw new Error(JSON.stringify(person))
    const change = readAgentChange(
      { op: "set", target: root, data: { rows: [{ id: "q1", label: "Different", value: 24 }] } },
      true,
    )
    if (isRefusal(change)) throw new Error(JSON.stringify(change))
    const by = { author: placed.edit.author, once: "attempt", mint: minter("attempt") }
    expect(compileAgentEdit(person, [change], by)).toMatchObject({ refused: "person", node: label })
    expect(
      compileAgentEdit(person, [{ op: "detach", target: root }], {
        ...by,
        read: readingOf(person, placed.after.rev),
      }),
    ).toMatchObject({ refused: "stale" })
    expect(propOf(person.nodes.get(label), "name")).toBe("Person label")
  })

  it("keeps component inputs out of the closed rollout's reader", () => {
    const slide = firstSlide(sampleDeck())
    expect(readAgentChange({ op: "add", kind: "component", slide }, false)).toMatchObject({ field: "kind" })
    expect(readAgentChange({ op: "set", target: slide, data: {} }, false)).toMatchObject({ field: "data" })
    expect(readAgentChange({ op: "detach", target: slide }, false)).toMatchObject({ field: "op" })
  })
})
