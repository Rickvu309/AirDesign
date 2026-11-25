import * as doom from "@airdesign/doom"
import { expect, it } from "vitest"
import { nodeModel } from "./design-model"

it("offers only writable design controls for generated chart parts", () => {
  const { doom: before, slides } = doom.doomFromTree({ theme: doom.defaultTheme, slides: [{ children: [] }] })
  const slide = slides[0]!
  const frame = doom.nodeId("chart:1")
  const writes = doom.placeComponent(before, {
    frame,
    parent: { id: slide, at: doom.orderKeyBetween(null, null) },
    box: { x: 180, y: 180, w: 1200, h: 560, rotation: 0, flipH: false, flipV: false },
    data: { rows: [{ id: "a", label: "Europe", value: 12 }] },
    measure: doom.measureWith({}),
  })
  if (doom.isRefusal(writes)) throw new Error(JSON.stringify(writes))
  const view = doom.viewOf(before, [
    { once: "linked", author: { kind: "person", id: "test" }, readBase: before.rev, writes },
  ])
  const parts = doom.propOf(view.nodes.get(frame), "instance")!.parts
  const fields = (id: doom.NodeId) =>
    nodeModel({ view, id, theme: doom.defaultTheme, slides }).sections.flatMap(({ strips }) =>
      strips.flat().map(({ trait, field }) => `${trait}.${field}`),
    )
  const label = parts.find(({ key }) => key[0] === "category")!.node
  const bar = parts.find(({ key }) => key[0] === "bar")!.node
  expect(fields(label)).toEqual(["text.style", "link.target"])
  expect(fields(bar)).toEqual(["fills.paint"])
  expect(fields(frame)).toContain("border.border")
})
