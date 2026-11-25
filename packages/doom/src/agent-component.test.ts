import { describe, expect, it } from "vitest"

import { compileAgentEdit, readingOf } from "./agent-edit.js"
import { readAgentChange } from "./agent-change.js"
import { firstSlide, minter } from "./agent-fixtures.js"
import { readForAgent } from "./agent-read.js"
import { childrenOf, propOf } from "./doom-walk.js"
import { isRefusal } from "./refusal.js"
import { applyEdit } from "./apply-edit.js"
import { rev } from "./ids.js"
import { componentLibrary, columnDefinition } from "./component/library.js"
import { componentTree } from "./component/join-instance.js"
import { measureWith } from "./measure.js"
import { defaultTheme, themeLibrary } from "./theme.js"
import { doomFromTree } from "./doom-tree.js"
import { titleSlideWrites } from "./slide-placeholders.js"
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

  it("regenerates data and changes the generated label style in the same batch", () => {
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
    const instance = root === undefined ? undefined : propOf(placed.after.nodes.get(root), "instance")
    const label = instance?.parts.find(({ key }) => key[0] === "category" && key[1] === "q1")?.node
    if (root === undefined || label === undefined) throw new Error("No category label")
    const changes = [
      { op: "set", target: root, data: { rows: [{ id: "q1", label: "New quarter", value: 10 }] } },
      { op: "set", target: label, textStyle: "body" },
    ].map((raw) => {
      const change = readAgentChange(raw, true)
      if (isRefusal(change)) throw new Error(JSON.stringify(change))
      return change
    })
    const edited = compileAgentEdit(placed.after, changes, {
      author: { kind: "agent", id: "agent", run: "update" },
      phase: "start",
      once: "update",
      mint: minter("update"),
      read: readingOf(placed.after, placed.after.rev),
    })
    if (isRefusal(edited)) throw new Error(JSON.stringify(edited))
    expect(propOf(edited.after.nodes.get(label), "text")).toMatchObject({ chars: "New quarter", style: "body" })
  })

  it("centres a sample in free space on a slide with a title", () => {
    const size = { w: 1920, h: 1080 }
    const {
      doom,
      slides: [slide],
    } = doomFromTree({ theme: defaultTheme, size, slides: [{ children: [] }] })
    if (slide === undefined) throw new Error("No slide")
    const before = applyEdit(doom, {
      once: "title",
      rev: rev(doom.rev + 1),
      author: { kind: "person", id: "person" },
      writes: titleSlideWrites(slide, minter("title"), size),
    })
    if (isRefusal(before)) throw new Error(JSON.stringify(before))
    const placed = compile(before, { op: "add", kind: "component", component: "column", slide }, "place")
    const root = placed.added.find(({ kind }) => kind === "component")?.id
    const box = root === undefined ? undefined : propOf(placed.after.nodes.get(root), "box")
    if (box === undefined) throw new Error("No component box")
    const sample = columnDefinition.spec.sample
    if (sample === undefined) throw new Error("No column sample")
    expect(Math.abs(box.w - (box.h * sample.w) / sample.h)).toBeLessThanOrEqual(2)
    for (const kid of childrenOf(before, slide)) {
      const occupied = propOf(kid, "box")
      if (occupied === undefined) continue
      expect(
        box.x + box.w <= occupied.x ||
          occupied.x + occupied.w <= box.x ||
          box.y + box.h <= occupied.y ||
          occupied.y + occupied.h <= box.y,
      ).toBe(true)
    }
  })

  const themes = [{ id: "fallback", theme: defaultTheme }, ...Object.values(themeLibrary)]
  const defaults = [...componentLibrary.keys()].flatMap((component) =>
    themes.map(({ id, theme }) => ({ component, id, theme })),
  )
  it.each(defaults)("places default $component on $id without findings", ({ component, theme }) => {
    const { doom } = doomFromTree({ theme, size: { w: 1920, h: 1080 }, slides: [{ children: [] }] })
    const placed = compile(doom, { op: "add", kind: "component", component, slide: firstSlide(doom) }, "default")
    const root = placed.added.find(({ kind }) => kind === "component")?.id
    if (root === undefined) throw new Error("No component was added")
    const tree = componentTree(placed.after, root, measureWith({}))
    if (isRefusal(tree)) throw new Error(JSON.stringify(tree))
    expect(tree.findings).toEqual([])
    expect(placed.findings).toEqual([])
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
