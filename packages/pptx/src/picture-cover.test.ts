import { describe, expect, it } from "vitest"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { shownPictureMode } from "./picture-mode.js"
import { writeTrait } from "./trait-xml.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const slidePart = "ppt/slides/slide1.xml"
const wide = `<a:fillRect l="0" t="-50000" r="0" b="-50000"/>`
const tall = `<a:fillRect l="-50000" t="0" r="-50000" b="0"/>`
const dot = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137,
  0, 0, 0, 13, 73, 68, 65, 84, 120, 218, 99, 252, 207, 192, 80, 15, 0, 4, 133, 1, 128, 132, 169, 140, 33, 0, 0, 0, 0,
  73, 69, 78, 68, 174, 66, 96, 130,
])

const at = { slide: "256", part: slidePart, shape: "4" }

function sheet(shapes: string): string {
  return `<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/></p:nvGrpSpPr><p:grpSpPr/>${shapes}</p:spTree></p:cSld></p:sld>`
}

function picture(id: string, placement: string, cx = 200, cy = 100): string {
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Picture ${id}"/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/>${placement}</p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm></p:spPr></p:pic>`
}

function pack(shapes: string, media: Uint8Array | null = dot): Map<string, Uint8Array> {
  const parts = new Map<string, Uint8Array>([
    [slidePart, encodeUtf8(sheet(shapes))],
    [
      "ppt/slides/_rels/slide1.xml.rels",
      encodeUtf8(`<Relationships><Relationship Id="rId2" Target="../media/dot.png"/></Relationships>`),
    ],
  ])
  if (media !== null) parts.set("ppt/media/dot.png", media)
  return parts
}

function xml(parts: ReadonlyMap<string, Uint8Array>): string {
  return decodeUtf8(parts.get(slidePart) ?? new Uint8Array())
}

const size = (w: number, h: number, x = 0, y = 0) =>
  ({ x: { set: x }, y: { set: y }, w: { set: w }, h: { set: h } }) as const

const filled = picture("4", `<a:stretch>${wide}</a:stretch>`)

function group(inner: string, cx = 200, cy = 100, id = "2"): string {
  return `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${id}" name="Group ${id}"/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/><a:chOff x="0" y="0"/><a:chExt cx="${cx}" cy="${cy}"/></a:xfrm></p:grpSpPr>${inner}</p:grpSp>`
}

describe("a Fill picture's cover", () => {
  it("recentres the cover when the frame changes shape", () => {
    const next = writeTrait(pack(filled), at, "box", size(100, 200))
    expect(xml(next)).toContain(`<a:ext cx="100" cy="200"/>`)
    expect(xml(next)).toContain(`<a:stretch>${tall}</a:stretch>`)
    expect(shownPictureMode(next, at)).toBe("fill")
  })

  it("recentres an off-centre cover instead of keeping the old pan", () => {
    const placed = picture("4", `<a:stretch><a:fillRect l="-80000" t="0" r="-20000" b="0"/></a:stretch>`)
    const next = writeTrait(pack(placed), at, "box", size(100, 200))
    expect(xml(next)).toContain(`<a:stretch>${tall}</a:stretch>`)
  })

  it("leaves the cover bytes when a move repeats the size the frame already has", () => {
    const parts = pack(filled)
    const next = writeTrait(parts, at, "box", size(200, 100, 15))
    expect(xml(next)).toContain(`<a:off x="15" y="0"/>`)
    expect(xml(next)).toContain(`<a:stretch>${wide}</a:stretch>`)
    expect(writeTrait(parts, at, "box", size(200, 100))).toBe(parts)
  })

  it("keeps the cover bytes when the frame scales uniformly", () => {
    const next = writeTrait(pack(filled), at, "box", size(400, 200))
    expect(xml(next)).toContain(`<a:ext cx="400" cy="200"/>`)
    expect(xml(next)).toContain(`<a:stretch>${wide}</a:stretch>`)
  })

  it("keeps the cover bytes when the frame turns", () => {
    const next = writeTrait(pack(filled), at, "box", { rot: { set: 5_400_000 }, ...size(200, 100) })
    expect(xml(next)).toContain(`rot="5400000"`)
    expect(xml(next)).toContain(`<a:stretch>${wide}</a:stretch>`)
  })

  it.each([
    ["fit", `<a:stretch><a:fillRect l="0" t="25000" r="0" b="25000"/></a:stretch>`],
    ["crop", `<a:srcRect l="10000" t="0" r="10000" b="0"/><a:stretch><a:fillRect/></a:stretch>`],
    ["tile", `<a:tile tx="0" ty="0" sx="100000" sy="100000" algn="tl"/>`],
    ["stretch", `<a:stretch><a:fillRect/></a:stretch>`],
  ] as const)("leaves a %s picture's placement when the frame changes shape", (mode, placement) => {
    const next = writeTrait(pack(picture("4", placement)), at, "box", size(100, 200))
    expect(xml(next)).toContain(`<a:ext cx="100" cy="200"/>`)
    expect(xml(next)).toContain(placement)
    expect(shownPictureMode(next, at)).toBe(mode)
  })

  it("resizes a Fill picture whose bytes are missing without changing its insets", () => {
    const parts = pack(filled, null)
    const next = writeTrait(parts, at, "box", size(100, 200))
    expect(xml(next)).toContain(`<a:ext cx="100" cy="200"/>`)
    expect(xml(next)).toContain(`<a:stretch>${wide}</a:stretch>`)
  })

  it("recentres a shape whose picture fill is Fill", () => {
    const shape = `<p:sp><p:nvSpPr><p:cNvPr id="4" name="Shape 4"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="200" cy="100"/></a:xfrm><a:blipFill><a:blip r:embed="rId2"/><a:stretch>${wide}</a:stretch></a:blipFill></p:spPr></p:sp>`
    const next = writeTrait(pack(shape), at, "box", size(100, 200))
    expect(xml(next)).toContain(`<a:stretch>${tall}</a:stretch>`)
    expect(xml(next)).not.toContain("</p:blipFill>")
  })

  it("recentres Fill pictures inside a group whose frame changes shape, and leaves a picture outside it", () => {
    const outside = picture("5", `<a:stretch>${wide}</a:stretch>`)
    const parts = pack(`${group(filled)}${outside}`)
    const next = writeTrait(parts, { ...at, shape: "2" }, "box", { w: { set: 100 }, h: { set: 200 } })
    const text = xml(next)
    expect(text).toContain(`<a:ext cx="100" cy="200"/>`)
    expect(text).toContain(`<a:chExt cx="200" cy="100"/>`)
    expect(text).toContain(
      `<p:pic><p:nvPicPr><p:cNvPr id="4" name="Picture 4"/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch>${tall}</a:stretch>`,
    )
    expect(text).toContain(
      `<p:pic><p:nvPicPr><p:cNvPr id="5" name="Picture 5"/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch>${wide}</a:stretch>`,
    )
    expect(text).toContain(`<a:ext cx="200" cy="100"/>`)
  })

  it("keeps a grouped Fill picture's cover when the group scales uniformly", () => {
    const next = writeTrait(pack(group(filled)), { ...at, shape: "2" }, "box", { w: { set: 400 }, h: { set: 200 } })
    expect(xml(next)).toContain(`<a:ext cx="400" cy="200"/>`)
    expect(xml(next)).toContain(`<a:stretch>${wide}</a:stretch>`)
  })

  it("recentres a Fill picture through a nested group", () => {
    const inner = group(
      picture("4", `<a:stretch><a:fillRect l="0" t="0" r="0" b="0"/></a:stretch>`, 100, 100),
      100,
      100,
      "3",
    )
    const next = writeTrait(pack(group(inner, 100, 100)), { ...at, shape: "2" }, "box", {
      w: { set: 50 },
      h: { set: 200 },
    })
    expect(xml(next)).toContain(`<a:fillRect l="-150000" t="0" r="-150000" b="0"/>`)
    expect(xml(next)).toContain(
      `<p:cNvPr id="3" name="Group 3"/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/>`,
    )
  })
})

describe("a picture switched to Crop", () => {
  const crop = { fills: { mode: { set: "crop" } } } as const

  it("starts from the part a Fill picture shows, so the image keeps its proportions", () => {
    const next = writeTrait(pack(filled), at, "fills", crop.fills)
    expect(xml(next)).toContain(`<a:srcRect t="25000" b="25000"/><a:stretch><a:fillRect/></a:stretch>`)
    expect(shownPictureMode(next, at)).toBe("crop")
  })

  it("keeps an off-centre Fill's pan as its crop", () => {
    const placed = picture("4", `<a:stretch><a:fillRect l="-80000" t="0" r="-20000" b="0"/></a:stretch>`)
    const next = writeTrait(pack(placed), at, "fills", crop.fills)
    expect(xml(next)).toContain(`<a:srcRect l="40000" r="10000"/><a:stretch><a:fillRect/></a:stretch>`)
  })

  it.each([
    ["fit", `<a:stretch><a:fillRect l="25000" t="0" r="25000" b="0"/></a:stretch>`],
    ["stretch", `<a:stretch><a:fillRect/></a:stretch>`],
    ["tile", `<a:tile tx="0" ty="0" sx="100000" sy="100000" algn="tl"/>`],
  ] as const)("covers the frame from a %s picture instead of stretching the image", (_mode, placement) => {
    const next = writeTrait(pack(picture("4", placement)), at, "fills", crop.fills)
    expect(xml(next)).toContain(`<a:srcRect t="25000" b="25000"/><a:stretch><a:fillRect/></a:stretch>`)
  })

  it("keeps the crop a Crop picture already has", () => {
    const placement = `<a:srcRect l="10000" t="0" r="10000" b="0"/><a:stretch><a:fillRect/></a:stretch>`
    const parts = pack(picture("4", placement))
    expect(xml(writeTrait(parts, at, "fills", crop.fills))).toContain(placement)
  })

  it("leaves the whole image when its bytes are missing", () => {
    const next = writeTrait(pack(picture("4", `<a:stretch><a:fillRect/></a:stretch>`), null), at, "fills", crop.fills)
    expect(xml(next)).toContain(`<a:srcRect/><a:stretch><a:fillRect/></a:stretch>`)
  })
})
