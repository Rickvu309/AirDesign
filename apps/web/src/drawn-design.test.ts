import {
  decide,
  drawnDesign,
  elementId,
  presets,
  lineGeometries,
  openRegister,
  readSlideId,
  type Register,
} from "@airdesign/document"
import { readParts } from "@airdesign/pptx"
import { describe, expect, it } from "vitest"
import { exportedParts } from "@/exported-parts"
import { designedParts } from "@/index-deck"

async function blank(): Promise<Uint8Array> {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  return fs.readFile(new URL("../../../scripts/pptx-fixtures/blank.pptx", import.meta.url))
}

describe("a drawn layer's design", () => {
  it("is what its exported markup reads as, for every preset a person or an agent can draw", async () => {
    const parts = await readParts(await blank())
    const index = designedParts(parts)
    const slide = readSlideId(index.slides[0]?.id)
    if (slide === undefined) throw new Error("no slide")
    const opened: Register = {
      ...openRegister("", ""),
      index: { format: 2, total: index.elements.length, slides: index.slides, elements: index.elements, pages: [] },
    }
    const node = elementId(`${slide}.9`)
    for (const geometry of presets) {
      const line = lineGeometries.includes(geometry)
      const box = { x: 914_400, y: 914_400, cx: 1_828_800, cy: line ? 0 : 914_400 }
      const element = { node, kind: line ? "connector" : "shape", value: null, box, grouped: false } as const
      const drawn = decide(opened, {
        command: "slide",
        file: [slide],
        edit: { slide: "element-add", id: slide, element, geometry },
      })
      if (drawn.decision !== "apply") throw new Error(`${geometry}: ${drawn.code}`)
      const read = designedParts(exportedParts(parts, drawn.register)).elements.find((each) => each.node === node)
      expect([geometry, read?.design]).toEqual([geometry, drawnDesign(geometry)])
    }
  })
})
