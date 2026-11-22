import { afterEach, expect, it } from "vitest"
import type { CanvasTable, CanvasText } from "./index.js"
import { cell, mounted, unmountAll } from "./table-canvas-fixture.js"

afterEach(unmountAll)

const run = { font: "Arial", size: 1400, bold: false, italic: false, color: "black" }

function words(anchor: CanvasText["anchor"]): CanvasText {
  return {
    paragraphs: [
      {
        from: 0,
        align: "left",
        bullet: null,
        spaceAfter: { length: 0 },
        runs: [{ from: 0, text: "Owner", ...run }],
        endStyle: run,
      },
    ],
    anchor,
    insets: { left: 91_440, right: 91_440, top: 45_720, bottom: 45_720 },
    wrap: true,
  }
}

const borders = { left: null, right: null, top: null, bottom: null }

function table(anchor: CanvasText["anchor"]): CanvasTable {
  const one = { gridSpan: 1, rowSpan: 1, hMerge: false, vMerge: false, fill: null, text: words(anchor), borders }
  return { columns: [100_000, 100_000], rows: [{ height: 711_200, cells: [one, one] }] }
}

it.each([
  ["middle", "center"],
  ["bottom", "flex-end"],
  ["top", "flex-start"],
] as const)("keeps an editable cell's words at the %s of a row taller than them", async (anchor, justify) => {
  const { host, draw } = await mounted(null, { table: table(anchor) })
  await draw(1)
  const text = cell(host, "0.0")
  expect(text.parentElement?.style.justifyContent).toBe(justify)
  expect(text.style.flexGrow).toBe("0")
})
