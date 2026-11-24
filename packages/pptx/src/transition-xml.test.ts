import { type TransitionValue } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { indexPackage, readParts, readSlides } from "./index.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { readArrival } from "./transition-read.js"
import { writeArrival } from "./transition-write.js"

declare const process: { cwd(): string; getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array } }

const { readFileSync } = process.getBuiltinModule("node:fs")
const encode = encodeUtf8
const text = (bytes: Uint8Array | undefined) => (bytes === undefined ? "" : decodeUtf8(bytes))
const clicked = { click: true } as const
const noneClick: TransitionValue = { none: { advance: clicked } }
const dissolve: TransitionValue = { dissolve: { duration: 500, advance: clicked } }
const p14 = "http://schemas.microsoft.com/office/powerpoint/2010/main"

function slide(inner: string): Uint8Array {
  return encode(`<p:sld><p:cSld><p:spTree/></p:cSld>${inner}</p:sld>`)
}

function partOf(bytes: Uint8Array): Map<string, Uint8Array> {
  return new Map([["ppt/slides/slide1.xml", bytes]])
}

function written(bytes: Uint8Array, value: TransitionValue): string {
  return text(writeArrival(partOf(bytes), "ppt/slides/slide1.xml", value).get("ppt/slides/slide1.xml"))
}

describe("a slide transition", () => {
  it("keeps a wipe, a sound, an exact duration, and an alternate-content transition", async () => {
    const wipe = await readParts(
      readFileSync(`${process.cwd()}/scripts/pptx-fixtures/corpus/nasa-cots-electronics.pptx`),
    )
    const wiped = readSlides(wipe)[1]
    if (wiped === undefined) throw new Error("wipe")
    expect(readArrival(wipe.get(wiped.part)).state).toBe("kept")
    const pumps = await readParts(readFileSync(`${process.cwd()}/scripts/pptx-fixtures/doe-heat-pumps.pptx`))
    const ninth = readSlides(pumps).find((each) => each.part.endsWith("slide9.xml"))
    if (ninth === undefined) throw new Error("slide 9")
    expect(readArrival(pumps.get(ninth.part)).state).toBe("kept")
    const sound = slide(`<p:transition><p:fade/><p:sndAc><p:stSnd/></p:sndAc></p:transition>`)
    expect(readArrival(sound).state).toBe("kept")
    const exact = slide(`<p:transition p14:dur="3"><p:fade/></p:transition>`)
    expect(readArrival(exact).state).toBe("kept")
  })

  it("writes each offered kind in PowerPoint's form and reads that form back", () => {
    const push: TransitionValue = { push: { direction: "right", duration: 750, advance: { delay: 2000 } } }
    const moveIn: TransitionValue = { moveIn: { direction: "left", duration: 500, advance: clicked } }
    const moveOut: TransitionValue = { moveOut: { direction: "bottom", duration: 1000, advance: clicked } }
    const host = slide(`<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr><p:timing><p:tnLst/></p:timing>`)
    const pushed = written(host, push)
    expect(pushed).toContain(
      `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr><p:transition xmlns:p14="${p14}" spd="med" p14:dur="750" advClick="0" advTm="2000"><p:push dir="l"/></p:transition><p:timing><p:tnLst/></p:timing>`,
    )
    expect(readArrival(encode(pushed))).toEqual({ state: "value", value: push })
    expect(written(slide(""), moveIn)).toContain(
      `<p:transition xmlns:p14="${p14}" spd="fast" p14:dur="500"><p:cover dir="l"/></p:transition>`,
    )
    expect(readArrival(encode(written(slide(""), moveIn)))).toEqual({ state: "value", value: moveIn })
    expect(written(slide(""), moveOut)).toContain(`spd="slow" p14:dur="1000"><p:pull dir="d"/></p:transition>`)
    expect(readArrival(encode(written(slide(""), moveOut)))).toEqual({ state: "value", value: moveOut })
    expect(readArrival(slide(`<p:transition><p:push/></p:transition>`))).toEqual({
      state: "value",
      value: { push: { direction: "right", duration: 500, advance: clicked } },
    })
    expect(readArrival(slide(`<p:transition><p:cover/></p:transition>`))).toEqual({
      state: "value",
      value: { moveIn: { direction: "left", duration: 500, advance: clicked } },
    })
    expect(written(slide(`<p:transition><p:fade/></p:transition>`), noneClick)).toBe(
      `<p:sld><p:cSld><p:spTree/></p:cSld></p:sld>`,
    )
    const delayed = written(slide(""), { none: { advance: { delay: 1500 } } })
    expect(delayed).toContain(`<p:transition advClick="0" advTm="1500"/>`)
    expect(readArrival(encode(delayed))).toEqual({ state: "value", value: { none: { advance: { delay: 1500 } } } })
  })

  it("writes Smart animate as PowerPoint's Morph with a fade for older readers, and reads it back", () => {
    const smart: TransitionValue = { smartAnimate: { duration: 1200, advance: clicked } }
    const host = slide(`<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr><p:transition><p:fade/></p:transition>`)
    const morphed = written(host, smart)
    expect(morphed).toContain(
      `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr><mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice xmlns:p159="http://schemas.microsoft.com/office/powerpoint/2015/09/main" Requires="p159"><p:transition xmlns:p14="${p14}" spd="slow" p14:dur="1200"><p159:morph option="byObject"/></p:transition></mc:Choice><mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback></mc:AlternateContent></p:sld>`,
    )
    expect(readArrival(encode(morphed))).toEqual({ state: "value", value: smart })
    const delayed: TransitionValue = { smartAnimate: { duration: 500, advance: { delay: 2000 } } }
    const later = written(slide(""), delayed)
    expect(later).toContain(`<mc:Fallback><p:transition spd="fast" advClick="0" advTm="2000"><p:fade/></p:transition>`)
    expect(readArrival(encode(later))).toEqual({ state: "value", value: delayed })
    expect(written(encode(morphed), dissolve)).not.toContain("mc:AlternateContent")
  })

  it("reads PowerPoint's own Morph by object and keeps Morph by word untouched", () => {
    const powerpoint = slide(
      `<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice xmlns:p159="http://schemas.microsoft.com/office/powerpoint/2015/09/main" Requires="p159"><p:transition spd="slow" p14:dur="2000"><p159:morph option="byObject"/></p:transition></mc:Choice><mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>`,
    )
    const smart: TransitionValue = { smartAnimate: { duration: 2000, advance: clicked } }
    expect(readArrival(powerpoint)).toEqual({ state: "value", value: smart })
    const byWord = slide(
      `<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice xmlns:p159="http://schemas.microsoft.com/office/powerpoint/2015/09/main" Requires="p159"><p:transition spd="slow" p14:dur="2000"><p159:morph option="byWord"/></p:transition></mc:Choice><mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>`,
    )
    expect(readArrival(byWord)).toEqual({ state: "kept" })
  })

  it("refuses to splice a transition into markup it cannot parse", () => {
    const broken = encode("<p:sld><p:transition>")
    expect(readArrival(broken)).toEqual({ state: "kept" })
    expect(() => writeArrival(partOf(broken), "ppt/slides/slide1.xml", dissolve)).toThrow("transition")
    const open = encode("<p:sld>")
    expect(readArrival(open)).toEqual({ state: "value", value: noneClick })
    expect(() => writeArrival(partOf(open), "ppt/slides/slide1.xml", dissolve)).toThrow("transition")
  })

  it("stores a non-default arrival on the index and omits on click with none", () => {
    const bare = slide("")
    const faded = slide("<p:transition><p:fade/></p:transition>")
    const kept = slide(`<p:transition spd="slow"><p:wipe/></p:transition>`)
    const parts = new Map<string, Uint8Array>([
      [
        "ppt/presentation.xml",
        encode(
          `<p:presentation><p:sldIdLst><p:sldId id="256" r:id="r0"/><p:sldId id="257" r:id="r1"/><p:sldId id="258" r:id="r2"/></p:sldIdLst></p:presentation>`,
        ),
      ],
      [
        "ppt/_rels/presentation.xml.rels",
        encode(
          `<Relationships><Relationship Id="r0" Type="x/slide" Target="slides/slide1.xml"/><Relationship Id="r1" Type="x/slide" Target="slides/slide2.xml"/><Relationship Id="r2" Type="x/slide" Target="slides/slide3.xml"/></Relationships>`,
        ),
      ],
      ["ppt/slides/slide1.xml", bare],
      ["ppt/slides/slide2.xml", faded],
      ["ppt/slides/slide3.xml", kept],
    ])
    expect(indexPackage(parts).slides.map((slide) => slide.transition ?? null)).toEqual([null, dissolve, "kept"])
  })
})
