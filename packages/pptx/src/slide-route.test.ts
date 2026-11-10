import { describe, expect, it } from "vitest"
import { markupDocument } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { applyRoute } from "./slide-route.js"

const slide = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="Rectangle 2"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="457200"/><a:ext cx="5486400" cy="1828800"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr/><a:r><a:rPr lang="en-US" sz="3200"><a:solidFill><a:schemeClr val="dk1"/></a:solidFill></a:rPr><a:t>Hello</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`
const part = "ppt/slides/slide1.xml"
const kept = "ppt/media/keep.bin"

function parts(): Map<string, Uint8Array> {
  return new Map([
    [part, encodeUtf8(slide)],
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
    const edited = applyRoute(before, { name: "text", part, shape: "2", text: "A & B" })
    expect(edited.get(kept)).toBe(before.get(kept))
    expect(xml(edited).replace("<a:t>A &amp; B</a:t>", "<a:t>Hello</a:t>")).toBe(slide)
    expect(xml(edited).indexOf("<a:pPr")).toBeLessThan(xml(edited).indexOf("<a:t>"))
    const back = applyRoute(edited, { name: "text", part, shape: "2", text: "Hello" })
    expect(back.get(part)).toEqual(before.get(part))
  })

  it("keeps the part object when the route changes nothing", () => {
    const before = parts()
    const sameText = applyRoute(before, { name: "text", part, shape: "2", text: "Hello" })
    const sameMove = applyRoute(before, { name: "move", part, shape: "2", x: 457200, y: 457200 })
    const sameSize = applyRoute(before, { name: "resize", part, shape: "2", cx: 5486400, cy: 1828800 })
    expect(sameText.get(part)).toBe(before.get(part))
    expect(sameMove.get(part)).toBe(before.get(part))
    expect(sameSize.get(part)).toBe(before.get(part))
    expect(sameText.get(kept)).toBe(before.get(kept))
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

  it("does not treat a longer shape id as the requested one", () => {
    const tree = `<p:spTree><p:sp><p:cNvPr id="20" name="Other"/><a:t>No</a:t><a:off x="1" y="1"/><a:ext cx="1" cy="1"/></p:sp><p:sp><p:cNvPr id="2" name="This"/><a:t>Yes</a:t><a:off x="2" y="2"/><a:ext cx="3" cy="4"/></p:sp></p:spTree>`
    const name = "ppt/slides/slide2.xml"
    const before = new Map([[name, encodeUtf8(tree)]])
    const edited = applyRoute(before, { name: "text", part: name, shape: "2", text: "Hi" })
    const next = decodeUtf8(edited.get(name) ?? encodeUtf8(""))
    expect(next).toContain('<p:cNvPr id="20" name="Other"/><a:t>No</a:t>')
    expect(next).toContain("<a:t>Hi</a:t>")
  })

  it("adds a shape and removes that same shape back to the original bytes", () => {
    const before = parts()
    const added = applyRoute(before, { name: "add", part, text: "New", x: 0, y: 0, cx: 914400, cy: 457200 })
    expect(added.get(kept)).toBe(before.get(kept))
    expect(xml(added)).toContain(`<p:cNvPr id="3" name="Shape 3"/>`)
    expect(xml(added)).toContain("<a:t>New</a:t>")
    expect(xml(added).indexOf("<a:pPr")).toBeLessThan(xml(added).indexOf("<a:t>New</a:t>"))
    const back = applyRoute(added, { name: "remove", part, shape: "3" })
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
    expect(() => applyRoute(before, { name: "text", part: "missing", shape: "2", text: "A" })).toThrow(/part/)
    expect(() => applyRoute(before, { name: "text", part, shape: "1", text: "A" })).toThrow(/shape/)
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

function shownText(slideXml: string): string {
  return [...slideXml.matchAll(/<a:t(?: [^>]*)?>([^<]*)<\/a:t>/g)].map((match) => match[1]).join("")
}

describe("applyRoute known faults", () => {
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

  it("replaces all the text of a shape that has two runs", () => {
    const next = edited(shape("2", run("Hello ") + run("world")), { name: "text", part, shape: "2", text: "New" })
    expect(shownText(next)).toBe("New")
  })

  it("writes well-formed text when the first run is empty", () => {
    const next = edited(shape("2", `<a:r><a:t/></a:r>${run("Keep")}`), { name: "text", part, shape: "2", text: "New" })
    expect(next).not.toContain("<a:t/>New</a:t>")
    expect(markupDocument(encodeUtf8(next)).wellFormed).toBe(true)
    expect(shownText(next)).toBe("New")
  })

  it("keeps a character XML forbids out of the slide", () => {
    const next = edited(shape("2", run("Old")), { name: "text", part, shape: "2", text: "a\u0001b" })
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

  it("replaces a self-closing first run without leaving a second run", () => {
    const tree = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="S"/></p:nvSpPr><p:txBody><a:p><a:r><a:rPr lang="en-US"/><a:t/></a:r><a:r><a:rPr b="1"/><a:t>Second</a:t></a:r></a:p></p:txBody></p:sp>`
    const name = "ppt/slides/slide4.xml"
    const edited = applyRoute(new Map([[name, encodeUtf8(tree)]]), {
      name: "text",
      part: name,
      shape: "2",
      text: "New",
    })
    const after = edited.get(name)
    if (after === undefined) throw new Error("part")
    expect(markupDocument(after).wellFormed).toBe(true)
    const text = decodeUtf8(after)
    expect(text).toContain(`<a:t>New</a:t>`)
    expect(text).toContain(`lang="en-US"`)
    expect(text).not.toContain("<a:t/>")
    expect(text).not.toContain("Second")
    expect(text).not.toContain(`b="1"`)
  })

  it("replaces every run and keeps the first run's formatting", () => {
    const tree = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="S"/></p:nvSpPr><p:txBody><a:p><a:r><a:rPr lang="en-US"/><a:t>Hello </a:t></a:r><a:r><a:rPr b="1"/><a:t>world</a:t></a:r></a:p></p:txBody></p:sp>`
    const name = "ppt/slides/slide5.xml"
    const edited = applyRoute(new Map([[name, encodeUtf8(tree)]]), {
      name: "text",
      part: name,
      shape: "2",
      text: "New",
    })
    const after = edited.get(name)
    if (after === undefined) throw new Error("part")
    expect(markupDocument(after).wellFormed).toBe(true)
    const text = decodeUtf8(after)
    expect(text).toContain(`<a:rPr lang="en-US"/><a:t>New</a:t>`)
    expect(text).not.toContain("Hello")
    expect(text).not.toContain("world")
    expect(text).not.toContain(`b="1"`)
  })

  it("drops characters XML 1.0 does not allow and escapes the rest", () => {
    const tree = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="S"/></p:nvSpPr><p:txBody><a:p><a:r><a:t>Old</a:t></a:r></a:p></p:txBody></p:sp>`
    const name = "ppt/slides/slide6.xml"
    const edited = applyRoute(new Map([[name, encodeUtf8(tree)]]), {
      name: "text",
      part: name,
      shape: "2",
      text: "A\u0001B&<>\u0008\t\uFFFE\uFFFF\uD800",
    })
    const after = edited.get(name)
    if (after === undefined) throw new Error("part")
    expect(markupDocument(after).wellFormed).toBe(true)
    expect(decodeUtf8(after)).toContain("<a:t>AB&amp;&lt;&gt;\t</a:t>")
    expect(after.includes(1)).toBe(false)
    expect(after.includes(8)).toBe(false)
  })
})
