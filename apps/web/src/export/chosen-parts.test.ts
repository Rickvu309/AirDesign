import { decide, openRegister } from "@airdesign/document"
import { readParts, readShapes, readSlides } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { exportedParts } from "@/exported-parts"
import { pictureCommand } from "@/picture-add"
import { fileSlides } from "@/slide-edit"
import { chosenParts } from "./chosen-parts"

async function fixture(name: string): Promise<ReadonlyMap<string, Uint8Array>> {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  return readParts(await fs.readFile(new URL(`../../../../scripts/pptx-fixtures/${name}`, import.meta.url)))
}

it("keeps only the chosen slide of a deck no slide command has touched yet", async () => {
  const parts = await fixture("tall-glyph-before.pptx")
  const [first, second] = readSlides(parts)
  if (first === undefined || second === undefined) throw new Error("slides")
  const chosen = chosenParts(parts, openRegister("", "tall"), [1])
  expect(readSlides(chosen)).toEqual([second])
  expect(chosen.has(first.part)).toBe(false)
  expect(chosen.get(second.part)).toBe(parts.get(second.part))
})

it("exports the whole deck as before when no slide is named", async () => {
  const parts = await fixture("tall-glyph-before.pptx")
  const register = openRegister("", "tall")
  expect(chosenParts(parts, register, undefined)).toBe(exportedParts(parts, register))
})

it("keeps a picture added to the chosen slide, with its media part", async () => {
  const parts = await fixture("tall-glyph-before.pptx")
  const [, second] = readSlides(parts)
  if (second === undefined) throw new Error("slides")
  const media = { sha256: "c".repeat(64), type: "image/png" } as const
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])
  const opened = openRegister("", "tall")
  const edit = pictureCommand(parts, opened, 1, { media }, { x: 10, y: 20, cx: 300, cy: 200 })
  if (edit === null) throw new Error("picture")
  const decision = decide(opened, { command: "slide", file: fileSlides(parts, opened), edit })
  if (decision.decision !== "apply") throw new Error(decision.code)
  const chosen = chosenParts(parts, decision.register, [1], new Map([[media.sha256, png]]))
  expect(readSlides(chosen)).toHaveLength(1)
  expect(readShapes(chosen).filter((shape) => shape.slide === second.slide && shape.kind === "p:pic")).toHaveLength(1)
  expect([...chosen].filter(([name, bytes]) => name.startsWith("ppt/media/") && bytes === png)).toHaveLength(1)
})
