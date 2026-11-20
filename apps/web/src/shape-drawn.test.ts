import { decide, openRegister, slideId, type Command, type Register, type SlideCommand } from "@airdesign/document"
import { readParts } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { elementCommand } from "./element-edit"
import { exportedParts } from "./exported-parts"

type Parts = ReadonlyMap<string, Uint8Array>

const size = { width: 12_192_000, height: 6_858_000 }
const file = [slideId("256")]

async function fixture(name: string): Promise<Parts> {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  return readParts(await fs.readFile(new URL(`../../../scripts/pptx-fixtures/${name}`, import.meta.url)))
}

function added(register: Register, edit: SlideCommand | null): Register {
  if (edit === null) throw new Error("no edit")
  const decision = decide(register, { command: "slide", file, edit } satisfies Command)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function xfrmOf(parts: Parts, register: Register, name: string): string {
  const xml = new TextDecoder().decode(exportedParts(parts, register).get("ppt/slides/slide1.xml"))
  const shape = xml.split(/<p:(?:sp|cxnSp)>/).find((piece) => piece.includes(`name="${name}`))
  return shape?.match(/<a:xfrm[^>]*>.*?<\/a:xfrm>/s)?.[0] ?? ""
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

it("exports a line drawn up and to the left flipped, so its start stays where the drag began", async () => {
  const parts = await fixture("clean.pptx")
  const box = { x: 1_000_000, y: 2_000_000, cx: 2_000_000, cy: 1_000_000, flipH: true, flipV: true }
  const register = added(
    openRegister("", ""),
    elementCommand(parts, openRegister("", ""), { change: "shape", geometry: "line", index: 0, size, drawn: { box } }),
  )
  const xfrm = xfrmOf(parts, register, "Line")
  expect(xfrm).toContain('flipH="1"')
  expect(xfrm).toContain('flipV="1"')
  expect(xfrm).toContain('<a:off x="1000000" y="2000000"/>')
  expect(xfrm).toContain('<a:ext cx="2000000" cy="1000000"/>')
})
