import {
  decide,
  elementId,
  openRegister,
  orderKeyAfter,
  presentSlides,
  slideId,
  type Register,
  type SlideCommand,
  type SlideId,
} from "@airdesign/document"
import { readParts, readShapes, readSlides } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { copyCommands, elementCommand } from "./element-edit"
import { exportedParts } from "./exported-parts"
import { flooredEdit } from "./slide-floor"

type Parts = ReadonlyMap<string, Uint8Array>

const size = { width: 1000, height: 500 }

async function fixture(name: string): Promise<Parts> {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  return readParts(await fs.readFile(new URL(`../../../scripts/pptx-fixtures/${name}`, import.meta.url)))
}

function landed(parts: Parts, register: Register, edit: SlideCommand | null): Register {
  if (edit === null) throw new Error("no edit")
  const file = readSlides(parts).map((slide) => slideId(slide.slide))
  const decision = decide(register, { command: "slide", file, edit })
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function cloned(parts: Parts, register: Register, source: SlideId, id: SlideId): Register {
  const file = readSlides(parts).map((slide) => slideId(slide.slide))
  const key = orderKeyAfter(presentSlides({ file, order: register.order }), source)
  if (key === null) throw new Error("key")
  return landed(parts, register, flooredEdit(parts, register, file, { slide: "clone", id, source, key }))
}

function stacked(parts: Parts, register: Register, slide: string): readonly string[] {
  return readShapes(exportedParts(parts, register))
    .filter((shape) => shape.slide === slide)
    .map((shape) => shape.shape)
}

it("puts a new layer on top of layers pasted from another slide, as Figma does", async () => {
  const parts = await fixture("clean.pptx")
  let register = cloned(parts, openRegister("", ""), slideId("256"), slideId("257"))
  const box = { x: 10, y: 10, cx: 100, cy: 40 }
  const { edits } = copyCommands(parts, register, [{ id: elementId("256.2"), box, onto: slideId("257") }])
  for (const edit of edits) register = landed(parts, register, edit)
  expect(stacked(parts, register, "257")).toEqual(["2", "3"])
  register = landed(
    parts,
    register,
    elementCommand(parts, register, { change: "shape", geometry: "rect", index: 1, size }),
  )
  register = landed(parts, register, elementCommand(parts, register, { change: "text", index: 1, size }))
  expect(stacked(parts, register, "257")).toEqual(["2", "3", "4", "5"])
})
