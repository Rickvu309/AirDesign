declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): {
    readFileSync(path: string): Uint8Array
    readdirSync(path: string): readonly string[]
  }
}

import { describe, expect, it } from "vitest"
import { encodeUtf8 } from "./package-bytes.js"
import { readParts } from "./package-container.js"
import { sectionListFailures } from "./section-check.js"

const { readFileSync, readdirSync } = process.getBuiltinModule("node:fs")

const first = "{6D0E4C2A-1B7F-4C3E-9A55-0F1D2C3B4A01}"
const second = "{6D0E4C2A-1B7F-4C3E-9A55-0F1D2C3B4A02}"
const gone = "{6D0E4C2A-1B7F-4C3E-9A55-0F1D2C3B4A09}"

function deck(sections: string, slide = ""): ReadonlyMap<string, Uint8Array> {
  const xml = `<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/><p:sldId id="258" r:id="rId4"/></p:sldIdLst><p:sldSz cx="1" cy="1"/>${sections}</p:presentation>`
  return new Map([
    ["ppt/presentation.xml", encodeUtf8(xml)],
    ["ppt/slides/slide1.xml", encodeUtf8(`<p:sld xmlns:p="p"><p:cSld><p:spTree>${slide}</p:spTree></p:cSld></p:sld>`)],
  ])
}

const list = (body: string) =>
  `<p:extLst><p:ext uri="{521415D9-36F7-43E2-AB2F-B90AF26B5E84}"><p14:sectionLst xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main">${body}</p14:sectionLst></p:ext></p:extLst>`

const section = (id: string, slides: readonly string[]) =>
  `<p14:section name="Part" id="${id}"><p14:sldIdLst>${slides.map((slide) => `<p14:sldId id="${slide}"/>`).join("")}</p14:sldIdLst></p14:section>`

const zoom = (kind: "psez:sectionZmObj" | "psuz:summaryZmObj", id: string) =>
  `<mc:AlternateContent xmlns:mc="mc"><mc:Choice Requires="psez"><p:graphicFrame><a:graphic xmlns:a="a"><a:graphicData uri="zoom"><${kind} xmlns:psez="z" xmlns:psuz="s" sectionId="${id}"/></a:graphicData></a:graphic></p:graphicFrame></mc:Choice><mc:Fallback/></mc:AlternateContent>`

describe("sectionListFailures", () => {
  it("passes a deck with no section list", () => {
    expect(sectionListFailures(deck(""))).toEqual([])
  })

  it("passes sections that list every slide once in the slide order, empty sections included", () => {
    const parts = deck(list(section(first, ["256"]) + section(gone, []) + section(second, ["257", "258"])))
    expect(sectionListFailures(parts)).toEqual([])
  })

  it("finds a slide in no section", () => {
    const parts = deck(list(section(first, ["256"]) + section(second, ["258"])))
    expect(sectionListFailures(parts)).toEqual(["cover: slide 257 is in no section"])
  })

  it("finds a slide in two sections", () => {
    const parts = deck(list(section(first, ["256", "257"]) + section(second, ["257", "258"])))
    expect(sectionListFailures(parts)).toEqual(["cover: slide 257 is in 2 sections"])
  })

  it("finds sections that do not follow the slide order", () => {
    const parts = deck(list(section(second, ["257", "258"]) + section(first, ["256"])))
    expect(sectionListFailures(parts)).toEqual(["order: section 1 lists slide 257 where the deck has slide 256"])
  })

  it("finds a section id that is not a GUID, and a section with no id", () => {
    const parts = deck(
      list(
        section("{A}", ["256"]) +
          section(first.toLowerCase(), ["257"]) +
          `<p14:section name="Part"><p14:sldIdLst><p14:sldId id="258"/></p14:sldIdLst></p14:section>`,
      ),
    )
    expect(sectionListFailures(parts)).toEqual([
      "id: section 1 has id {A}, which is not a GUID",
      `id: section 2 has id ${first.toLowerCase()}, which is not a GUID`,
      "id: section 3 has no id",
    ])
  })

  it("finds two sections with one id", () => {
    const parts = deck(list(section(first, ["256"]) + section(first, ["257", "258"])))
    expect(sectionListFailures(parts)).toEqual([`id: sections 1 and 2 have id ${first}`])
  })

  it("finds a section slide that is not in the deck", () => {
    const parts = deck(list(section(first, ["256", "257"]) + section(second, ["258", "999"])))
    expect(sectionListFailures(parts)).toEqual(["slide: section 2 lists slide 999, which is not in the deck"])
  })

  it("passes a section zoom and a summary zoom that name sections the list has", () => {
    const sections = list(section(first, ["256"]) + section(second, ["257", "258"]))
    const parts = deck(sections, zoom("psez:sectionZmObj", first) + zoom("psuz:summaryZmObj", second))
    expect(sectionListFailures(parts)).toEqual([])
  })

  it("finds a section zoom or a summary zoom that names a section the list does not have", () => {
    const sections = list(section(first, ["256"]) + section(second, ["257", "258"]))
    expect(sectionListFailures(deck(sections, zoom("psez:sectionZmObj", gone)))).toEqual([
      `reference: ppt/slides/slide1.xml names section ${gone}, which the section list does not have`,
    ])
    expect(sectionListFailures(deck("", zoom("psuz:summaryZmObj", gone)))).toEqual([
      `reference: ppt/slides/slide1.xml names section ${gone}, which the section list does not have`,
    ])
  })

  it("passes every fixture and corpus deck", async () => {
    const root = `${process.cwd()}/scripts/pptx-fixtures`
    const files = [
      ...readdirSync(root).map((name) => `${root}/${name}`),
      ...readdirSync(`${root}/corpus`).map((name) => `${root}/corpus/${name}`),
    ].filter((file) => file.endsWith(".pptx"))
    expect(files.length).toBeGreaterThan(40)
    const failures: string[] = []
    for (const file of files) {
      for (const failure of sectionListFailures(await readParts(readFileSync(file)))) {
        failures.push(`${file.slice(root.length + 1)} ${failure}`)
      }
    }
    expect(failures).toEqual([])
  }, 60_000)
})
