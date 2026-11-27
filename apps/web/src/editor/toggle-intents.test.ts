import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { intentWrites } from "./editor-intents"
import { toggleIntents } from "./toggle-intents"
import { grow, landed, spot } from "./testing/doom-fixtures"

function deck() {
  return grow([
    { type: "shape", name: "back", props: { box: spot(0, 0, 40, 40) } },
    { type: "shape", name: "front", props: { box: spot(10, 10, 40, 40), mask: true } },
    { type: "frame", name: "group", props: { box: spot(80, 0, 40, 40) } },
  ])
}

function toggled(view: doom.Doom, ids: readonly doom.NodeId[], prop: "hidden" | "locked" | "mask") {
  const made = intentWrites(view, toggleIntents(view, ids, prop))
  if (made === null) throw new Error("Doom refused the toggle")
  return landed(view, made.writes)
}

const valueOf = (view: doom.Doom, id: doom.NodeId, prop: "hidden" | "locked" | "mask") =>
  doom.propOf(view.nodes.get(id), prop) ?? false

describe("Use as mask", () => {
  it("turns the mask on, and off when every layer is already a mask", () => {
    const { view, ids } = deck()
    expect(valueOf(toggled(view, [ids.back!], "mask"), ids.back!, "mask")).toBe(true)
    expect(valueOf(toggled(view, [ids.front!], "mask"), ids.front!, "mask")).toBe(false)
    const mixed = toggled(view, [ids.back!, ids.front!], "mask")
    expect([valueOf(mixed, ids.back!, "mask"), valueOf(mixed, ids.front!, "mask")]).toEqual([true, true])
  })

  it("skips a node that is not a frame or a shape", () => {
    const { view, slides } = deck()
    expect(toggleIntents(view, [slides[0]!], "mask")).toEqual([])
  })
})

describe("hide and lock", () => {
  it.each(["hidden", "locked"] as const)("turns %s on for every layer, then off again", (prop) => {
    const { view, ids } = deck()
    const chosen = [ids.back!, ids.group!]
    const on = toggled(view, chosen, prop)
    expect(chosen.map((id) => valueOf(on, id, prop))).toEqual([true, true])
    const off = toggled(on, chosen, prop)
    expect(chosen.map((id) => valueOf(off, id, prop))).toEqual([false, false])
  })
})
