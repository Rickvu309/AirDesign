declare const process: { cwd(): string; getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array } }
import { elementId, nextSlideId, orderKeyAfter, presentSlides, slideId, type SlideCommand } from "@airdesign/document"
import { expect, it } from "vitest"
import { elementOrderLines } from "../../../scripts/element-order-export.mjs"
import { orderedParts, readParts, readShapes, shapeSiblings } from "./index.js"
import { decodeUtf8 } from "./package-bytes.js"

const { readFileSync } = process.getBuiltinModule("node:fs")
const text = (bytes: Uint8Array | undefined) => (bytes === undefined ? "" : decodeUtf8(bytes))
const xml = (value: string) => Uint8Array.from(value, (letter) => letter.charCodeAt(0))

const innerA = `<p:sp><p:nvSpPr><p:cNvPr id="3" name="a"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="1" y="2"/><a:ext cx="3" cy="4"/></a:xfrm></p:spPr></p:sp>`
const innerB = `<p:sp><p:nvSpPr><p:cNvPr id="5" name="b"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="2" y="3"/><a:ext cx="4" cy="5"/></a:xfrm></p:spPr></p:sp>`
const group = `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="2" name="g"/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="10" y="20"/><a:ext cx="30" cy="40"/></a:xfrm></p:grpSpPr>${innerA}${innerB}</p:grpSp>`
const placeholder = `<p:sp><p:nvSpPr><p:cNvPr id="8" name="ph"/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1" cy="1"/></a:xfrm></p:spPr></p:sp>`
const frame = `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="4" name="t"/></p:nvGraphicFramePr><a:graphic><a:graphicData><a:tbl/></a:graphicData></a:graphic></p:graphicFrame>`
const alternate = `<mc:AlternateContent><mc:Choice Requires="a"><p:sp><p:nvSpPr><p:cNvPr id="6" name="c"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="6" y="7"/><a:ext cx="8" cy="9"/></a:xfrm></p:spPr></p:sp></mc:Choice><mc:Fallback><p:sp><p:nvSpPr><p:cNvPr id="7" name="d"/></p:nvSpPr><p:spPr/></p:sp></mc:Fallback></mc:AlternateContent>`
const timing = `<p:timing><p:tnLst><p:par><p:cTn><p:childTnLst><p:set><p:cBhvr><p:tgtEl><p:spTgt spid="6"/></p:tgtEl></p:cBhvr></p:set></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`
const slide = `<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1" cy="1"/></a:xfrm></p:grpSpPr>${group}${placeholder}${frame}${alternate}</p:spTree></p:cSld>${timing}</p:sld>`
const file = [slideId("258")]
const part = "ppt/slides/slide1.xml"

function packaged(body: string) {
  return new Map<string, Uint8Array>([
    [
      "ppt/presentation.xml",
      xml('<p:presentation><p:sldIdLst><p:sldId id="258" r:id="rId1"/></p:sldIdLst></p:presentation>'),
    ],
    [
      "ppt/_rels/presentation.xml.rels",
      xml(
        '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>',
      ),
    ],
    [part, xml(body)],
  ])
}

function order(node: string, before: string | null, among: readonly string[]): SlideCommand {
  return {
    slide: "element-order",
    id: file[0]!,
    node: elementId(node),
    before: before === null ? null : elementId(before),
    among: among.map((id) => elementId(id)),
  }
}

it("reorders a fixture that has a group and a graphic frame without dropping a child", async () => {
  const pack = await readParts(readFileSync(`${process.cwd()}/scripts/pptx-fixtures/census-updating-spm.pptx`))
  expect(
    elementOrderLines({ pptx: await import("./index.js"), parts: new Map([["census-updating-spm.pptx", pack]]) }),
  ).toEqual([])
})

it("lists the shapes that share a parent, back to front, and refuses a fallback id", () => {
  const parts = packaged(slide)
  const ids = (node: string) => shapeSiblings(parts, elementId(node))?.map((id) => String(id)) ?? null
  expect(ids("258.8")).toEqual(["258.2", "258.8", "258.4", "258.6"])
  expect(ids("258.3")).toEqual(["258.3", "258.5"])
  expect(ids("258.7")).toBeNull()
  expect(ids("258.1")).toBeNull()
})

it("moves one shape past a group, a graphic frame and alternate content without rewriting them", () => {
  const original = packaged(slide)
  const changed = orderedParts(original, {
    file,
    order: [order("258.8", null, ["258.2", "258.8", "258.4", "258.6"])],
  })
  const after = text(changed.get(part))
  const pieces = [group, frame, alternate, placeholder]
  expect(after.indexOf(frame)).toBeGreaterThan(after.indexOf(group))
  expect(after.indexOf(alternate)).toBeGreaterThan(after.indexOf(frame))
  expect(after.indexOf(placeholder)).toBeGreaterThan(after.indexOf(alternate))
  for (const piece of [...pieces, timing]) expect(after.split(piece)).toHaveLength(2)
  expect(after).toContain(timing)
  for (const [name, bytes] of original) if (name !== part) expect(changed.get(name)).toEqual(bytes)
})

it("reorders inside a group and leaves the graphic frame, the timing and the other shapes untouched", () => {
  const original = packaged(slide)
  const changed = orderedParts(original, { file, order: [order("258.3", null, ["258.3", "258.5"])] })
  const after = text(changed.get(part))
  const moved = group.replace(`${innerA}${innerB}`, `${innerB}${innerA}`)
  expect(after).toContain(moved)
  expect(after).not.toContain(`${innerA}${innerB}`)
  for (const piece of [frame, alternate, placeholder, timing]) expect(after.split(piece)).toHaveLength(2)
  expect(after.indexOf(group.slice(0, 20))).toBeLessThan(after.indexOf(placeholder))
})

it("refuses to move a grouped shape out of its group", () => {
  expect(() => orderedParts(packaged(slide), { file, order: [order("258.3", null, ["258.3", "258.4"])] })).toThrow(
    "shape",
  )
})

it("keeps a copy at the order its slide had, then lets a later order change only the original", async () => {
  const original = await readParts(readFileSync(`${process.cwd()}/scripts/pptx-fixtures/clean.pptx`))
  const id = slideId("256")
  const added = elementId("256.9")
  const element = {
    node: added,
    kind: "shape" as const,
    value: "",
    box: { x: 0, y: 0, cx: 10, cy: 10 },
    grouped: false,
  }
  const add: SlideCommand = { slide: "element-add", id, element }
  const front: SlideCommand = {
    slide: "element-order",
    id,
    node: elementId("256.2"),
    before: null,
    among: [elementId("256.2"), added],
  }
  const key = orderKeyAfter(presentSlides({ file: [id], order: [add, front] }), id)
  if (key === null) throw new Error("key")
  const copy = nextSlideId([id])
  const clone: SlideCommand = { slide: "clone", id: copy, source: id, key }
  const back: SlideCommand = {
    slide: "element-order",
    id,
    node: added,
    before: null,
    among: [elementId("256.9"), elementId("256.2")],
  }
  const written = orderedParts(original, { file: [id], order: [add, front, clone, back] })
  const shapes = (slideId: string) =>
    readShapes(written)
      .filter((shape) => shape.slide === slideId)
      .map((shape) => shape.shape)
  expect(shapes("256")).toEqual(["2", "9"])
  expect(shapes(copy)).toEqual(["9", "2"])
})
