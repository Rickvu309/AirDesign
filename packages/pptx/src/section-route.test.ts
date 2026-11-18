declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

import { describe, expect, it } from "vitest"
import { readParts } from "./package-container.js"
import { sectionListFailures } from "./section-check.js"
import { applyStructuralRoute } from "./structural-route.js"

const { readFileSync } = process.getBuiltinModule("node:fs")
const deck = (name: string) => readParts(readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`))
const opening = "{6D0E4C2A-1B7F-4C3E-9A55-0F1D2C3B4A01}"
const numbers = "{6D0E4C2A-1B7F-4C3E-9A55-0F1D2C3B4A02}"

describe("the section routes", () => {
  it.fails("leave every slide in one section, in the slide order", async () => {
    const sectioned = await deck("sections-before.pptx")
    const clean = await deck("clean.pptx")
    expect(sectionListFailures(applyStructuralRoute(clean, { name: "sectionLst.add", title: "Part" }))).toEqual([])
    expect(
      sectionListFailures(applyStructuralRoute(sectioned, { name: "sectionLst.remove", section: opening })),
    ).toEqual([])
    expect(
      sectionListFailures(
        applyStructuralRoute(sectioned, { name: "sectionLst.order", section: numbers, before: opening }),
      ),
    ).toEqual([])
  })
})
