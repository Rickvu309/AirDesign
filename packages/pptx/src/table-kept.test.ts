import { elementId } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { indexPackage } from "./index-package.js"
import { readParts } from "./package-container.js"
import { readShapes, shapeKind } from "./read-shapes.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const { readFileSync } = process.getBuiltinModule("node:fs")
const decks = ["table-added.pptx", "table-columns.pptx", "table-styled.pptx"]

async function deckParts(name: string) {
  return readParts(new Uint8Array(readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`)))
}

describe("a PowerPoint table frame", () => {
  it("opens as kept content, painted as a frame, in every table deck", async () => {
    for (const name of decks) {
      const parts = await deckParts(name)
      const frames = readShapes(parts).filter((shape) => shape.kind === "p:graphicFrame")
      expect(frames.length, name).toBeGreaterThan(0)
      expect(frames.map((shape) => shapeKind(shape))).toEqual(frames.map(() => "kept"))
      const index = indexPackage(parts)
      for (const frame of frames) {
        const element = index.elements.find((each) => each.node === elementId(`${frame.slide}.${frame.shape}`))
        expect(element, name).toMatchObject({ kind: "kept", value: null })
      }
      expect(
        index.elements.map((each) => each.kind),
        name,
      ).not.toContain("table")
    }
  })
})
