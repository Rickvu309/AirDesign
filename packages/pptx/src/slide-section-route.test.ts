declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const { readFileSync } = process.getBuiltinModule("node:fs")
import {
  orderKeyAfter,
  orderKeyBetween,
  presentSlides,
  slideId,
  type SlideCommand,
  type SlideState,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { readParts } from "./package-container.js"
import { sectionListFailures } from "./section-check.js"
import { readSections } from "./section-read.js"
import { orderedParts } from "./slide-order-route.js"

const fixture = `${process.cwd()}/scripts/pptx-fixtures/tall-glyph-before.pptx`
const file = [slideId("256"), slideId("257")]
const opening = "{6D0E4C2A-1B7F-4C3E-9A55-0F1D2C3B4A01}"
const numbers = "{6D0E4C2A-1B7F-4C3E-9A55-0F1D2C3B4A02}"
const first = `<p14:section name="Opening" id="${opening}"><p14:sldIdLst><p14:sldId id="256"/></p14:sldIdLst></p14:section>`
const second = `<p14:section name="Numbers" id="${numbers}"><p14:sldIdLst><p14:sldId id="257"/></p14:sldIdLst></p14:section>`
const sectionList = `<p:extLst><p:ext uri="{521415D9-36F7-43E2-AB2F-B90AF26B5E84}"><p14:sectionLst xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main">${first}${second}</p14:sectionLst></p:ext></p:extLst>`

async function sectioned(): Promise<ReadonlyMap<string, Uint8Array>> {
  const parts = new Map(await readParts(readFileSync(fixture)))
  const presentation = decodeUtf8(parts.get("ppt/presentation.xml") ?? new Uint8Array())
  parts.set(
    "ppt/presentation.xml",
    encodeUtf8(presentation.replace("</p:presentation>", `${sectionList}</p:presentation>`)),
  )
  return parts
}

function presentationOf(parts: ReadonlyMap<string, Uint8Array>): string {
  return decodeUtf8(parts.get("ppt/presentation.xml") ?? new Uint8Array())
}

function addAfter(state: SlideState, id: string, anchor: string): SlideCommand {
  const key = orderKeyAfter(presentSlides(state), slideId(anchor))
  if (key === null) throw new Error("key")
  return { slide: "add", id: slideId(id), after: slideId(anchor), key, layout: slideId(anchor) }
}

describe("orderedParts with sections", () => {
  it("writes a new slide into the section of the slide it comes after and leaves the other section as it was", async () => {
    const original = await sectioned()
    const add = addAfter({ file, order: [] }, "258", "257")
    const exported = orderedParts(original, { file, order: [add] })
    expect(sectionListFailures(exported)).toEqual([])
    expect(readSections(exported)).toEqual([
      { name: "Opening", slides: ["256"] },
      { name: "Numbers", slides: ["257", "258"] },
    ])
    expect(presentationOf(exported)).toContain(first)
  })

  it("takes a deleted slide out of its section and removes the section it emptied", async () => {
    const original = await sectioned()
    const exported = orderedParts(original, { file, order: [{ slide: "remove", id: slideId("257") }] })
    expect(sectionListFailures(exported)).toEqual([])
    expect(presentationOf(exported)).not.toContain('<p14:sldId id="257"/>')
    expect(presentationOf(exported)).not.toContain(numbers)
    expect(presentationOf(exported)).toContain(first)
    expect(readSections(exported)).toEqual([{ name: "Opening", slides: ["256"] }])
  })

  it("writes a moved slide into the section of the slide before it, in the new order", async () => {
    const original = await sectioned()
    const key = orderKeyBetween(null, presentSlides({ file, order: [] })[0]?.key ?? null)
    const exported = orderedParts(original, { file, order: [{ slide: "move", id: slideId("257"), key }] })
    expect(sectionListFailures(exported)).toEqual([])
    expect(presentationOf(exported)).toContain(
      `<p14:section name="Opening" id="${opening}"><p14:sldIdLst><p14:sldId id="257"/><p14:sldId id="256"/></p14:sldIdLst></p14:section>`,
    )
    expect(presentationOf(exported)).not.toContain(numbers)
  })

  it("keeps a section the file already had empty after the section before it", async () => {
    const empty = '<p14:section name="Later" id="{6D0E4C2A-1B7F-4C3E-9A55-0F1D2C3B4A03}"><p14:sldIdLst/></p14:section>'
    const original = new Map(await sectioned())
    original.set("ppt/presentation.xml", encodeUtf8(presentationOf(original).replace(second, `${empty}${second}`)))
    const add = addAfter({ file, order: [] }, "258", "257")
    const added = orderedParts(original, { file, order: [add] })
    expect(sectionListFailures(added)).toEqual([])
    expect(presentationOf(added)).toContain(`${first}${empty}`)
    expect(readSections(added).map((section) => [section.name, section.slides])).toEqual([
      ["Opening", ["256"]],
      ["Later", []],
      ["Numbers", ["257", "258"]],
    ])
    const edit: SlideCommand = { slide: "move-many", grid: 3, ids: [slideId("257")], after: null, row: "keep" }
    const moved = orderedParts(original, { file, order: [edit] })
    expect(sectionListFailures(moved)).toEqual([])
    expect(readSections(moved).map((section) => section.name)).toEqual(["Numbers", "Opening", "Later"])
  })

  it("keeps the presentation as it was when no section changed", async () => {
    const original = await sectioned()
    const add = addAfter({ file, order: [] }, "258", "257")
    const noSections = new Map(original)
    noSections.set("ppt/presentation.xml", encodeUtf8(presentationOf(original).replace(sectionList, "")))
    const exported = orderedParts(noSections, { file, order: [add] })
    expect(sectionListFailures(exported)).toEqual([])
    expect(presentationOf(exported)).not.toContain("sectionLst")
  })
})
