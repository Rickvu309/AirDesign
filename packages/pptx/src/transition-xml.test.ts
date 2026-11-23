import {
  decide,
  elementId,
  format,
  openRegister,
  slideId,
  type Command,
  type ElementPatch,
  type Register,
  type SlideCommand,
  type TransitionValue,
} from "@airdesign/document"
import { orderKeyBetween } from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { exportParts, indexPackage, orderedParts, readParts, readShows, readSlides } from "./index.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { readArrival, readPlayback } from "./transition-read.js"
import { writeArrival } from "./transition-write.js"

declare const process: { cwd(): string; getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array } }

const { readFileSync } = process.getBuiltinModule("node:fs")
const encode = encodeUtf8
const text = (bytes: Uint8Array | undefined) => (bytes === undefined ? "" : decodeUtf8(bytes))
const clicked = { click: true } as const
const noneClick: TransitionValue = { none: { advance: clicked } }
const dissolve: TransitionValue = { dissolve: { duration: 500, advance: clicked } }
const p14 = "http://schemas.microsoft.com/office/powerpoint/2010/main"

const powerpointPush = `
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="5" name="Title 4"><a:extLst><a:ext uri="{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}"><a16:creationId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" id="{97F53E6F-9CFC-304F-9325-CA0D0F3F8EEB}"/></a:ext></a:extLst></p:cNvPr><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="2398714" y="184151"/><a:ext cx="8269287" cy="519113"/></a:xfrm></p:spPr><p:txBody><a:bodyPr wrap="square" anchor="ctr"><a:normAutofit/></a:bodyPr><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>Convolutional Neural Networks</a:t></a:r><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="4" name="Slide Number Placeholder 3"><a:extLst><a:ext uri="{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}"><a16:creationId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" id="{D92D1192-8E1A-DC4A-B836-FE2D03553C2D}"/></a:ext></a:extLst></p:cNvPr><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldNum" sz="quarter" idx="12"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="8216901" y="6548438"/><a:ext cx="2365375" cy="279400"/></a:xfrm></p:spPr><p:txBody><a:bodyPr wrap="square" anchor="ctr"><a:normAutofit/></a:bodyPr><a:lstStyle/><a:p><a:pPr><a:spcAft><a:spcPts val="600"/></a:spcAft><a:defRPr/></a:pPr><a:fld id="{2D0975A0-1B68-3341-9890-EAA20A69F5C9}" type="slidenum"><a:rPr lang="en-US" altLang="en-US" smtClean="0"/><a:pPr><a:spcAft><a:spcPts val="600"/></a:spcAft><a:defRPr/></a:pPr><a:t>4</a:t></a:fld><a:endParaRPr lang="en-US" altLang="en-US"/></a:p></p:txBody></p:sp><p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="8" name="Content Placeholder 5"><a:extLst><a:ext uri="{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}"><a16:creationId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" id="{876B214C-E979-B29B-9B0C-D7B0BEAE8DF3}"/></a:ext></a:extLst></p:cNvPr><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr><p:ph idx="1"/><p:extLst><p:ext uri="{D42A27DB-BD31-4B8C-83A1-F6EECF244321}"><p14:modId xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" val="4165227395"/></p:ext></p:extLst></p:nvPr></p:nvGraphicFramePr><p:xfrm><a:off x="536065" y="1330037"/><a:ext cx="11119870" cy="4861524"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/diagram"><dgm:relIds xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:dm="rId2" r:lo="rId3" r:qs="rId4" r:cs="rId5"/></a:graphicData></a:graphic></p:graphicFrame></p:spTree><p:extLst><p:ext uri="{BB962C8B-B14F-4D97-AF65-F5344CB8AC3E}"><p14:creationId xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" val="3497471608"/></p:ext></p:extLst></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr><p:transition spd="slow"><p:push dir="u"/></p:transition></p:sld>`

function slide(inner: string): Uint8Array {
  return encode(`<p:sld><p:cSld><p:spTree/></p:cSld>${inner}</p:sld>`)
}

function partOf(bytes: Uint8Array): Map<string, Uint8Array> {
  return new Map([["ppt/slides/slide1.xml", bytes]])
}

function written(bytes: Uint8Array, value: TransitionValue): string {
  return text(writeArrival(partOf(bytes), "ppt/slides/slide1.xml", value).get("ppt/slides/slide1.xml"))
}

function landed(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function exported(parts: ReadonlyMap<string, Uint8Array>, rows: readonly (readonly [string, ElementPatch])[]) {
  const file = readSlides(parts).map((each) => slideId(each.slide))
  let register: Register = { ...openRegister("", "deck"), file, order: [] }
  for (const [node, patch] of rows) {
    const id = elementId(node)
    if (!register.nodes.includes(id))
      register = landed(register, { command: "add", node: id, floor: "", route: "deck" })
    register = landed(register, { command: "person", node: id, v: format, patch })
  }
  return exportParts(orderedParts(parts, register), register)
}

describe("a slide transition", () => {
  it("reads a PowerPoint fade as dissolve and leaves the file untouched when that value is set again", async () => {
    const parts = await readParts(
      readFileSync(`${process.cwd()}/scripts/pptx-fixtures/corpus/nasa-ixpe-science-ops.pptx`),
    )
    const first = readSlides(parts)[0]
    if (first === undefined) throw new Error("slide")
    const bytes = parts.get(first.part)
    expect(readArrival(bytes)).toEqual({ state: "value", value: dissolve })
    expect(readPlayback(bytes).transition).toEqual({ kind: "fade", direction: null, duration: 500 })
    const node = `${first.slide}.slide`
    const again = exported(parts, [[node, { transition: { value: { set: dissolve } } }]])
    expect(again.get(first.part)).toBe(parts.get(first.part))
    const slower: TransitionValue = { dissolve: { duration: 750, advance: clicked } }
    const next = exported(parts, [[node, { transition: { value: { set: slower } } }]])
    expect(text(next.get(first.part))).toContain(
      `<p:transition xmlns:p14="${p14}" spd="med" p14:dur="750"><p:fade/></p:transition>`,
    )
    const opened = exported(parts, [
      [node, { transition: { value: { set: slower } } }],
      [node, { transition: { value: "opening" } }],
    ])
    expect(opened.get(first.part)).toBe(parts.get(first.part))
  })

  it("reads a PowerPoint push and leaves those bytes when the same arrival is set again", async () => {
    const bytes = encode(powerpointPush)
    const push: TransitionValue = { push: { direction: "bottom", duration: 1000, advance: clicked } }
    expect(readArrival(bytes)).toEqual({ state: "value", value: push })
    expect(readPlayback(bytes).transition).toEqual({ kind: "push", direction: "u", duration: 1000 })
    const blank = await readParts(readFileSync(`${process.cwd()}/scripts/pptx-fixtures/blank.pptx`))
    const first = readSlides(blank)[0]
    if (first === undefined) throw new Error("slide")
    const parts = new Map(blank)
    parts.set(first.part, bytes)
    const again = exported(parts, [[`${first.slide}.slide`, { transition: { value: { set: push } } }]])
    expect(again.get(first.part)).toBe(bytes)
    expect(text(again.get(first.part))).toContain(`<p:transition spd="slow"><p:push dir="u"/></p:transition>`)
  })

  it("keeps a wipe, a sound, an exact duration, and an alternate-content transition", async () => {
    const wipe = await readParts(
      readFileSync(`${process.cwd()}/scripts/pptx-fixtures/corpus/nasa-cots-electronics.pptx`),
    )
    const wiped = readSlides(wipe)[1]
    if (wiped === undefined) throw new Error("wipe")
    expect(readArrival(wipe.get(wiped.part)).state).toBe("kept")
    expect(readPlayback(wipe.get(wiped.part))).toEqual({
      transition: { kind: "wipe", direction: "l", duration: 1000 },
      advance: null,
    })
    const pumps = await readParts(readFileSync(`${process.cwd()}/scripts/pptx-fixtures/doe-heat-pumps.pptx`))
    const ninth = readSlides(pumps).find((each) => each.part.endsWith("slide9.xml"))
    if (ninth === undefined) throw new Error("slide 9")
    expect(readArrival(pumps.get(ninth.part)).state).toBe("kept")
    expect(readPlayback(pumps.get(ninth.part))).toEqual({ transition: null, advance: null })
    const sound = slide(`<p:transition><p:fade/><p:sndAc><p:stSnd/></p:sndAc></p:transition>`)
    expect(readArrival(sound).state).toBe("kept")
    expect(readPlayback(sound).transition?.kind).toBe("fade")
    const exact = slide(`<p:transition p14:dur="3"><p:fade/></p:transition>`)
    expect(readArrival(exact).state).toBe("kept")
    expect(readPlayback(exact).transition).toEqual({ kind: "fade", direction: null, duration: 3 })
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
    expect(readPlayback(encode(morphed))).toEqual({
      transition: { kind: "morph", direction: null, duration: 1200 },
      advance: null,
    })
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
    expect(readPlayback(byWord).transition?.kind).toBe("morph")
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

  it("copies a slide's transition when the slide is duplicated and leaves the source bytes", async () => {
    const parts = await readParts(readFileSync(`${process.cwd()}/scripts/pptx-fixtures/blank.pptx`))
    const first = readSlides(parts)[0]
    if (first === undefined) throw new Error("slide")
    const faded = text(parts.get(first.part)).replace("</p:sld>", "<p:transition><p:fade/></p:transition></p:sld>")
    const seeded = new Map(parts).set(first.part, encode(faded))
    const copy = slideId("900")
    const clone: SlideCommand = {
      slide: "clone",
      id: copy,
      source: slideId(first.slide),
      key: orderKeyBetween(null, null),
      floor: [],
    }
    const file = readSlides(seeded).map((each) => slideId(each.slide))
    let register: Register = { ...openRegister("", "deck"), file, order: [clone] }
    const next = exportParts(orderedParts(seeded, register), register)
    const cloned = readSlides(next).find((each) => each.slide === "900")
    if (cloned === undefined) throw new Error("clone")
    expect(text(next.get(first.part))).toBe(faded)
    expect(text(next.get(cloned.part))).toContain("<p:transition><p:fade/></p:transition>")
    expect(readArrival(next.get(cloned.part))).toEqual({ state: "value", value: dissolve })
  })

  it("plays a plain push and does not play the fallback inside alternate content", () => {
    expect(readPlayback(slide(`<p:transition spd="med"><p:push dir="r"/></p:transition>`))).toEqual({
      transition: { kind: "push", direction: "r", duration: 750 },
      advance: null,
    })
    expect(readPlayback(slide(`<p:transition spd="slow" advTm="3000"/>`))).toEqual({
      transition: null,
      advance: 3000,
    })
    expect(readShows(new Map()).length).toBe(0)
  })
})
