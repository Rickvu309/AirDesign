import { decide, elementId, format, openRegister, type Command, type Register } from "@airdesign/document"
import { readParts } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { fillCopy } from "@/copy/fill-copy"
import { caseSeed } from "@/design/control-seed"
import { chosenFill, heldPaint } from "./fill-image"

async function partsOf(name: string) {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  return readParts(await fs.readFile(new URL(`../../../../scripts/pptx-fixtures/${name}`, import.meta.url)))
}

const node = elementId("256.4")
const star = { image: caseSeed("fills.paint.image", { scheme: "accent1" }) }
const fill = { trait: "fills", field: "paint", label: fillCopy.value }

function landed(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function opened(): Register {
  const index = {
    format: 2,
    total: 1,
    slides: [{ id: "256", position: 0 }],
    elements: [{ node, kind: "shape" as const, value: null, box: { x: 0, y: 0, cx: 1, cy: 1 }, grouped: false }],
    pages: [],
  }
  return landed({ ...openRegister("", "deck"), index }, { command: "add", node, floor: "", route: "" })
}

it("keeps a stored image ahead of the imported picture, and asks for a file when neither is there", async () => {
  const parts = await partsOf("picture-png.pptx")
  expect(heldPaint(parts, null, node)).toEqual({ image: true })
  expect(heldPaint(parts, opened(), node)).toEqual({ image: true })
  const stored = landed(opened(), {
    command: "person",
    node,
    v: format,
    patch: { fills: { source: { set: "rocket" } } },
  })
  expect(heldPaint(parts, stored, node)).toEqual({ image: "rocket" })
  expect(heldPaint(parts, null, elementId("256.2"))).toBeNull()
  expect(chosenFill(star, fill, parts, null, node)).toEqual({ value: { image: true } })
  expect(chosenFill(star, fill, parts, stored, node)).toEqual({ value: { image: "rocket" } })
  expect(chosenFill(star, { ...fill, label: fillCopy.box }, parts, null, node)).toEqual({ value: star })
  expect(chosenFill({ solid: { scheme: "accent1" } }, fill, parts, null, node)).toEqual({
    value: { solid: { scheme: "accent1" } },
  })
  expect(chosenFill(star, fill, parts, null, elementId("256.2"))).toEqual({ pick: true })
})
