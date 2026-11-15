import { describe, expect, it } from "vitest"
import { readParts } from "./package-container.js"
import { paintReader } from "./paint-reader.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

describe("a connector's paint", () => {
  it("names the shapes and sites its ends attach to, and nothing for an unbound line", async () => {
    const fs = process.getBuiltinModule("node:fs")
    const parts = await readParts(
      new Uint8Array(fs.readFileSync(`${process.cwd()}/scripts/pptx-fixtures/census-updating-spm.pptx`)),
    )
    const reader = paintReader(parts)
    const bound = reader.slide("ppt/slides/slide10.xml").elements.find((row) => row.shape === "26")
    expect(bound?.connection).toEqual({ start: { shape: "6", site: 2 }, end: { shape: "15", site: 0 } })
    const free = reader.slide("ppt/slides/slide16.xml").elements.find((row) => row.shape === "9")
    expect(free?.kind).toBe("p:cxnSp")
    expect(free?.connection).toBeUndefined()
  })
})
