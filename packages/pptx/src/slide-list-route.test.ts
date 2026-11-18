declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

import { describe, expect, it } from "vitest"
import { readParts } from "./package-container.js"
import { sectionListFailures } from "./section-check.js"
import { applyStructuralRoute } from "./structural-route.js"

const { readFileSync } = process.getBuiltinModule("node:fs")

describe("the slide list routes on a deck with sections", () => {
  it.fails("keep every slide in one section and name no slide the deck lacks", async () => {
    const parts = await readParts(readFileSync(`${process.cwd()}/scripts/pptx-fixtures/sections-before.pptx`))
    for (const route of [
      { name: "sldIdLst.add", after: "256" },
      { name: "sldIdLst.clone", slide: "256" },
      { name: "sldIdLst.remove", slide: "257" },
      { name: "sldIdLst.order", slide: "257", before: "256" },
    ] as const) {
      expect(sectionListFailures(applyStructuralRoute(parts, route))).toEqual([])
    }
  })
})
