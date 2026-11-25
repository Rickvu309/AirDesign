import * as doom from "@airdesign/doom"
import { expect, it } from "vitest"
import { componentFindings } from "./component-answer.js"

const frame = doom.nodeId("test:1")
const measure = doom.measureWith({})

function placed(id: string, w: number, data: unknown, variant?: unknown) {
  const { doom: before, slides } = doom.doomFromTree({ theme: doom.defaultTheme, slides: [{ children: [] }] })
  const slide = slides[0]
  const definition = doom.componentLibrary.get(id)
  if (slide === undefined || definition === undefined) throw new Error(`Missing ${id} fixture`)
  const writes = doom.placeComponent(before, definition, {
    frame,
    parent: { id: slide, at: doom.orderKeyBetween(null, null) },
    box: { x: 160, y: 120, w, h: 800, rotation: 0, flipH: false, flipV: false },
    data,
    ...(variant === undefined ? {} : { variant }),
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
  return after
}

it("reports advice from the column spec in the agent's component answer", () => {
  const after = placed("column", 1600, {
    rows: Array.from({ length: 13 }, (_, i) => ({ id: `year${i}`, label: String(2010 + i), value: i + 1 })),
  })
  expect(componentFindings(after, [frame], measure)).toContainEqual({
    node: frame,
    key: ["root"],
    code: "many-columns",
    note: "test:1 root Use a line chart to show the trend across more than 12 time periods.",
  })
})

it.each([
  ["column", { rows: Array.from({ length: 40 }, (_, i) => ({ id: `r${i}`, label: `Region ${i}`, value: i + 1 })) }],
  [
    "clustered-chart",
    {
      categories: Array.from({ length: 40 }, (_, i) => ({ id: `r${i}`, label: `Region ${i}` })),
      series: [{ id: "s", label: "Sales", values: Array.from({ length: 40 }, (_, i) => i + 1) }],
    },
  ],
  [
    "clustered-chart",
    {
      categories: Array.from({ length: 60 }, (_, i) => ({ id: `r${i}`, label: `Region ${i}` })),
      series: [{ id: "s", label: "Sales", values: Array.from({ length: 60 }, (_, i) => i + 1) }],
    },
    { orientation: "bar" },
  ],
])("ends a thinned %s label finding with the spec's advice", (id, data, variant?: unknown) => {
  const findings = componentFindings(placed(id, 600, data, variant), [frame], measure)
  const thinned = findings.find(({ code, note }) => code === "text-fit" && note.includes("thinned"))
  const fix = variant === undefined ? "widen the frame" : "make the frame taller"
  expect(thinned?.note).toMatch(new RegExp(`labels thinned\\. Show fewer categories or ${fix}\\.$`))
})
