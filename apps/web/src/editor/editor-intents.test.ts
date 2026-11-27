import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { intentWrites, madeOf, removeIntents } from "./editor-intents"
import { grow, landed, spot } from "./testing/doom-fixtures"

const minter = () => {
  let made = 0
  return () => doom.nodeId(`new:${String((made += 1))}`)
}

function compiled(view: doom.Doom, intents: readonly doom.Intent[]): readonly doom.Write[] {
  const made = intentWrites(view, intents, { mint: minter() })
  if (made === null) throw new Error("Doom refused the change")
  return made.writes
}

const notesOf = (view: doom.Doom, slide: doom.NodeId) => doom.propOf(view.nodes.get(slide), "notes")?.chars

describe("deck name", () => {
  it("writes the new name on the deck", () => {
    const { view } = grow([])
    const after = landed(view, compiled(view, [{ op: "variables", name: "Board update" }]))
    expect(doom.deckName(after)).toBe("Board update")
  })
})

describe("presenter notes", () => {
  it("keeps one paragraph per line", () => {
    expect(doom.notesText("one\ntwo").paras).toHaveLength(2)
    expect(doom.notesText("").paras).toHaveLength(1)
  })

  it("writes a slide's notes, and replaces them the second time", () => {
    const { view, slides } = grow([])
    const slide = slides[0]!
    const first = landed(
      view,
      compiled(view, [{ op: "update", target: slide, notes: "Open with the number\nthen the plan" }]),
    )
    expect(notesOf(first, slide)).toBe("Open with the number\nthen the plan")
    const second = landed(first, compiled(first, [{ op: "update", target: slide, notes: "second" }]))
    expect(notesOf(second, slide)).toBe("second")
  })
})

describe("removing layers", () => {
  it("removes only the layers still on the deck", () => {
    const { view, ids, slides } = grow([
      { type: "shape", name: "a", props: { box: spot(0, 0, 10, 10) } },
      { type: "shape", name: "b", props: { box: spot(20, 0, 10, 10) } },
    ])
    const gone = landed(view, compiled(view, removeIntents(view, [ids.a!])))
    expect(removeIntents(gone, [ids.a!])).toEqual([])
    const after = landed(gone, compiled(gone, removeIntents(gone, [ids.a!, ids.b!])))
    expect(doom.childrenOf(after, slides[0]!)).toEqual([])
  })
})

describe("made nodes", () => {
  it("names the nodes of a type that the writes create", () => {
    const { view, ids } = grow([
      { type: "shape", name: "a", props: { box: spot(0, 0, 10, 10) } },
      { type: "shape", name: "b", props: { box: spot(20, 0, 10, 10) } },
    ])
    const writes = compiled(view, [{ op: "group", targets: [ids.a!, ids.b!] }])
    expect(madeOf(view, writes, "frame")).toEqual(["new:1"])
    expect(madeOf(view, writes, "shape")).toEqual([])
  })
})
