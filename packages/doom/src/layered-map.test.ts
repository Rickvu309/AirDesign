import { describe, expect, it } from "vitest"

import { layeredOver } from "./layered-map.js"

describe("a map layered over another", () => {
  it("reads through to the map below, keeps its writes on top, and leaves the map below as it was", () => {
    const below = new Map([
      ["a", 1],
      ["b", 2],
    ])
    const top = layeredOver(below)
    top.set("b", 20).set("c", 3)
    expect(top.delete("a")).toBe(true)
    expect(top.delete("missing")).toBe(false)
    expect([...top]).toEqual([
      ["b", 20],
      ["c", 3],
    ])
    expect(top.size).toBe(2)
    expect(top.get("a")).toBeUndefined()
    expect(top.has("c")).toBe(true)
    expect([...below]).toEqual([
      ["a", 1],
      ["b", 2],
    ])
    top.set("a", 10)
    expect(top.size).toBe(3)
    expect([...top.keys()]).toEqual(["a", "b", "c"])
    expect(new Map(top)).toEqual(
      new Map([
        ["a", 10],
        ["b", 20],
        ["c", 3],
      ]),
    )
  })

  it("answers the same as a copied map after many layers, flattening as it grows", () => {
    let copied = new Map<number, number>()
    let layered: ReadonlyMap<number, number> = new Map()
    for (let step = 0; step < 50; step += 1) {
      const next = layeredOver(layered)
      const copy = new Map(copied)
      next.set(step, step * 2)
      copy.set(step, step * 2)
      if (step % 7 === 0) {
        next.set(step - 3, -step)
        copy.set(step - 3, -step)
      }
      layered = next
      copied = copy
      expect([...layered]).toEqual([...copied])
      expect(layered.size).toBe(copied.size)
    }
  })
})
