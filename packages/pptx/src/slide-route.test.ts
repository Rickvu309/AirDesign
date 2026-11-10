import { describe, expect, it } from "vitest"
import { markupDocument } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { applyRoute, writeRoute } from "./slide-route.js"
import type { TextValue } from "@airdesign/document"

const slide = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="Rectangle 2"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="457200"/><a:ext cx="5486400" cy="1828800"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr/><a:r><a:rPr lang="en-US" sz="3200"><a:solidFill><a:schemeClr val="dk1"/></a:solidFill></a:rPr><a:t>Hello</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`
const part = "ppt/slides/slide1.xml"
const kept = "ppt/media/keep.bin"
const oneRun = (text: string): TextValue => [{ from: 0, runs: [{ from: 0, text }] }]

function parts(): Map<string, Uint8Array> {
  return new Map([
    [part, encodeUtf8(slide)],
    ["ppt/slides/slide2.xml", encodeUtf8("<p:sld/>")],
    ["ppt/slides/_rels/slide1.xml.rels", encodeUtf8("<Relationships/>")],
    ["[Content_Types].xml", encodeUtf8("<Types/>")],
    [kept, Uint8Array.from([1, 2, 3])],
  ])
}

function xml(map: ReadonlyMap<string, Uint8Array>): string {
  const bytes = map.get(part)
  if (bytes === undefined) throw new Error("part")
  return decodeUtf8(bytes)
}

describe("applyRoute", () => {
  it("replaces one shape's text and leaves every other byte", () => {
    const before = parts()
    const edited = applyRoute(before, { name: "text", part, shape: "2", value: oneRun("A & B") })
    expect(edited.get(kept)).toBe(before.get(kept))
    expect(xml(edited).replace("<a:t>A &amp; B</a:t>", "<a:t>Hello</a:t>")).toBe(slide)
    expect(xml(edited).indexOf("<a:pPr")).toBeLessThan(xml(edited).indexOf("<a:t>"))
    const back = applyRoute(edited, { name: "text", part, shape: "2", value: oneRun("Hello") })
    expect(back.get(part)).toEqual(before.get(part))
  })

  it("keeps the part object when the route changes nothing", () => {
    const before = parts()
    const sameText = applyRoute(before, { name: "text", part, shape: "2", value: oneRun("Hello") })
    const sameMove = applyRoute(before, { name: "move", part, shape: "2", x: 457200, y: 457200 })
    const sameSize = applyRoute(before, { name: "resize", part, shape: "2", cx: 5486400, cy: 1828800 })
    expect(sameText.get(part)).toBe(before.get(part))
    expect(sameMove.get(part)).toBe(before.get(part))
    expect(sameSize.get(part)).toBe(before.get(part))
    expect(sameText.get(kept)).toBe(before.get(kept))
  })

  it("leaves the other slide, relationships, and content types as the same object", () => {
    const before = parts()
    const routes = [
      { name: "text" as const, part, shape: "2", value: oneRun("A") },
      { name: "move" as const, part, shape: "2", x: 10, y: 20 },
      { name: "resize" as const, part, shape: "2", cx: 30, cy: 40 },
      { name: "add" as const, part, text: "New", x: 0, y: 0, cx: 1, cy: 1 },
      { name: "remove" as const, part, shape: "2" },
    ]
    for (const route of routes) {
      const edited = applyRoute(before, route)
      expect(edited.get("ppt/slides/slide2.xml")).toBe(before.get("ppt/slides/slide2.xml"))
      expect(edited.get("ppt/slides/_rels/slide1.xml.rels")).toBe(before.get("ppt/slides/_rels/slide1.xml.rels"))
      expect(edited.get("[Content_Types].xml")).toBe(before.get("[Content_Types].xml"))
      expect(edited.get(kept)).toBe(before.get(kept))
    }
  })

  it("moves and resizes one shape without the group transform", () => {
    const before = parts()
    const moved = applyRoute(before, { name: "move", part, shape: "2", x: 10, y: -20 })
    expect(moved.get(kept)).toBe(before.get(kept))
    expect(xml(moved).replace('<a:off x="10" y="-20"/>', '<a:off x="457200" y="457200"/>')).toBe(slide)
    expect(xml(moved)).toContain('<a:off x="0" y="0"/>')
    const resized = applyRoute(before, { name: "resize", part, shape: "2", cx: 100, cy: 200 })
    expect(xml(resized).replace('<a:ext cx="100" cy="200"/>', '<a:ext cx="5486400" cy="1828800"/>')).toBe(slide)
    expect(xml(resized)).toContain('<a:ext cx="0" cy="0"/>')
    const back = applyRoute(moved, { name: "move", part, shape: "2", x: 457200, y: 457200 })
    expect(back.get(part)).toEqual(before.get(part))
    const restored = applyRoute(resized, { name: "resize", part, shape: "2", cx: 5486400, cy: 1828800 })
    expect(restored.get(part)).toEqual(before.get(part))
  })

  it("resizes the transform extent when a markup extension comes first", () => {
    const uri = "{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}"
    const marked = slide.replace(
      "<p:cNvSpPr/><p:nvPr/>",
      `<p:cNvSpPr/><p:nvPr><a:extLst><a:ext uri="${uri}"/></a:extLst></p:nvPr>`,
    )
    const before = new Map<string, Uint8Array>([
      [part, encodeUtf8(marked)],
      [kept, Uint8Array.from([1, 2, 3])],
    ])
    const resized = applyRoute(before, { name: "resize", part, shape: "2", cx: 100, cy: 200 })
    expect(resized.get(kept)).toBe(before.get(kept))
    expect(xml(resized)).toContain(`<a:ext uri="${uri}"/>`)
    expect(xml(resized)).toContain('<a:ext cx="0" cy="0"/>')
    expect(xml(resized).replace('<a:ext cx="100" cy="200"/>', '<a:ext cx="5486400" cy="1828800"/>')).toBe(marked)
    const restored = applyRoute(resized, { name: "resize", part, shape: "2", cx: 5486400, cy: 1828800 })
    expect(restored.get(part)).toEqual(before.get(part))
  })

  it("writes a local transform on a placeholder that inherits its box", () => {
    const placeholder = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="4" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp></p:spTree></p:cSld></p:sld>`
    const before = new Map([[part, encodeUtf8(placeholder)]])
    const moved = applyRoute(before, { name: "move", part, shape: "4", x: 10, y: 20 })
    const movedBytes = moved.get(part)
    if (movedBytes === undefined) throw new Error("part")
    const movedXml = decodeUtf8(movedBytes)
    expect(markupDocument(movedBytes).wellFormed).toBe(true)
    expect(movedXml).toContain('<p:spPr><a:xfrm><a:off x="10" y="20"/></a:xfrm></p:spPr>')
    expect(movedXml).toContain('<p:ph type="title"/>')
    expect(movedXml).toContain('<a:off x="0" y="0"/>')
    const resized = applyRoute(before, { name: "resize", part, shape: "4", cx: 30, cy: 40 })
    const resizedBytes = resized.get(part)
    if (resizedBytes === undefined) throw new Error("part")
    const resizedXml = decodeUtf8(resizedBytes)
    expect(markupDocument(resizedBytes).wellFormed).toBe(true)
    expect(resizedXml).toContain('<p:spPr><a:xfrm><a:ext cx="30" cy="40"/></a:xfrm></p:spPr>')
    expect(resizedXml).toContain('<a:ext cx="0" cy="0"/>')
  })

  it("does not treat a longer shape id as the requested one", () => {
    const tree = `<p:spTree><p:sp><p:cNvPr id="20" name="Other"/><p:txBody><a:p><a:r><a:t>No</a:t></a:r></a:p></p:txBody><a:off x="1" y="1"/><a:ext cx="1" cy="1"/></p:sp><p:sp><p:cNvPr id="2" name="This"/><p:txBody><a:p><a:r><a:t>Yes</a:t></a:r></a:p></p:txBody><a:off x="2" y="2"/><a:ext cx="3" cy="4"/></p:sp></p:spTree>`
    const name = "ppt/slides/slide2.xml"
    const before = new Map([[name, encodeUtf8(tree)]])
    const edited = applyRoute(before, { name: "text", part: name, shape: "2", value: oneRun("Hi") })
    const next = decodeUtf8(edited.get(name) ?? encodeUtf8(""))
    expect(next).toContain('<p:cNvPr id="20" name="Other"/><p:txBody><a:p><a:r><a:t>No</a:t></a:r></a:p></p:txBody>')
    expect(next).toContain("<a:t>Hi</a:t>")
    expect(next).not.toContain("<a:t>Yes</a:t>")
  })

  it("adds a shape and removes that same shape back to the original bytes", () => {
    const before = parts()
    const added = writeRoute(before, { name: "add", part, text: "New", x: 0, y: 0, cx: 914400, cy: 457200 })
    expect(added.id).toBe("3")
    expect(added.parts.get(kept)).toBe(before.get(kept))
    expect(xml(added.parts)).toContain(`<p:cNvPr id="3" name="Shape 3"/>`)
    expect(xml(added.parts)).toContain("<a:t>New</a:t>")
    expect(xml(added.parts).indexOf("<a:pPr")).toBeLessThan(xml(added.parts).indexOf("<a:t>New</a:t>"))
    const back = applyRoute(added.parts, { name: "remove", part, shape: "3" })
    expect(back.get(part)).toEqual(before.get(part))
  })

  it("removes one shape and leaves the group and the other bytes", () => {
    const before = parts()
    const shape = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Rectangle 2"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="457200"/><a:ext cx="5486400" cy="1828800"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr/><a:r><a:rPr lang="en-US" sz="3200"><a:solidFill><a:schemeClr val="dk1"/></a:solidFill></a:rPr><a:t>Hello</a:t></a:r></a:p></p:txBody></p:sp>`
    const removed = applyRoute(before, { name: "remove", part, shape: "2" })
    expect(removed.get(kept)).toBe(before.get(kept))
    expect(xml(removed)).toBe(slide.replace(shape, ""))
    expect(xml(removed)).toContain('<p:cNvPr id="1" name=""/>')
  })

  it("refuses a missing part, a group id, and a fractional length", () => {
    const before = parts()
    expect(() => applyRoute(before, { name: "text", part: "missing", shape: "2", value: oneRun("A") })).toThrow(/part/)
    expect(() => applyRoute(before, { name: "text", part, shape: "1", value: oneRun("A") })).toThrow(/shape/)
    expect(() => applyRoute(before, { name: "move", part, shape: "2", x: 1.5, y: 0 })).toThrow(/emu/)
    expect(() => applyRoute(before, { name: "resize", part, shape: "2", cx: 1, cy: 1.2 })).toThrow(/emu/)
  })
})

const shape = (id: string, runs: string): string =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Shape ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="1" y="1"/><a:ext cx="5" cy="5"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:p>${runs}</a:p></p:txBody></p:sp>`
const picture = (id: string): string =>
  `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Picture ${id}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill/><p:spPr><a:xfrm><a:off x="9" y="9"/><a:ext cx="5" cy="5"/></a:xfrm></p:spPr></p:pic>`
const run = (text: string): string => `<a:r><a:t>${text}</a:t></a:r>`

function edited(tree: string, route: Parameters<typeof applyRoute>[1]): string {
  return xml(applyRoute(new Map([[part, encodeUtf8(`<p:spTree>${tree}</p:spTree>`)]]), route))
}

function refused(tree: string, value: TextValue, message: RegExp): void {
  const bytes = encodeUtf8(`<p:spTree>${tree}</p:spTree>`)
  const saved = Uint8Array.from(bytes)
  expect(() => applyRoute(new Map([[part, bytes]]), { name: "text", part, shape: "2", value })).toThrow(message)
  expect(bytes).toEqual(saved)
}

function shownText(slideXml: string): string {
  return [...slideXml.matchAll(/<a:t(?: [^>]*)?>([^<]*)<\/a:t>/g)].map((match) => match[1]).join("")
}

describe("applyRoute known failures", () => {
  it("removes the picture it was asked to remove, not the shape before it", () => {
    const next = edited(shape("2", run("Keep")) + picture("3"), { name: "remove", part, shape: "3" })
    expect(next).toContain('<p:cNvPr id="2"')
    expect(next).not.toContain('<p:cNvPr id="3"')
  })

  it("moves the picture it was asked to move, not the shape before it", () => {
    const next = edited(shape("2", run("Keep")) + picture("3"), { name: "move", part, shape: "3", x: 777, y: 777 })
    expect(next).toContain('<a:off x="1" y="1"/>')
    expect(next).toContain('<a:off x="777" y="777"/>')
  })

  it("retypes the first of two runs and keeps the second", () => {
    const value = [
      {
        from: 0,
        runs: [
          { from: 0, text: "New" },
          { from: 1, text: "world" },
        ],
      },
    ]
    const next = edited(shape("2", run("Hello ") + run("world")), { name: "text", part, shape: "2", value })
    expect(next).toContain("<a:r><a:t>New</a:t></a:r><a:r><a:t>world</a:t></a:r>")
    expect(next).not.toContain("Hello")
  })

  it("fills an empty first run and keeps the run after it", () => {
    const value = [
      {
        from: 0,
        runs: [
          { from: 0, text: "New" },
          { from: 1, text: "Keep" },
        ],
      },
    ]
    const next = edited(shape("2", `<a:r><a:t/></a:r>${run("Keep")}`), { name: "text", part, shape: "2", value })
    expect(next).toContain("<a:r><a:t>New</a:t></a:r><a:r><a:t>Keep</a:t></a:r>")
  })

  it("keeps a character XML forbids out of the slide", () => {
    const next = edited(shape("2", run("Old")), { name: "text", part, shape: "2", value: oneRun("a\u0001b") })
    expect(next).not.toContain("\u0001")
    expect(shownText(next)).toBe("ab")
  })
})

const pictureTree = `<p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="S"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="1" y="2"/><a:ext cx="3" cy="4"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>Shape</a:t></a:r></a:p></p:txBody></p:sp><p:pic><p:nvPicPr><p:cNvPr id="3" name="P"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/></p:blipFill><p:spPr><a:xfrm><a:off x="9" y="8"/><a:ext cx="7" cy="6"/></a:xfrm></p:spPr></p:pic></p:spTree>`

function pictureSpan() {
  const bytes = encodeUtf8(pictureTree)
  const found = markupDocument(bytes).elements.find((item) => item.kind === "p:pic")
  if (found === undefined) throw new Error("pic")
  return { bytes, found }
}

function outside(before: Uint8Array, after: Uint8Array, start: number, end: number): void {
  expect(after.subarray(0, start)).toEqual(before.subarray(0, start))
  expect(after.subarray(after.length - (before.length - end))).toEqual(before.subarray(end))
}

describe("applyRoute markup", () => {
  it("removes a picture whose open tag crosses a 64 KiB write", () => {
    const pictureAt = 65533
    const head = encodeUtf8(`<p:spTree><p:sp><p:cNvPr id="2"/><a:t>Keep</a:t></p:sp>`)
    const picture = encodeUtf8(`<p:pic><p:cNvPr id="3"/><a:off x="9" y="9"/></p:pic>`)
    const tail = encodeUtf8(`</p:spTree>`)
    const bytes = new Uint8Array(pictureAt + picture.length + tail.length)
    bytes.fill(32)
    bytes.set(head, 0)
    bytes.set(picture, pictureAt)
    bytes.set(tail, pictureAt + picture.length)
    const name = "ppt/slides/slide7.xml"
    const edited = applyRoute(new Map([[name, bytes]]), { name: "remove", part: name, shape: "3" })
    const after = edited.get(name)
    if (after === undefined) throw new Error("part")
    const joined = new Uint8Array(pictureAt + tail.length)
    joined.set(bytes.subarray(0, pictureAt), 0)
    joined.set(tail, pictureAt)
    expect(after).toEqual(joined)
    expect(markupDocument(after).wellFormed).toBe(true)
    expect(decodeUtf8(after)).toContain(">Keep<")
    expect(decodeUtf8(after)).not.toContain(`id="3"`)
  })

  it("removes picture 3 and keeps shape 2", () => {
    const { bytes, found } = pictureSpan()
    const name = "ppt/slides/slide3.xml"
    const edited = applyRoute(new Map([[name, bytes]]), { name: "remove", part: name, shape: "3" })
    const after = edited.get(name)
    if (after === undefined) throw new Error("part")
    const prefix = bytes.subarray(0, found.start)
    const suffix = bytes.subarray(found.end)
    const joined = new Uint8Array(prefix.length + suffix.length)
    joined.set(prefix, 0)
    joined.set(suffix, prefix.length)
    expect(after).toEqual(joined)
    expect(markupDocument(after).wellFormed).toBe(true)
    expect(decodeUtf8(after)).toContain(">Shape<")
    expect(decodeUtf8(after)).not.toContain(`id="3"`)
  })

  it("moves picture 3 and leaves shape 2", () => {
    const { bytes, found } = pictureSpan()
    const name = "ppt/slides/slide3.xml"
    const edited = applyRoute(new Map([[name, bytes]]), { name: "move", part: name, shape: "3", x: 11, y: 12 })
    const after = edited.get(name)
    if (after === undefined) throw new Error("part")
    outside(bytes, after, found.start, found.end)
    expect(markupDocument(after).wellFormed).toBe(true)
    const text = decodeUtf8(after)
    expect(text).toContain(`x="1"`)
    expect(text).toContain(`x="11"`)
    expect(text).toContain(`y="12"`)
    expect(text).not.toContain(`x="9"`)
  })

  it("fills a self-closing first run and keeps the second run and its format", () => {
    const tree = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="S"/></p:nvSpPr><p:txBody><a:p><a:r><a:rPr lang="en-US"/><a:t/></a:r><a:r><a:rPr b="1"/><a:t>Second</a:t></a:r></a:p></p:txBody></p:sp>`
    const name = "ppt/slides/slide4.xml"
    const value = [
      {
        from: 0,
        runs: [
          { from: 0, text: "New" },
          { from: 1, text: "Second" },
        ],
      },
    ]
    const edited = applyRoute(new Map([[name, encodeUtf8(tree)]]), { name: "text", part: name, shape: "2", value })
    const after = decodeUtf8(edited.get(name) ?? encodeUtf8(""))
    expect(after).toContain(`<a:rPr lang="en-US"/><a:t>New</a:t></a:r><a:r><a:rPr b="1"/><a:t>Second</a:t></a:r>`)
  })

  it("keeps a second run the edit did not retype", () => {
    const tree = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="S"/></p:nvSpPr><p:txBody><a:p><a:r><a:rPr lang="en-US"/><a:t>Hello </a:t></a:r><a:r><a:rPr b="1"/><a:t>world</a:t></a:r></a:p></p:txBody></p:sp>`
    const name = "ppt/slides/slide5.xml"
    const value = [
      {
        from: 0,
        runs: [
          { from: 0, text: "New" },
          { from: 1, text: "world" },
        ],
      },
    ]
    const edited = applyRoute(new Map([[name, encodeUtf8(tree)]]), { name: "text", part: name, shape: "2", value })
    const after = decodeUtf8(edited.get(name) ?? encodeUtf8(""))
    expect(after).toContain(`<a:rPr lang="en-US"/><a:t>New</a:t></a:r><a:r><a:rPr b="1"/><a:t>world</a:t></a:r>`)
  })

  it("drops characters XML 1.0 does not allow and escapes the rest", () => {
    const tree = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="S"/></p:nvSpPr><p:txBody><a:p><a:r><a:t>Old</a:t></a:r></a:p></p:txBody></p:sp>`
    const name = "ppt/slides/slide6.xml"
    const edited = applyRoute(new Map([[name, encodeUtf8(tree)]]), {
      name: "text",
      part: name,
      shape: "2",
      value: oneRun("A\u0001B&<>\u0008\t\uFFFE\uFFFF\uD800"),
    })
    const after = edited.get(name)
    if (after === undefined) throw new Error("part")
    expect(markupDocument(after).wellFormed).toBe(true)
    expect(decodeUtf8(after)).toContain("<a:t>AB&amp;&lt;&gt;\t</a:t>")
    expect(after.includes(1)).toBe(false)
    expect(after.includes(8)).toBe(false)
  })
})

const paragraphs = (body: string): string =>
  `<p:sp><p:nvSpPr><p:cNvPr id="2" name="S"/></p:nvSpPr><p:txBody><a:bodyPr wrap="none"/><a:lstStyle/>${body}</p:txBody></p:sp>`
const twoRuns = `<a:p><a:pPr algn="ctr"/><a:r><a:rPr b="1"/><a:t>Bold</a:t></a:r><a:r><a:rPr lang="en-US"/><a:t> plain</a:t></a:r><a:endParaRPr lang="en-US"/></a:p>`
const fieldBox = `<a:p><a:fld id="{1}" type="slidenum"><a:rPr/><a:t>7</a:t></a:fld></a:p>`
const brokenBox = `<a:p><a:r><a:t>One</a:t></a:r><a:br/><a:r><a:t>Two</a:t></a:r></a:p>`

describe("applyRoute text values", () => {
  it("keeps the other runs of a box when one run's text changes", () => {
    const value = [
      {
        from: 0,
        runs: [
          { from: 0, text: "Bolder" },
          { from: 1, text: " plain" },
        ],
      },
    ]
    const next = edited(paragraphs(twoRuns), { name: "text", part, shape: "2", value })
    expect(next).toContain("<a:t> plain</a:t>")
    expect(next).toContain(`<a:rPr b="1"/><a:t>Bolder</a:t>`)
    expect(next.match(/<a:r>/g)).toHaveLength(2)
    expect(next.replace("Bolder", "Bold")).toBe(`<p:spTree>${paragraphs(twoRuns)}</p:spTree>`)
  })

  it("writes text into a box that has no run", () => {
    const empty = `<a:p><a:endParaRPr lang="en-US"/></a:p>`
    const value = [{ from: 0, runs: [{ from: -1, text: "First" }] }]
    const next = edited(paragraphs(empty), { name: "text", part, shape: "2", value })
    expect(next).toBe(
      `<p:spTree>${paragraphs(
        `<a:p><a:r><a:rPr lang="en-US"/><a:t>First</a:t></a:r><a:endParaRPr lang="en-US"/></a:p>`,
      )}</p:spTree>`,
    )
  })

  it("splits a paragraph and merges it back to the original bytes", () => {
    const original = `<a:p><a:pPr algn="r"/><a:r><a:rPr b="1"/><a:t>Hello world</a:t></a:r><a:endParaRPr sz="10"/></a:p>`
    const name = "ppt/slides/slide8.xml"
    const before = encodeUtf8(paragraphs(original))
    const split = [
      { from: 0, runs: [{ from: 0, text: "Hello" }] },
      { from: 0, runs: [{ from: 0, text: " world" }] },
    ]
    const afterSplit = applyRoute(new Map([[name, before]]), { name: "text", part: name, shape: "2", value: split })
    expect(decodeUtf8(afterSplit.get(name) ?? encodeUtf8(""))).toContain(
      `<a:p><a:pPr algn="r"/><a:r><a:rPr b="1"/><a:t>Hello</a:t></a:r><a:endParaRPr sz="10"/></a:p><a:p><a:pPr algn="r"/><a:r><a:rPr b="1"/><a:t> world</a:t></a:r><a:endParaRPr sz="10"/></a:p>`,
    )
    const merged = [{ from: 0, runs: [{ from: 0, text: "Hello world" }] }]
    const fromOriginal = applyRoute(new Map([[name, before]]), { name: "text", part: name, shape: "2", value: merged })
    expect(fromOriginal.get(name)).toBe(before)
    const fromSplit = applyRoute(afterSplit, { name: "text", part: name, shape: "2", value: merged })
    expect(fromSplit.get(name)).toEqual(before)
  })

  it("refuses an edit to a field's text", () => {
    refused(paragraphs(fieldBox), [{ from: 0, runs: [{ from: 0, text: "8" }] }], /text-carried/)
  })

  it("refuses an edit to a break", () => {
    refused(
      paragraphs(brokenBox),
      [
        {
          from: 0,
          runs: [
            { from: 0, text: "One" },
            { from: 1, text: "x" },
            { from: 2, text: "Two" },
          ],
        },
      ],
      /text-carried/,
    )
  })

  it("refuses a newline typed inside a run", () => {
    refused(
      paragraphs(twoRuns),
      [
        {
          from: 0,
          runs: [
            { from: 0, text: "a\nb" },
            { from: 1, text: " plain" },
          ],
        },
      ],
      /text-break/,
    )
    refused(paragraphs(twoRuns), [{ from: 0, runs: [{ from: -1, text: "a\nb" }] }], /text-break/)
  })

  it("refuses a paragraph or a run the file does not have and writes nothing", () => {
    refused(paragraphs(twoRuns), [{ from: 1, runs: [] }], /text-paragraph/)
    refused(paragraphs(twoRuns), [{ from: 0, runs: [{ from: 2, text: "x" }] }], /text-run/)
    refused(paragraphs(twoRuns), [{ from: 0, runs: [{ from: -2, text: "x" }] }], /text-run/)
    refused(paragraphs(twoRuns), [], /text-empty/)
    refused(picture("2"), oneRun("x"), /text-body/)
  })

  it("refuses to rebuild a paragraph holding an element the value cannot carry", () => {
    const math = `<a:p><mc:AlternateContent><mc:Choice Requires="a14"><a14:m/></mc:Choice></mc:AlternateContent><a:r><a:t>x</a:t></a:r></a:p>`
    refused(
      paragraphs(math),
      [
        {
          from: 0,
          runs: [
            { from: 0, text: "x" },
            { from: 0, text: "y" },
          ],
        },
      ],
      /text-carried/,
    )
  })

  it("refuses a newline in a kept run of a rebuilt paragraph", () => {
    refused(paragraphs(twoRuns), [{ from: 0, runs: [{ from: 0, text: "a\nb" }] }], /text-break/)
  })

  it("renames an a:endParaRPr that has children for a new run", () => {
    const end = `<a:endParaRPr lang="en-US"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:endParaRPr>`
    const value = [{ from: 0, runs: [{ from: -1, text: "First" }] }]
    expect(edited(paragraphs(`<a:p>${end}</a:p>`), { name: "text", part, shape: "2", value })).toBe(
      `<p:spTree>${paragraphs(
        `<a:p><a:r><a:rPr lang="en-US"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:rPr><a:t>First</a:t></a:r>${end}</a:p>`,
      )}</p:spTree>`,
    )
  })

  it("writes paragraphs in the order the value gives when their from is out of order", () => {
    const line = (text: string) => `<a:p><a:r><a:rPr sz="${text.length}"/><a:t>${text}</a:t></a:r></a:p>`
    const body = paragraphs(line("a") + line("bb") + line("ccc"))
    const value = [
      { from: 2, runs: [{ from: 0, text: "ccc" }] },
      { from: 0, runs: [{ from: 0, text: "a" }] },
      { from: 1, runs: [{ from: 0, text: "bb" }] },
    ]
    expect(edited(body, { name: "text", part, shape: "2", value })).toBe(
      `<p:spTree>${paragraphs(line("ccc") + line("a") + line("bb"))}</p:spTree>`,
    )
  })

  it("rebuilds a same-length reorder of runs so each text keeps its own format", () => {
    const value = [
      {
        from: 0,
        runs: [
          { from: 1, text: "plain first" },
          { from: 0, text: "bold second" },
        ],
      },
    ]
    expect(edited(paragraphs(twoRuns), { name: "text", part, shape: "2", value })).toBe(
      `<p:spTree>${paragraphs(
        `<a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US"/><a:t>plain first</a:t></a:r><a:r><a:rPr b="1"/><a:t>bold second</a:t></a:r><a:endParaRPr lang="en-US"/></a:p>`,
      )}</p:spTree>`,
    )
  })

  it("reads a numeric reference and leaves it alone when the text is unchanged", () => {
    const body = paragraphs(`<a:p><a:r><a:t>&#65;&#x42;&amp;</a:t></a:r></a:p>`)
    expect(edited(body, { name: "text", part, shape: "2", value: oneRun("AB&") })).toBe(`<p:spTree>${body}</p:spTree>`)
  })
})
