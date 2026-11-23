import { openRegister } from "@airdesign/document"
import { readParts } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { elementCommand } from "./element-edit"

type Parts = ReadonlyMap<string, Uint8Array>

const size = { width: 12_192_000, height: 6_858_000 }

async function fixture(name: string): Promise<Parts> {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  return readParts(await fs.readFile(new URL(`../../../scripts/pptx-fixtures/${name}`, import.meta.url)))
}

it("adds a drawn rectangle at the box the drag drew", async () => {
  const parts = await fixture("clean.pptx")
  const box = { x: 1_270_000, y: 635_000, cx: 2_540_000, cy: 1_270_000, flipH: false, flipV: false }
  const edit = elementCommand(parts, openRegister("", ""), {
    change: "shape",
    geometry: "rect",
    index: 0,
    size,
    drawn: { box },
  })
  expect(edit?.slide === "element-add" ? edit.element.box : null).toEqual({
    x: 1_270_000,
    y: 635_000,
    cx: 2_540_000,
    cy: 1_270_000,
  })
})

it("places the default shape with its corner at a click", async () => {
  const parts = await fixture("clean.pptx")
  const edit = elementCommand(parts, openRegister("", ""), {
    change: "shape",
    geometry: "ellipse",
    index: 0,
    size,
    drawn: { at: { x: 3_000_000, y: 2_000_000 } },
  })
  const box = edit?.slide === "element-add" ? edit.element.box : null
  expect([box?.x, box?.y]).toEqual([3_000_000, 2_000_000])
  expect(box?.cx).toBe(box?.cy)
})
