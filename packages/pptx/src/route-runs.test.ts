declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const { readFileSync } = process.getBuiltinModule("node:fs")
import { expect, it } from "vitest"
import { readParts } from "./package-container.js"
import { drawnRuns, routeRuns } from "./route-runs.js"
import { readShapes } from "./read-shapes.js"
import { touchMatches } from "./route-parts.js"
import { layoutPart } from "./slide-placeholders.js"
import { slideAddresses } from "./package-address.js"

const folder = `${process.cwd()}/scripts/pptx-fixtures`

for (const name of ["blank.pptx", "nasa-1d-cnn.pptx"]) {
  it(`judges two slides added from two different layouts on ${name}`, async () => {
    const parts = await readParts(readFileSync(`${folder}/${name}`))
    const runs = routeRuns(parts).filter((run) => run.operation === "sldIdLst.add")
    expect(runs).toHaveLength(2)
    const run = runs[1]
    if (run?.parts == null || run.touch === null) throw new Error(run?.error ?? "run")
    expect(touchMatches(parts, run.parts, run.touch)).toBe(true)
    const before = new Set(slideAddresses(parts).map((address) => address.part))
    const born = slideAddresses(run.parts).filter((address) => !before.has(address.part))
    expect(born).toHaveLength(2)
    const layouts = born.map((address) => layoutPart(run.parts ?? new Map(), address.part))
    expect(new Set(layouts).size).toBe(2)
    expect(layouts).not.toContain(layoutPart(parts, slideAddresses(parts)[0]?.part ?? ""))
  })
}

for (const name of ["blank.pptx", "nasa-1d-cnn.pptx"]) {
  it(`judges a rectangle, an ellipse and a line added to the first slide of ${name}, each touching only that slide`, async () => {
    const parts = await readParts(readFileSync(`${folder}/${name}`))
    const runs = drawnRuns(parts)
    expect(runs.map((run) => (run.edit?.name === "spTree.add" ? run.edit.geometry : null))).toEqual([
      "rect",
      "ellipse",
      "line",
    ])
    expect(
      routeRuns(parts).filter((run) => run.edit?.name === "spTree.add" && run.edit.geometry !== undefined),
    ).toHaveLength(3)
    for (const run of runs) {
      if (run.parts == null || run.touch === null) throw new Error(run.error ?? "run")
      expect(touchMatches(parts, run.parts, run.touch)).toBe(true)
      const before = new Set(readShapes(parts).map((shape) => `${shape.part}#${shape.shape}`))
      const added = readShapes(run.parts).filter((shape) => !before.has(`${shape.part}#${shape.shape}`))
      expect(added.map((shape) => shape.kind)).toEqual([run === runs[2] ? "p:cxnSp" : "p:sp"])
    }
  })
}
