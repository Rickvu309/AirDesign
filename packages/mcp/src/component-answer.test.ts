import * as doom from "@airdesign/doom"
import { expect, it } from "vitest"
import { componentFindings } from "./component-answer.js"

it("reports advice from the column spec in the agent's component answer", () => {
  const { doom: before, slides } = doom.doomFromTree({ theme: doom.defaultTheme, slides: [{ children: [] }] })
  const slide = slides[0]
  const definition = doom.componentLibrary.get("column")
  if (slide === undefined || definition === undefined) throw new Error("Missing column fixture")

  const frame = doom.nodeId("test:1")
  const measure = doom.measureWith({})
  const writes = doom.placeComponent(before, definition, {
    frame,
    parent: { id: slide, at: doom.orderKeyBetween(null, null) },
    box: { x: 160, y: 120, w: 1600, h: 800, rotation: 0, flipH: false, flipV: false },
    data: {
      rows: Array.from({ length: 13 }, (_, i) => ({ id: `year${i}`, label: String(2010 + i), value: i + 1 })),
    },
    measure,
  })
  if (doom.isRefusal(writes)) throw new Error(JSON.stringify(writes))
  const after = doom.applyEdit(before, {
    author: { kind: "person", id: "person" },
    once: "place-column",
    readBase: before.rev,
    rev: doom.rev(before.rev + 1),
    writes,
  })
  if (doom.isRefusal(after)) throw new Error(JSON.stringify(after))

  expect(componentFindings(after, [frame], measure)).toContainEqual({
    node: frame,
    key: ["root"],
    code: "many-columns",
    note: "test:1 root Use a line chart to show the trend across more than 12 time periods.",
  })
})
