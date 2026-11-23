import { expect, it } from "vitest"
import { applyRoute, exportPackage, readPackage, readShows } from "./index.js"
import { decodeUtf8, encodeUtf8 as encode } from "./package-bytes.js"

const choice = (inner: string) =>
  `<mc:AlternateContent><mc:Choice Requires="p14"><p:transition spd="slow" p14:dur="1200">${inner}</p:transition></mc:Choice><mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>`

const slides = [
  `<p:sld><p:cSld><p:spTree/></p:cSld><p:transition spd="fast"><p:fade/></p:transition></p:sld>`,
  `<p:sld show="0"><p:cSld><p:spTree/></p:cSld></p:sld>`,
  `<p:sld><p:cSld><p:spTree/></p:cSld>${choice(`<p14:vortex dir="r"/>`)}</p:sld>`,
  `<p:sld><p:cSld><p:spTree/></p:cSld>${choice(`<p:push dir="u"/>`)}</p:sld>`,
  `<p:sld show="1"><p:cSld><p:spTree/></p:cSld><p:transition><p:wipe dir="d"/></p:transition></p:sld>`,
  `<p:sld><p:cSld><p:spTree/></p:cSld><p:transition spd="slow" advTm="3000"/></p:sld>`,
  `<p:sld><p:cSld><p:spTree/></p:cSld><p:transition spd="med"><p:push/></p:transition></p:sld>`,
]

const parts = new Map([
  [
    "ppt/presentation.xml",
    encode(
      `<p:presentation><p:sldIdLst>${slides.map((_, at) => `<p:sldId id="${256 + at}" r:id="r${at}"/>`).join("")}</p:sldIdLst></p:presentation>`,
    ),
  ],
  [
    "ppt/_rels/presentation.xml.rels",
    encode(
      `<Relationships>${slides.map((_, at) => `<Relationship Id="r${at}" Type="x/slide" Target="slides/slide${at + 1}.xml"/>`).join("")}</Relationships>`,
    ),
  ],
  ...slides.map((xml, at): [string, Uint8Array] => [`ppt/slides/slide${at + 1}.xml`, encode(xml)]),
])

it("reads which slides a show skips and how each one comes in", () => {
  const shows = readShows(parts)
  expect(shows.map((show) => show.part)).toEqual(slides.map((_, at) => `ppt/slides/slide${at + 1}.xml`))
  expect(shows.map((show) => show.hidden)).toEqual([false, true, false, false, false, false, false])
  expect(shows.map((show) => show.transition)).toEqual([
    { kind: "fade", direction: null, duration: 500 },
    null,
    null,
    null,
    { kind: "wipe", direction: "d", duration: 500 },
    null,
    { kind: "push", direction: "l", duration: 750 },
  ])
  expect(shows.map((show) => show.advance)).toEqual([null, null, null, null, null, 3000, null])
})

it("reads nothing from a package without slides", () => {
  expect(readShows(new Map())).toEqual([])
})

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

it("keeps a hidden slide hidden and its transition through an edit and an export", async () => {
  const original = process.getBuiltinModule("node:fs").readFileSync(`${process.cwd()}/scripts/pptx-fixtures/blank.pptx`)
  const read = await readPackage(original)
  if (!read.ok) throw new Error("blank")
  const part = "ppt/slides/slide1.xml"
  const xml = decodeUtf8(read.parts.get(part)!)
    .replace(/<p:sld\b/, '<p:sld show="0"')
    .replace("</p:sld>", '<p:transition spd="med"><p:push dir="r"/></p:transition></p:sld>')
  const parts = new Map(read.parts).set(part, encode(xml))
  const value = [{ from: 0, runs: [{ from: -1, text: "Hidden but kept" }] }]
  const written = applyRoute(parts, { name: "text", part, shape: "2", value })
  const exported = await readPackage(await exportPackage(original, written))
  if (!exported.ok) throw new Error("export")
  expect(exported.parts.get(part)).toEqual(written.get(part))
  expect(decodeUtf8(exported.parts.get(part)!)).toContain('show="0"')
  expect(readShows(exported.parts)).toEqual([
    expect.objectContaining({ part, hidden: true, transition: { kind: "push", direction: "r", duration: 750 } }),
  ])
})
