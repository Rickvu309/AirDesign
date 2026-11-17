import { readFile } from "node:fs/promises"
import type { Page } from "@playwright/test"
import { settled } from "./design-panel"

export async function historicalTable(page: Page, kind: "typed" | "cells" | "readable" = "typed") {
  const doc = await import("../../packages/document/src/index.ts")
  const pptx = await import("../../packages/pptx/src/index.ts")
  const original = await readFile(`scripts/pptx-fixtures/${kind === "cells" ? "table-added" : "blank"}.pptx`)
  const read = await pptx.readPackage(original)
  if (!read.ok) throw new Error("package")
  let register = doc.openRegister("", "")
  const node = doc.elementId("256.4")
  const value = doc.openingTable(3, 3)
  if (kind !== "cells") {
    const added = doc.decide(register, {
      command: "slide",
      file: [doc.slideId("256")],
      edit: {
        slide: "element-add",
        id: doc.slideId("256"),
        element: {
          node,
          kind: "table",
          grouped: false,
          value: doc.writeTableValue(value),
          box: { x: 2438400, y: 4235580, cx: 7315200, cy: 1112520 },
        },
      },
    })
    if (added.decision !== "apply") throw new Error(added.code)
    register = added.register
  }
  const base = pptx.orderedParts(read.parts, register)
  const shape = pptx.readShapes(base).find((shape) => shape.contentKind === "table")
  if (shape === undefined) throw new Error("table")
  const saved = pptx.readTable(base, shape.part, shape.shape)
  if (saved === null) throw new Error("table value")
  const words = (text: string) => [{ from: 0, runs: [{ from: -1, text }] }]
  const accent1 = { solid: { scheme: "accent1" } } as const
  const accent2 = { solid: { scheme: "accent2" } } as const
  const thin = { width: 12700, fill: accent1 }
  const edited = {
    rows: saved.rows.map((row, index) => ({
      ...row,
      cells: row.cells.map((cell, column) =>
        index === 0 && column < 2 ? words(column === 0 ? "Region" : "Sales") : cell,
      ),
      ...(kind === "cells"
        ? {
            fills: row.cells.map(() => (index === 0 ? accent1 : index === 1 ? accent2 : null)),
            borders: row.cells.map(() => (index === 1 ? { bottom: thin } : index === 2 ? { top: thin } : null)),
          }
        : {}),
    })),
  }
  const parts = pptx.writeTable(base, shape.part, shape.shape, edited)
  const buffer = Buffer.from(await pptx.exportPackage(original, parts))
  await page.goto("/")
  await page
    .locator("input[type=file]")
    .setInputFiles({ name: "saved-table.pptx", mimeType: "application/octet-stream", buffer })
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  return buffer
}
