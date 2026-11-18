import {
  decide,
  elementId,
  format,
  openRegister,
  orderKeyBetween,
  slideId,
  type Command,
  type ElementPatch,
  type Register,
  type SlideCommand,
  type TransitionValue,
} from "@airdesign/document"
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
