import { expect, it } from "vitest"
import { readParts } from "./package-container.js"
import { readShapes } from "./read-shapes.js"
import { applyRoute, oneRunValue, textStorable } from "./slide-route.js"
declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array; readdirSync(path: string): string[] }
}
const { readFileSync, readdirSync } = process.getBuiltinModule("node:fs")
const fixture = (name: string) => `${process.cwd()}/scripts/pptx-fixtures/${name}`
it("offers exactly the text boxes whose export succeeds on every fixture deck", async () => {
  const disagreements: string[] = []
  let offered = 0
  for (const name of readdirSync(`${process.cwd()}/scripts/pptx-fixtures`).filter((file) => file.endsWith(".pptx"))) {
    const parts = await readParts(readFileSync(fixture(name)))
    for (const row of readShapes(parts)) {
      if (row.text.length === 0) continue
      const editable = textStorable(parts, row.part, row.shape)
      let exported = true
      try {
        const value = oneRunValue(parts, row.part, row.shape, "typed")
        applyRoute(parts, { name: "text", part: row.part, shape: row.shape, value })
      } catch {
        exported = false
      }
      if (editable) offered += 1
      if (editable !== exported) disagreements.push(`${name} ${row.part}#${row.shape}`)
    }
  }
  expect(disagreements).toEqual([])
  expect(offered).toBeGreaterThan(0)
}, 30_000)
