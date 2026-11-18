declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

import { describe, expect, it } from "vitest"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { readParts } from "./package-container.js"
import { sectionListFailures } from "./section-check.js"
import { readSections } from "./section-read.js"
import { keyedSectionId, writeSections, type SectionPlan } from "./section-write.js"
import { applyStructuralRoute } from "./structural-route.js"

const { readFileSync } = process.getBuiltinModule("node:fs")
const fixture = (name: string) => readParts(readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`))

const opening = "{6D0E4C2A-1B7F-4C3E-9A55-0F1D2C3B4A01}"
const numbers = "{6D0E4C2A-1B7F-4C3E-9A55-0F1D2C3B4A02}"
const closing = "{6D0E4C2A-1B7F-4C3E-9A55-0F1D2C3B4A03}"
const uri = "{521415D9-36F7-43E2-AB2F-B90AF26B5E84}"
const namespace = "http://schemas.microsoft.com/office/powerpoint/2010/main"
const slides = ["256", "257", "258", "259"]

const section = (name: string, id: string, ids: readonly string[]) =>
  `<p14:section name="${name}" id="${id}"><p14:sldIdLst>${ids.map((slide) => `<p14:sldId id="${slide}"/>`).join("")}</p14:sldIdLst></p14:section>`

const sectioned =
  section("Opening &amp; plan", opening, ["256"]) +
  section("Numbers", numbers, ["257", "258"]) +
  section("Close", closing, ["259"])

const list = (body: string, after = "") =>
  `<p:extLst><p:ext uri="${uri}"><p14:sectionLst xmlns:p14="${namespace}">${body}</p14:sectionLst></p:ext>${after}</p:extLst>`

function deck(tail: string, order: readonly string[] = slides, zoomed = ""): ReadonlyMap<string, Uint8Array> {
  const ids = order.map((id, at) => `<p:sldId id="${id}" r:id="rId${at + 2}"/>`).join("")
  return new Map([
    [
      "ppt/presentation.xml",
      encodeUtf8(
        `<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst>${ids}</p:sldIdLst><p:sldSz cx="1" cy="1"/>${tail}</p:presentation>`,
      ),
    ],
    ["ppt/slides/slide1.xml", encodeUtf8(`<p:sld xmlns:p="p"><p:cSld><p:spTree>${zoomed}</p:spTree></p:cSld></p:sld>`)],
  ])
}

const xml = (parts: ReadonlyMap<string, Uint8Array>) =>
  decodeUtf8(parts.get("ppt/presentation.xml") ?? new Uint8Array())
const same: readonly SectionPlan[] = [
  { from: 0, slides: ["256"] },
  { from: 1, slides: ["257", "258"] },
  { from: 2, slides: ["259"] },
]

describe("writeSections", () => {
  it("writes no bytes when the sections are the file's own", () => {
    const parts = deck(list(sectioned))
    expect(writeSections(parts, same)).toBe(parts)
    expect(writeSections(parts, [{ ...same[0]!, name: "Opening & plan" }, same[1]!, same[2]!])).toBe(parts)
  })

  it("rewrites only the two slide lists when a slide changes section", () => {
    const parts = deck(list(sectioned))
    const written = writeSections(parts, [
      { from: 0, slides: ["256", "257"] },
      { from: 1, slides: ["258"] },
      { from: 2, slides: ["259"] },
    ])
    expect(xml(written)).toBe(
      xml(parts)
        .replace('<p14:sldId id="256"/></p14:sldIdLst>', '<p14:sldId id="256"/><p14:sldId id="257"/></p14:sldIdLst>')
        .replace('<p14:sldIdLst><p14:sldId id="257"/><p14:sldId id="258"/>', '<p14:sldIdLst><p14:sldId id="258"/>'),
    )
    expect(sectionListFailures(written)).toEqual([])
  })

  it("moves a section's element bytes unchanged when its slides moved", () => {
    const parts = deck(list(sectioned), ["259", "256", "257", "258"])
    const written = writeSections(parts, [{ from: 2, slides: ["259"] }, same[0]!, same[1]!])
    expect(xml(written)).toBe(
      xml(parts).replace(
        sectioned,
        section("Close", closing, ["259"]) + sectioned.slice(0, -section("Close", closing, ["259"]).length),
      ),
    )
    expect(sectionListFailures(written)).toEqual([])
  })

  it("adds one new section with an id made from its key, the same on every write, named Untitled Section", () => {
    const parts = deck(list(sectioned))
    const plan: readonly SectionPlan[] = [
      same[0]!,
      { from: 1, slides: ["257"] },
      { key: "n7", slides: ["258"] },
      same[2]!,
    ]
    const written = writeSections(parts, plan)
    const id = keyedSectionId("n7")
    expect(id).toMatch(/^\{[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-8[0-9A-F]{3}-[0-9A-F]{12}\}$/)
    expect(keyedSectionId("n8")).not.toBe(id)
    expect(xml(written)).toBe(
      xml(parts).replace(
        section("Numbers", numbers, ["257", "258"]),
        section("Numbers", numbers, ["257"]) + section("Untitled Section", id, ["258"]),
      ),
    )
    expect(xml(writeSections(parts, plan))).toBe(xml(written))
    expect(sectionListFailures(written)).toEqual([])
  })

  it("removes an ended section, and the list, its extension and the extension list when nothing else is in them", () => {
    const parts = deck(list(sectioned))
    const merged = writeSections(parts, [same[0]!, { from: 1, slides: ["257", "258", "259"] }])
    expect(xml(merged)).toBe(
      xml(parts).replace(
        section("Numbers", numbers, ["257", "258"]) + section("Close", closing, ["259"]),
        section("Numbers", numbers, ["257", "258", "259"]),
      ),
    )
    expect(xml(writeSections(parts, []))).toBe(xml(deck("")))
    const shared = deck(list(sectioned, '<p:ext uri="{X}"><p15:other xmlns:p15="q"/></p:ext>'))
    expect(xml(writeSections(shared, []))).toBe(
      xml(deck('<p:extLst><p:ext uri="{X}"><p15:other xmlns:p15="q"/></p:ext></p:extLst>')),
    )
  })

  it("keeps an ended section that a zoom still names, empty and in its place", () => {
    const zoom = `<psez:sectionZmObj xmlns:psez="z" sectionId="${numbers}"/>`
    const parts = deck(list(sectioned), slides, zoom)
    const written = writeSections(parts, [{ from: 0, slides: ["256", "257", "258"] }, same[2]!])
    expect(xml(written)).toBe(
      xml(parts).replace(
        section("Opening &amp; plan", opening, ["256"]) + section("Numbers", numbers, ["257", "258"]),
        section("Opening &amp; plan", opening, ["256", "257", "258"]) +
          `<p14:section name="Numbers" id="${numbers}"><p14:sldIdLst/></p14:section>`,
      ),
    )
    expect(sectionListFailures(written)).toEqual([])
  })

  it("gives every slide to the first section a zoom names when every section ends", () => {
    const zoom = `<psez:sectionZmObj xmlns:psez="z" sectionId="${closing}"/>`
    const parts = deck(list(sectioned), slides, zoom)
    const written = writeSections(parts, [])
    expect(xml(written)).toBe(xml(parts).replace(sectioned, section("Close", closing, slides)))
    expect(sectionListFailures(written)).toEqual([])
  })

  it("renames a section by its name value alone", () => {
    const parts = deck(list(sectioned))
    const written = writeSections(parts, [same[0]!, { ...same[1]!, name: 'Costs & "risks"' }, same[2]!])
    expect(xml(written)).toBe(xml(parts).replace('name="Numbers"', 'name="Costs &amp; &quot;risks&quot;"'))
    expect(readSections(written).map((read) => read.name)).toEqual(["Opening & plan", 'Costs & "risks"', "Close"])
    expect(xml(writeSections(parts, [same[0]!, { ...same[1]!, name: "" }, same[2]!]))).toBe(
      xml(parts).replace('name="Numbers"', 'name="Untitled Section"'),
    )
  })

  it("appends the section extension to a file with no sections, declared the way PowerPoint declares it", () => {
    const plan: readonly SectionPlan[] = [
      { key: "a", name: "Opening", slides: ["256", "257"] },
      { key: "b", slides: ["258", "259"] },
    ]
    const sections =
      section("Opening", keyedSectionId("a"), ["256", "257"]) +
      section("Untitled Section", keyedSectionId("b"), ["258", "259"])
    expect(xml(writeSections(deck(""), plan))).toBe(xml(deck(list(sections))))
    const other = '<p:ext uri="{X}"><p15:other xmlns:p15="q"/></p:ext>'
    expect(xml(writeSections(deck(`<p:extLst>${other}</p:extLst>`), plan))).toBe(xml(deck(list(sections, other))))
    expect(sectionListFailures(writeSections(deck(""), plan))).toEqual([])
  })

  it("refuses sections that are not the slide order cut into runs", () => {
    const parts = deck(list(sectioned))
    expect(() => writeSections(parts, [same[0]!, same[1]!])).toThrow("section")
    expect(() => writeSections(parts, [same[1]!, same[0]!, same[2]!])).toThrow("section")
    expect(() => writeSections(parts, [same[0]!, { from: 0, slides: ["257", "258"] }, same[2]!])).toThrow("section")
    expect(() => writeSections(parts, [...same, { from: 7, slides: [] }])).toThrow("section")
    expect(() =>
      writeSections(deck(""), [
        { key: "a", slides: ["256", "257"] },
        { key: "a", slides: ["258", "259"] },
      ]),
    ).toThrow("section")
  })
})

describe("the section routes", () => {
  it("leave every slide in one section, in the slide order", async () => {
    const sectioned = await fixture("sections-before.pptx")
    const clean = await fixture("clean.pptx")
    expect(sectionListFailures(applyStructuralRoute(clean, { name: "sectionLst.add", title: "Part" }))).toEqual([])
    expect(
      sectionListFailures(applyStructuralRoute(sectioned, { name: "sectionLst.remove", section: opening })),
    ).toEqual([])
    expect(
      sectionListFailures(
        applyStructuralRoute(sectioned, { name: "sectionLst.order", section: numbers, before: opening }),
      ),
    ).toEqual([])
  })
})
