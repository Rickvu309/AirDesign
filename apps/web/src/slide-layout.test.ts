import { openRegister, slideId, type Register, type SlideCommand } from "@airdesign/document"
import { readParts } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { flooredEdit } from "./slide-floor"
import { newSlideLayout, layoutOfSlide } from "./slide-layout"
import { slideCommand } from "./slide-edit"

type Parts = ReadonlyMap<string, Uint8Array>

async function fixture(name: string): Promise<Parts> {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  return readParts(await fs.readFile(new URL(`../../../scripts/pptx-fixtures/${name}`, import.meta.url)))
}

const file = [slideId("256")]
const contentPart = "ppt/slideLayouts/slideLayout2.xml"

function registerOf(order: readonly SlideCommand[]): Register {
  return { ...openRegister("", ""), file, order }
}

function added(parts: Parts, layoutPart: string | undefined): SlideCommand {
  const built = slideCommand(file, [], "add", 0, 0, layoutPart)
  if (built === null || built.edit.slide !== "add") throw new Error("add")
  return flooredEdit(parts, registerOf([]), file, built.edit)
}

it("reads the layout part of a slide from the file, from the layout it was added with and from its source", async () => {
  const parts = await fixture("blank.pptx")
  const born = added(parts, contentPart)
  if (born.slide !== "add") throw new Error("add")
  const clone: SlideCommand = { slide: "clone", id: slideId("259"), source: born.id, key: born.key }
  const register = registerOf([born, clone])
  expect(layoutOfSlide(parts, register, slideId("256"))).toBe("ppt/slideLayouts/slideLayout1.xml")
  expect(layoutOfSlide(parts, register, born.id)).toBe(contentPart)
  expect(layoutOfSlide(parts, register, clone.id)).toBe(contentPart)
})

it("adds a slide with the layout the person picked and gives it that layout's placeholders", async () => {
  const parts = await fixture("blank.pptx")
  const born = added(parts, "ppt/slideLayouts/slideLayout4.xml")
  expect(born).toMatchObject({ slide: "add", layoutPart: "ppt/slideLayouts/slideLayout4.xml" })
  expect(born.slide === "add" ? born.floor?.map((row) => row.node) : []).toEqual(["257.2", "257.3", "257.4"])
})

it("adds a slide after a title slide with the deck's content layout and after any other slide with its own layout", async () => {
  const parts = await fixture("blank.pptx")
  expect(newSlideLayout(parts, registerOf([]), slideId("256"))).toBe(contentPart)
  const born = added(parts, contentPart)
  if (born.slide !== "add") throw new Error("add")
  expect(newSlideLayout(parts, registerOf([born]), born.id)).toBeUndefined()
})

it("keeps today's behavior when the deck has no content layout or its layouts cannot be read", async () => {
  const parts = new Map(await fixture("blank.pptx"))
  parts.delete("ppt/slideMasters/slideMaster1.xml")
  expect(newSlideLayout(parts, registerOf([]), slideId("256"))).toBeUndefined()
  const bare = slideCommand(file, [], "add", 0)
  expect(bare?.edit).not.toHaveProperty("layoutPart")
})
