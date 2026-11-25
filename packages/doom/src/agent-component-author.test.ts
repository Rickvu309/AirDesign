import { expect, it } from "vitest"

import { compileAgentEdit } from "./agent-edit.js"
import { readAgentChange } from "./agent-change.js"
import { firstSlide, minter } from "./agent-fixtures.js"
import { applyEdit } from "./apply-edit.js"
import { deckComponent } from "./component/deck-component.js"
import progress from "./component/testing/progress-bars.json" with { type: "json" }
import { propOf } from "./doom-walk.js"
import type { Doom } from "./doom.js"
import { doomFromTree } from "./doom-tree.js"
import { type NodeId, rev } from "./ids.js"
import { invert } from "./invert.js"
import { isRefusal } from "./refusal.js"
import { defaultTheme } from "./theme.js"

type Spec = typeof progress & Record<string, unknown>

function attempt(fold: Doom, edits: readonly unknown[], once: string) {
  const changes = edits.map((raw) => {
    const change = readAgentChange(raw)
    if (isRefusal(change)) throw new Error(JSON.stringify(change))
    return change
  })
  return compileAgentEdit(fold, changes, {
    author: { kind: "agent", id: "agent", run: "run" },
    once,
    mint: minter(once),
    ...(once === "make" ? { phase: "start" as const } : {}),
  })
}

function land(fold: Doom, edits: readonly unknown[], once: string) {
  const compiled = attempt(fold, edits, once)
  if (isRefusal(compiled)) throw new Error(JSON.stringify(compiled))
  return compiled
}

function changed(change: (spec: Spec) => void): Spec {
  const spec = JSON.parse(JSON.stringify(progress)) as Spec
  change(spec)
  return spec
}

const box = (y: number) => ({ x: 200, y, w: 1200, h: 360 })

function placedTwice() {
  const { doom } = doomFromTree({ theme: defaultTheme, slides: [{ children: [] }] })
  const slide = firstSlide(doom)
  const made = land(doom, [{ op: "component", spec: progress }], "make")
  const component = made.added.find(({ kind }) => kind === "template")?.id
  if (component === undefined) throw new Error("No template was added")
  const placing = [box(80), box(560)].map((at) => ({ op: "add", kind: "component", slide, component, box: at }))
  const placed = land(made.after, placing, "place")
  const frames = placed.added.filter(({ kind }) => kind === "component").map(({ id }) => id)
  return { fold: placed.after, component, frames }
}

const linked = (fold: Doom, frame: NodeId) => propOf(fold.nodes.get(frame), "instance")

function trackX(fold: Doom, frame: NodeId) {
  const part = linked(fold, frame)?.parts.find(({ key }) => key[0] === "track")
  return part === undefined ? undefined : propOf(fold.nodes.get(part.node), "box")?.x
}

it("adds a template that an agent places by id", () => {
  const { fold, component, frames } = placedTwice()
  expect(deckComponent(fold, component)).toMatchObject({ revision: 1, spec: { name: "Progress bars" } })
  expect(frames).toHaveLength(2)
  for (const frame of frames) expect(linked(fold, frame)?.component).toEqual({ node: component, revision: 1 })
})

it("rebuilds every instance in the update's own guarded edit, and undo brings the old spec back at a new revision", () => {
  const { fold, component, frames } = placedTwice()
  const spec = changed((spec) => {
    spec.let[1] = ["barX", 420]
  })
  const updated = land(fold, [{ op: "component", target: component, spec }], "update")
  expect(updated.edit.readBase).toBe(fold.rev)
  for (const frame of frames) {
    expect(linked(updated.after, frame)?.component).toEqual({ node: component, revision: 2 })
    expect(trackX(updated.after, frame)).toBe(420)
  }
  const landed = { ...updated.edit, rev: rev(fold.rev + 1) }
  const undo = invert(fold, updated.after, landed)
  const undone = applyEdit(updated.after, {
    once: "undo",
    author: { kind: "agent", id: "agent", run: "run" },
    rev: rev(updated.after.rev + 1),
    readBase: updated.after.rev,
    writes: undo,
  })
  if (isRefusal(undone)) throw new Error(JSON.stringify(undone))
  expect(deckComponent(undone, component)).toEqual({ ...deckComponent(fold, component), revision: 3 })
  for (const frame of frames) expect(trackX(undone, frame)).toBe(trackX(fold, frame))
})

it("applies set data in the same edit before it rebuilds the instances, and names the layer when data is missing", () => {
  const { fold, component, frames } = placedTwice()
  const spec = changed((spec) => {
    Object.assign(spec.collections.rows, { owner: "string" })
    for (const row of spec.sample.data.rows) Object.assign(row, { owner: "Ana" })
  })
  const update = { op: "component", target: component, spec }
  expect(attempt(fold, [update], "alone")).toMatchObject({
    refused: "shape",
    change: `component ${component}`,
    at: 0,
    node: frames[0],
    prop: "instance",
    field: "data.rows[0].owner",
  })
  const data = { rows: [{ id: "a", label: "Plan", share: 0.3, owner: "Bo" }] }
  const sets = frames.map((target) => ({ op: "set", target, data }))
  const landed = land(fold, [update, ...sets], "with-data")
  for (const frame of frames)
    expect(linked(landed.after, frame)).toMatchObject({ component: { node: component, revision: 2 }, data })
})

it("refuses a spec fault at its path inside the change", () => {
  const { fold } = placedTwice()
  const spec = changed((spec) => {
    Object.assign(spec.parts[1]!.emit, { colour: "red" })
  })
  expect(attempt(fold, [{ op: "component", spec }], "bad")).toMatchObject({
    refused: "shape",
    change: "component",
    at: 0,
    field: "spec.parts[1].emit.colour",
    fault: "unknown",
  })
})
