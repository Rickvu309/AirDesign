import { describe, expect, it } from "vitest"
import { type AgentChange, readAgentChange } from "./agent-change.js"
import { build } from "./agent-fixtures.js"
import { more, richDeck } from "./testing/rich-deck.js"
import { ids } from "./sample-deck.js"
import { propOf } from "./doom-walk.js"
import type { Doom } from "./doom.js"

const read = (raw: Record<string, unknown>): AgentChange => {
  const change = readAgentChange(raw)
  if ("refused" in change) throw new Error(`refused ${JSON.stringify(change)}`)
  return change
}
const boxOf = (doom: Doom, id: string) => propOf(doom.nodes.get(id as never)!, "box")
const subsets = <K extends string>(keys: readonly K[]): readonly K[][] =>
  keys.reduce<K[][]>((all, key) => [...all, ...all.map((some) => [...some, key])], [[]]).slice(1)

describe("a box with only the fields that change", () => {
  const was = { x: 100, y: 300, w: 800, h: 500 }
  const asked = { x: 11, y: 22, w: 33, h: 44 }

  for (const keys of subsets(["x", "y", "w", "h"] as const)) {
    it(`set with ${keys.join(", ")} keeps the rest of the box`, () => {
      const box = Object.fromEntries(keys.map((key) => [key, asked[key]]))
      const doom = build(richDeck(), read({ op: "set", target: more.frame, box }))
      expect(boxOf(doom, more.frame)).toMatchObject({ ...was, ...box })
    })
  }

  for (const keys of subsets(["x", "y"] as const)) {
    it(`move with ${keys.join(", ")} keeps the other place and the size`, () => {
      const box = Object.fromEntries(keys.map((key) => [key, asked[key]]))
      const doom = build(richDeck(), read({ op: "move", node: more.frame, into: ids.slide, box }))
      expect(boxOf(doom, more.frame)).toMatchObject({ ...was, ...box })
    })
  }

  it("moves a line's ends by the box it keeps", () => {
    const doom = build(richDeck(), read({ op: "set", target: more.line, box: { y: 260 } }))
    expect(propOf(doom.nodes.get(more.line)!, "geometry")).toMatchObject({
      start: { x: 100, y: 260 },
      end: { x: 400, y: 260 },
    })
  })

  it("add still needs the whole box, or none for the largest free area", () => {
    expect(readAgentChange({ op: "add", kind: "shape", slide: ids.slide, box: { x: 1, y: 2 } })).toMatchObject({
      field: "box.w",
      fault: "missing",
    })
  })
})
