import { expect, it } from "vitest"
import progress from "./testing/progress-bars.json" with { type: "json" }
import {
  applyEdit,
  defaultTheme,
  doomFromTree,
  invert,
  isRefusal,
  rev,
  type Doom,
  type Landed,
  type NodeId,
  type Refusal,
  type Write,
} from "../index.js"
import { onDeck, propOf } from "../doom-walk.js"
import { bytesOf } from "../limits.js"
import { at, measure, mint, person } from "./testing/linked-instance-fixtures.js"
import { placeComponent } from "./join-instance.js"
import { deckComponent } from "./deck-component.js"
import { prepareComponentWrite } from "./component-write.js"

type Spec = typeof progress & Record<string, unknown>

function accepted<T>(value: T | Refusal): T {
  if (isRefusal(value)) throw new Error(JSON.stringify(value))
  return value
}

function step(base: Doom, writes: readonly Write[]): Landed {
  return { once: `step-${base.rev + 1}`, rev: rev(base.rev + 1), readBase: base.rev, author: person, writes }
}

function land(base: Doom, writes: readonly Write[]): { readonly after: Doom; readonly landed: Landed } {
  const landed = step(base, writes)
  return { after: accepted(applyEdit(base, landed)), landed }
}

const rows = (count: number) => ({
  rows: Array.from({ length: count }, (_, i) => ({ id: `r${i}`, label: `Row ${i}`, share: (i % 10) / 10 })),
})

function changed(change: (spec: Spec) => void): Spec {
  const spec = JSON.parse(JSON.stringify(progress)) as Spec
  change(spec)
  return spec
}

function deck(instances: number, data = rows(2)) {
  const { doom, slides } = doomFromTree({ theme: defaultTheme, slides: [{ children: [] }] })
  const made = accepted(prepareComponentWrite(doom, { spec: progress }, measure, mint))
  let fold = land(doom, made.writes).after
  const frames: NodeId[] = []
  for (let i = 0; i < instances; i++) {
    const frame = mint()
    const box = { x: 0, y: 0, w: 1200, h: 360, rotation: 0, flipH: false, flipV: false }
    const placing = placeComponent(
      fold,
      { node: made.component, revision: 1 },
      { frame, parent: { id: slides[0]!, at }, box, data, measure },
    )
    fold = land(fold, accepted(placing)).after
    frames.push(frame)
  }
  return { fold, component: made.component, frames }
}

const linked = (fold: Doom, frame: NodeId) => propOf(fold.nodes.get(frame), "instance")!

const partBox = (fold: Doom, frame: NodeId, role: string, row: string) => {
  const part = linked(fold, frame).parts.find(({ key }) => key[0] === role && key[1] === row)!
  return propOf(fold.nodes.get(part.node), "box")
}

it("adds a component from its spec as one edit that undo takes back", () => {
  const { doom } = doomFromTree({ theme: defaultTheme, slides: [{ children: [] }] })
  const made = accepted(prepareComponentWrite(doom, { spec: progress }, measure, mint))
  expect(made).toMatchObject({ revision: 1, rebuilt: [], findings: [] })
  const { after, landed } = land(doom, made.writes)
  expect(deckComponent(after, made.component)).toMatchObject({ revision: 1, spec: { name: "Progress bars" } })
  expect(propOf(after.nodes.get(made.component), "spec")).toEqual(progress)
  const undone = land(after, invert(doom, after, landed)).after
  expect(onDeck(undone.nodes, made.component)).toBe(false)
})

it("rebuilds every instance in the update's own edit, and one undo restores the spec and every layer at a new revision", () => {
  const { fold, component, frames } = deck(2)
  const spec = changed((spec) => {
    spec.let[1] = ["barX", 420]
  })
  const made = accepted(prepareComponentWrite(fold, { spec, target: component }, measure, mint))
  expect(made).toMatchObject({ component, revision: 2, rebuilt: frames })
  const { after, landed } = land(fold, made.writes)
  expect(deckComponent(after, component)?.revision).toBe(2)
  for (const frame of frames) {
    expect(linked(after, frame).component).toEqual({ node: component, revision: 2 })
    expect(partBox(after, frame, "track", "r0")?.x).toBe(420)
  }
  const undone = land(after, invert(fold, after, landed)).after
  expect(deckComponent(undone, component)).toEqual({ ...deckComponent(fold, component), revision: 3 })
  for (const frame of frames) {
    expect(linked(undone, frame)).toEqual({ ...linked(fold, frame), component: { node: component, revision: 3 } })
    expect(partBox(undone, frame, "track", "r0")).toEqual(partBox(fold, frame, "track", "r0"))
  }
})

it("keeps the current sample when an update leaves it out, and needs one on add", () => {
  const { fold, component } = deck(0)
  const { sample: _sample, ...bare } = progress
  const made = accepted(
    prepareComponentWrite(fold, { spec: { ...bare, name: "Bars" }, target: component }, measure, mint),
  )
  const after = land(fold, made.writes).after
  expect(propOf(after.nodes.get(component), "spec")).toEqual({ ...progress, name: "Bars" })
  expect(propOf(after.nodes.get(component), "name")).toBe("Bars")
  expect(prepareComponentWrite(fold, { spec: bare }, measure, mint)).toMatchObject({
    refused: "shape",
    field: "spec.sample",
    fault: "missing",
  })
})

it("refuses an update that leaves the spec unchanged, with or without its sample", () => {
  const { fold, component } = deck(1)
  const { sample: _sample, ...bare } = progress
  for (const spec of [progress, bare])
    expect(prepareComponentWrite(fold, { spec, target: component }, measure, mint)).toEqual({
      refused: "shape",
      node: component,
      prop: "spec",
      form: "The spec is unchanged.",
    })
})

it("refuses a built-in or unknown target without touching the deck", () => {
  const { fold } = deck(0)
  expect(prepareComponentWrite(fold, { spec: progress, target: "column" }, measure, mint)).toMatchObject({
    refused: "shape",
    field: "target",
    form: "column is built in and cannot be changed. Add a new component, starting from its spec.",
  })
  expect(prepareComponentWrite(fold, { spec: progress, target: "nope:1" }, measure, mint)).toMatchObject({
    refused: "missing",
    field: "target",
  })
})

it("refuses a spec over 32,000 bytes at the spec, with its size", () => {
  const { fold } = deck(0)
  const spec = changed((spec) => {
    spec.defaults = {
      ...spec.defaults,
      ...Object.fromEntries(Array.from({ length: 63 }, (_, i) => [`t${i}`, "y".repeat(500)])),
    }
  })
  const bytes = bytesOf(JSON.stringify(spec))
  expect(prepareComponentWrite(fold, { spec }, measure, mint)).toEqual({
    refused: "limit",
    field: "spec",
    form: `A spec holds at most 32000 bytes of JSON; this one has ${bytes}.`,
  })
})

it("joins a reader refusal to the spec path", () => {
  const { fold } = deck(0)
  const colour = changed((spec) => {
    Object.assign(spec.parts[1]!.emit, { colour: "red" })
  })
  expect(prepareComponentWrite(fold, { spec: colour }, measure, mint)).toMatchObject({
    refused: "shape",
    field: "spec.parts[1].emit.colour",
    fault: "unknown",
  })
  const greater = changed((spec) => {
    Object.assign(spec.parts[0]!, { when: ["gt", 1, 0] })
  })
  expect(prepareComponentWrite(fold, { spec: greater }, measure, mint)).toMatchObject({
    field: "spec.parts[0].when",
    form: 'Unknown operator "gt".',
  })
})

it("names a bad text style at its own field with the eight style names", () => {
  const { fold } = deck(0)
  const spec = changed((spec) => {
    spec.parts[0]!.emit.style = "big"
  })
  expect(prepareComponentWrite(fold, { spec }, measure, mint)).toMatchObject({
    field: "spec.parts[0].emit.style",
    form: "Expanding the sample: One of display, bigNumber, title, heading, body, body2, caption, label.",
  })
})

it("refuses a sample that does not expand at the expression's own path", () => {
  const { fold } = deck(0)
  const typo = changed((spec) => {
    spec.parts[1]!.emit.w = ["get", "r.shar"]
  })
  expect(prepareComponentWrite(fold, { spec: typo }, measure, mint)).toEqual({
    refused: "shape",
    field: "spec.parts[1].emit.w",
    form: 'Expanding the sample: Unknown value "r.shar".',
  })
  const duplicate = changed((spec) => {
    spec.parts[1]!.emit.key = ["list", "label", ["get", "r.id"]]
  })
  expect(prepareComponentWrite(fold, { spec: duplicate }, measure, mint)).toMatchObject({
    field: "spec.parts[1].emit.key",
    form: 'Expanding the sample: Duplicate emitted key ["label","a"].',
  })
})

it("asks for eq or lt when a condition is a number", () => {
  const { fold } = deck(0)
  const when = changed((spec) => {
    Object.assign(spec.parts[3]!, { when: ["get", "rowH"] })
  })
  expect(prepareComponentWrite(fold, { spec: when }, measure, mint)).toMatchObject({
    field: "spec.parts[3].when",
    form: "Expanding the sample: true or false. Compare with eq or lt.",
  })
  const branch = changed((spec) => {
    Object.assign(spec.parts[1]!.emit, { h: ["if", ["get", "rowH"], 16, 8] })
  })
  expect(prepareComponentWrite(fold, { spec: branch }, measure, mint)).toMatchObject({
    field: "spec.parts[1].emit.h[1]",
    form: "Expanding the sample: true or false. Compare with eq or lt.",
  })
})

it("names the missing or extra field of a sample row", () => {
  const { fold } = deck(0)
  const extra = changed((spec) => {
    Object.assign(spec.sample.data.rows[0]!, { owner: "Ana" })
  })
  expect(prepareComponentWrite(fold, { spec: extra }, measure, mint)).toMatchObject({
    field: "spec.sample.data.rows[0].owner",
    fault: "unknown",
    form: "One of id, label, share.",
  })
  const missing = changed((spec) => {
    Object.assign(spec.collections.rows, { owner: "string" })
  })
  expect(prepareComponentWrite(fold, { spec: missing }, measure, mint)).toMatchObject({
    field: "spec.sample.data.rows[0].owner",
    fault: "missing",
    form: "A string.",
  })
})

it("names the layer and the row when an instance cannot rebuild, and lands nothing", () => {
  const { fold, component, frames } = deck(2)
  const spec = changed((spec) => {
    Object.assign(spec.collections.rows, { owner: "string" })
    for (const row of spec.sample.data.rows) Object.assign(row, { owner: "Ana" })
  })
  expect(prepareComponentWrite(fold, { spec, target: component }, measure, mint)).toEqual({
    refused: "shape",
    node: frames[0],
    prop: "instance",
    field: "data.rows[0].owner",
    form: `Layer ${frames[0]} cannot expand with component ${component}: Missing. Needs a string.`,
  })
})

it("measures every text and reports one that overflows its box", () => {
  const { fold } = deck(0)
  const spec = changed((spec) => {
    spec.parts[0]!.emit.h = 20
    delete (spec.parts[0]!.emit as { fit?: unknown }).fit
    spec.parts[0]!.emit.chars = ["get", "r.label"]
    spec.sample.data.rows[0]!.label = "Design and delivery of the whole programme across every region"
  })
  const made = accepted(prepareComponentWrite(fold, { spec }, measure, mint))
  const overflow = (row: string) =>
    expect.objectContaining({
      where: "sample",
      kind: "text-overflow",
      key: ["label", row],
      field: "parts[0].emit",
      neededWidth: 360,
      availableWidth: 360,
      availableHeight: 20,
    })
  expect(made.findings).toEqual([overflow("a"), overflow("b")])
  const [long, short] = made.findings.map((found) => (found.kind === "text-overflow" ? found.neededHeight : 0))
  expect(short).toBeGreaterThan(20)
  expect(long).toBeGreaterThan(short!)
})

it("reports a layer that leaves the frame", () => {
  const { fold } = deck(0)
  const spec = changed((spec) => {
    spec.parts[2]!.emit.x = ["sub", ["get", "frame.w"], 40]
  })
  const made = accepted(prepareComponentWrite(fold, { spec }, measure, mint))
  expect(made.findings).toEqual([
    expect.objectContaining({ where: "sample", kind: "outside-frame", key: ["bar", "a"], field: "parts[2].emit" }),
    expect.objectContaining({ where: "sample", kind: "outside-frame", key: ["bar", "b"], field: "parts[2].emit" }),
  ])
  expect(made.findings[0]).toMatchObject({ box: { x: 1160, y: 82, w: 592, h: 16 }, frame: { w: 1200, h: 360 } })
})

it("reports each rebuilt instance's findings under its layer", () => {
  const { fold, component, frames } = deck(1, { rows: [{ id: "a", label: "A", share: 0.5 }] })
  const spec = changed((spec) => {
    spec.parts[2]!.emit.x = ["sub", ["get", "frame.w"], 40]
    spec.sample.data.rows = [spec.sample.data.rows[0]!]
  })
  const made = accepted(prepareComponentWrite(fold, { spec, target: component }, measure, mint))
  expect(made.findings.map(({ where, kind }) => [where, kind])).toEqual([
    ["sample", "outside-frame"],
    [frames[0], "outside-frame"],
  ])
})

const limited = changed((spec) => {
  spec.collectionLimits = { rows: 100 }
})

function timed<T>(run: () => T): { readonly value: T; readonly ms: number } {
  const started = Date.now()
  const value = run()
  return { value, ms: Date.now() - started }
}

it("rebuilds 32 instances within the edit's work budget and time", () => {
  const { fold, component, frames } = deck(32, rows(16))
  const { value, ms } = timed(() => prepareComponentWrite(fold, { spec: limited, target: component }, measure, mint))
  expect(accepted(value).rebuilt).toEqual(frames)
  expect(ms).toBeLessThan(1_500)
  expect(isRefusal(applyEdit(fold, step(fold, accepted(value).writes)))).toBe(false)
})

it("refuses an update whose rebuild needs more work than one edit allows, scoped to the component", () => {
  const { fold, component } = deck(32, rows(24))
  const { value, ms } = timed(() => prepareComponentWrite(fold, { spec: limited, target: component }, measure, mint))
  expect(value).toEqual({
    refused: "limit",
    node: component,
    prop: "spec",
    field: "spec",
    form: `Updating ${component} would rebuild 32 instances, more work than one edit allows. Detach or delete some instances, or make the spec cheaper.`,
  })
  expect(ms).toBeLessThan(1_500)
})
