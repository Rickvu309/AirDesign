import { describe, expect, it, vi } from "vitest"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): {
    readFileSync(path: string): Uint8Array
    readdirSync(path: string): readonly string[]
  }
  getBuiltinModule(name: "node:zlib"): { inflateRawSync(data: Uint8Array): Uint8Array }
}

const { readFileSync, readdirSync } = process.getBuiltinModule("node:fs")
const { inflateRawSync } = process.getBuiltinModule("node:zlib")
import { markupDocument, type MarkupElement } from "./element-span.js"
import { decodeUtf8 } from "./package-bytes.js"
import { readContainer, stored } from "./package-container.js"
import { paintReader, PaintPartError, type PaintElement } from "./paint-reader.js"
import { readShapes, readSlides } from "./read-shapes.js"

const work = vi.hoisted(() => ({ parses: 0 }))

vi.mock("./element-span.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("./element-span.js")>()
  return {
    ...real,
    markupDocument: (bytes: Uint8Array) => {
      work.parses += 1
      return real.markupDocument(bytes)
    },
  }
})

const relationship = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const slidePart = "ppt/slides/slide1.xml"
const layoutPart = "ppt/slideLayouts/slideLayout1.xml"
const masterPart = "ppt/slideMasters/slideMaster1.xml"
const xml = (text: string) => Uint8Array.from(text, (character) => character.charCodeAt(0))

const sheet = (root: string, attributes: string, shapes: string) =>
  `<${root} ${attributes}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="5" y="5"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes}</p:spTree></p:cSld></${root}>`

const rels = (target: string, type: string) =>
  `<Relationships><Relationship Id="rId1" Type="${relationship}/${type}" Target="${target}"/></Relationships>`

const xfrm = (x: number, y: number, cx: number, cy: number, attributes = "") =>
  `<a:xfrm ${attributes}><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`

const sp = (id: string, transform = "", nv = "", attributes = "") =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="s" ${attributes}/><p:cNvSpPr/><p:nvPr>${nv}</p:nvPr></p:nvSpPr><p:spPr>${transform}</p:spPr></p:sp>`

const groupTransform = (
  [x, y, cx, cy]: readonly [number, number, number, number],
  [chX, chY, chCx, chCy]: readonly [number, number, number, number],
  attributes = "",
) =>
  `<a:xfrm ${attributes}><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/><a:chOff x="${chX}" y="${chY}"/><a:chExt cx="${chCx}" cy="${chCy}"/></a:xfrm>`

const group = (id: string, transform: string, inside: string, attributes = "") =>
  `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${id}" name="g" ${attributes}/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr>${transform}</p:grpSpPr>${inside}</p:grpSp>`

const placeholder = (type: string | null, index: number | null) =>
  `<p:ph${type === null ? "" : ` type="${type}"`}${index === null ? "" : ` idx="${index}"`}/>`

type Deck = {
  readonly slide?: string
  readonly layout?: string
  readonly master?: string
  readonly slideAttributes?: string
  readonly layoutAttributes?: string
}

const deck = ({ slide = "", layout = "", master = "", slideAttributes = "", layoutAttributes = "" }: Deck) =>
  new Map([
    [
      "ppt/presentation.xml",
      xml(`<p:presentation><p:notesSz cx="1" cy="2"/><p:sldSz cx="12192000" cy="6858000"/></p:presentation>`),
    ],
    [slidePart, xml(sheet("p:sld", slideAttributes, slide))],
    ["ppt/slides/_rels/slide1.xml.rels", xml(rels("../slideLayouts/slideLayout1.xml", "slideLayout"))],
    [layoutPart, xml(sheet("p:sldLayout", layoutAttributes, layout))],
    ["ppt/slideLayouts/_rels/slideLayout1.xml.rels", xml(rels("../slideMasters/slideMaster1.xml", "slideMaster"))],
    [masterPart, xml(sheet("p:sldMaster", "", master))],
  ])

const painted = (input: Deck) => paintReader(deck(input)).slide(slidePart).elements
const paintedIn = (parts: ReadonlyMap<string, Uint8Array>) => paintReader(parts).slide(slidePart).elements
const ids = (elements: readonly PaintElement[]) => elements.map((element) => element.shape)
const boxOf = (elements: readonly PaintElement[], shape: string) =>
  elements.find((element) => element.shape === shape)?.box

const expectBox = (actual: PaintElement["box"] | undefined, expected: NonNullable<PaintElement["box"]>) => {
  if (actual === undefined || actual === null) throw new Error("box")
  expect(actual.x).toBeCloseTo(expected.x, 6)
  expect(actual.y).toBeCloseTo(expected.y, 6)
  expect(actual.width).toBeCloseTo(expected.width, 6)
  expect(actual.height).toBeCloseTo(expected.height, 6)
  expect(actual.rotation).toBeCloseTo(expected.rotation, 6)
  expect(actual.flipH).toBe(expected.flipH)
  expect(actual.flipV).toBe(expected.flipV)
}

const plain = { rotation: 0, flipH: false, flipV: false }

describe("paintReader rule 1: reads once", () => {
  const twoSlides = () => {
    const parts = deck({ slide: sp("2", xfrm(0, 0, 1, 1)) })
    parts.set("ppt/slides/slide2.xml", xml(sheet("p:sld", "", sp("3", xfrm(0, 0, 1, 1)))))
    parts.set("ppt/slides/_rels/slide2.xml.rels", xml(rels("../slideLayouts/slideLayout1.xml", "slideLayout")))
    return parts
  }

  it("parses nothing until a slide is asked for", () => {
    work.parses = 0
    paintReader(twoSlides())
    expect(work.parses).toBe(0)
  })

  it("reads each layout, master and relationship once across slide calls", () => {
    const reader = paintReader(twoSlides())
    work.parses = 0
    reader.slide(slidePart)
    expect(work.parses).toBe(6)
    work.parses = 0
    reader.slide("ppt/slides/slide2.xml")
    expect(work.parses).toBe(2)
    work.parses = 0
    reader.slide(slidePart)
    expect(work.parses).toBe(1)
  })
})

describe("paintReader rule 2: size", () => {
  it("reads the slide size from p:sldSz, not p:notesSz", () => {
    const paint = paintReader(deck({})).slide(slidePart)
    expect([paint.width, paint.height]).toEqual([12192000, 6858000])
  })
})

describe("paintReader rule 3: paint order", () => {
  it("lists master, then layout, then slide, each in document order with a group before its children", () => {
    const elements = painted({
      master: sp("20", xfrm(0, 0, 1, 1)) + sp("21", xfrm(0, 0, 1, 1)),
      layout: sp("10", xfrm(0, 0, 1, 1)) + sp("11", xfrm(0, 0, 1, 1)),
      slide:
        sp("2", xfrm(0, 0, 1, 1)) +
        group("3", groupTransform([0, 0, 1, 1], [0, 0, 1, 1]), sp("4", xfrm(0, 0, 1, 1))) +
        sp("5", xfrm(0, 0, 1, 1)),
    })
    expect(ids(elements)).toEqual(["20", "21", "10", "11", "2", "3", "4", "5"])
    expect(elements.map((element) => element.from)).toEqual([
      "master",
      "master",
      "layout",
      "layout",
      "slide",
      "slide",
      "slide",
      "slide",
    ])
  })

  it("follows the relationships, whatever the parts are named", () => {
    const parts = new Map([
      [slidePart, xml(sheet("p:sld", "", ""))],
      ["ppt/slides/_rels/slide1.xml.rels", xml(rels("/ppt/custom/a.xml", "slideLayout"))],
      ["ppt/custom/a.xml", xml(sheet("p:sldLayout", "", sp("10", xfrm(0, 0, 1, 1))))],
      ["ppt/custom/_rels/a.xml.rels", xml(rels("./deep/../b.xml", "slideMaster"))],
      ["ppt/custom/b.xml", xml(sheet("p:sldMaster", "", sp("20", xfrm(0, 0, 1, 1))))],
    ])
    expect(paintedIn(parts).map((element) => element.part)).toEqual(["ppt/custom/b.xml", "ppt/custom/a.xml"])
  })
})

describe("paintReader rule 4: layout and master shapes", () => {
  const master = sp("20", xfrm(0, 0, 1, 1)) + sp("21", xfrm(9, 9, 9, 9), placeholder("title", null))
  const layout = sp("10", xfrm(0, 0, 1, 1)) + sp("11", xfrm(8, 8, 8, 8), placeholder("title", null))

  it("paints only the shapes that are not placeholders", () => {
    expect(ids(painted({ master, layout }))).toEqual(["20", "10"])
  })

  it("hides layout and master shapes when the slide says showMasterSp=0", () => {
    expect(ids(painted({ master, layout, slideAttributes: `showMasterSp="0"` }))).toEqual([])
    expect(ids(painted({ master, layout, slideAttributes: `showMasterSp="false"` }))).toEqual([])
  })

  it("hides only master shapes when the layout says showMasterSp=0", () => {
    expect(ids(painted({ master, layout, layoutAttributes: `showMasterSp="0"` }))).toEqual(["10"])
  })

  it("still inherits a box when the shapes above are hidden", () => {
    const slide = sp("2", "", placeholder("title", null))
    expectBox(boxOf(painted({ master, layout, slide, slideAttributes: `showMasterSp="0"` }), "2"), {
      x: 8,
      y: 8,
      width: 8,
      height: 8,
      ...plain,
    })
  })
})

describe("paintReader rule 5: hidden", () => {
  it("does not paint a hidden shape", () => {
    const slide = sp("2", xfrm(0, 0, 1, 1), "", `hidden="1"`) + sp("3", xfrm(0, 0, 1, 1), "", `hidden="0"`)
    expect(ids(painted({ slide }))).toEqual(["3"])
    expect(ids(painted({ layout: slide, master: slide }))).toEqual(["3", "3"])
  })

  it("reads true as hidden", () => {
    expect(ids(painted({ slide: sp("2", xfrm(0, 0, 1, 1), "", `hidden="true"`) }))).toEqual([])
  })

  it("hides the children of a hidden group at any depth", () => {
    const frame = groupTransform([0, 0, 1, 1], [0, 0, 1, 1])
    const slide = group("2", frame, group("3", frame, sp("4", xfrm(0, 0, 1, 1))), `hidden="1"`)
    expect(ids(painted({ slide }))).toEqual([])
  })

  it("still inherits from a hidden layout placeholder", () => {
    const layout = sp("10", xfrm(1, 2, 3, 4), placeholder("title", null), `hidden="1"`)
    expectBox(boxOf(painted({ layout, slide: sp("2", "", placeholder("title", null)) }), "2"), {
      x: 1,
      y: 2,
      width: 3,
      height: 4,
      ...plain,
    })
  })
})

describe("paintReader rule 6: alternate content", () => {
  const alternate = (choice: string, fallback: string) =>
    `<mc:AlternateContent><mc:Choice Requires="a14">${choice}</mc:Choice><mc:Fallback>${fallback}</mc:Fallback></mc:AlternateContent>`

  it("paints the Choice and never its Fallback", () => {
    const elements = painted({ slide: alternate(sp("2", xfrm(1, 1, 1, 1)), sp("2", xfrm(9, 9, 9, 9))) })
    expect(ids(elements)).toEqual(["2"])
    expect(boxOf(elements, "2")?.x).toBe(1)
  })

  it("paints a Fallback's shape nowhere, even when the Choice holds no shape", () => {
    expect(ids(painted({ slide: alternate(`<p:contentPart r:id="rId9"/>`, sp("2", xfrm(9, 9, 9, 9))) }))).toEqual([])
  })

  it("paints one copy when there are two Choices", () => {
    const slide = `<mc:AlternateContent><mc:Choice Requires="a">${sp("2", xfrm(1, 1, 1, 1))}</mc:Choice><mc:Choice Requires="b">${sp("2", xfrm(2, 2, 2, 2))}</mc:Choice></mc:AlternateContent>`
    expect(ids(painted({ slide }))).toEqual(["2"])
  })

  it("keeps the same copy that readShapes keeps", () => {
    const parts = deck({ slide: alternate(sp("2", xfrm(1, 1, 1, 1)), sp("2", xfrm(9, 9, 9, 9))) })
    parts.set(
      "ppt/presentation.xml",
      xml(`<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst></p:presentation>`),
    )
    parts.set("ppt/_rels/presentation.xml.rels", xml(rels("slides/slide1.xml", "slide")))
    const [row] = readShapes(parts)
    expect(row?.box?.x).toBe(1)
    expect(boxOf(paintedIn(parts), "2")?.x).toBe(row?.box?.x)
  })

  it("applies the same rule on layouts and inside groups", () => {
    const frame = groupTransform([0, 0, 1, 1], [0, 0, 1, 1])
    const inside = alternate(sp("11", xfrm(1, 1, 1, 1)), sp("11", xfrm(9, 9, 9, 9)))
    expect(ids(painted({ layout: group("10", frame, inside) }))).toEqual(["10", "11"])
  })
})

describe("paintReader rule 7: placeholder boxes", () => {
  const layoutBox = xfrm(10, 20, 30, 40)
  const masterBox = xfrm(50, 60, 70, 80)
  const fromLayout = { x: 10, y: 20, width: 30, height: 40, ...plain }
  const fromMaster = { x: 50, y: 60, width: 70, height: 80, ...plain }
  const inherited = (input: Deck) => boxOf(painted(input), "2")

  it("keeps a placeholder's own box", () => {
    const own = sp("2", xfrm(1, 2, 3, 4), placeholder("title", null))
    expectBox(inherited({ slide: own, layout: sp("10", layoutBox, placeholder("title", null)) }), {
      x: 1,
      y: 2,
      width: 3,
      height: 4,
      ...plain,
    })
  })

  it("matches a layout placeholder by idx before type", () => {
    const layout = sp("10", xfrm(1, 1, 1, 1), placeholder("body", 1)) + sp("11", layoutBox, placeholder("pic", 13))
    expectBox(inherited({ layout, slide: sp("2", "", placeholder("body", 13)) }), fromLayout)
  })

  it("matches a layout placeholder by type when idx finds nothing", () => {
    const layout = sp("10", layoutBox, placeholder("title", null))
    expectBox(inherited({ layout, slide: sp("2", "", placeholder("title", 7)) }), fromLayout)
  })

  it("does not match two omitted idx values as an index", () => {
    const layout =
      sp("10", xfrm(1, 1, 1, 1), placeholder("body", null)) + sp("11", layoutBox, placeholder("title", null))
    expectBox(inherited({ layout, slide: sp("2", "", placeholder("title", null)) }), fromLayout)
  })

  it("inherits the whole box, with its rotation and flips", () => {
    const layout = sp("10", xfrm(10, 20, 30, 40, `rot="5400000" flipV="1"`), placeholder("title", null))
    expectBox(inherited({ layout, slide: sp("2", "", placeholder("title", null)) }), {
      x: 10,
      y: 20,
      width: 30,
      height: 40,
      rotation: 90,
      flipH: false,
      flipV: true,
    })
  })

  it("falls through a layout placeholder with no box to the master", () => {
    const layout = sp("10", "", placeholder("title", null))
    const master = sp("20", masterBox, placeholder("title", null))
    expectBox(inherited({ layout, master, slide: sp("2", "", placeholder("title", null)) }), fromMaster)
  })

  it("uses the layout placeholder's type to reach the master", () => {
    const layout = sp("10", "", placeholder("title", 5))
    const master = sp("20", masterBox, placeholder("title", null))
    expectBox(inherited({ layout, master, slide: sp("2", "", placeholder(null, 5)) }), fromMaster)
  })

  it.each([
    ["ctrTitle", "title"],
    ["subTitle", "body"],
    ["obj", "body"],
    [null, "body"],
    ["dt", "dt"],
  ])("matches a %s slide placeholder to the master's %s", (type, masterKind) => {
    const master = sp("20", masterBox, placeholder(masterKind, null))
    expectBox(inherited({ master, slide: sp("2", "", placeholder(type, null)) }), fromMaster)
  })

  it("does not match a different type on the master", () => {
    const master = sp("20", masterBox, placeholder("title", null))
    expect(inherited({ master, slide: sp("2", "", placeholder("body", null)) })).toBeNull()
  })

  it("reports the placeholder's type and index, and obj when the type is omitted", () => {
    const elements = painted({ slide: sp("2", xfrm(0, 0, 1, 1), placeholder(null, 4)) + sp("3", xfrm(0, 0, 1, 1)) })
    expect(elements.map((element) => element.placeholder)).toEqual([{ type: "obj", index: 4 }, null])
  })
})

describe("paintReader rule 8: group transforms", () => {
  const scaled = groupTransform([1000, 2000, 2000, 4000], [0, 0, 1000, 1000])
  const child = sp("3", xfrm(100, 200, 300, 400))
  const box = (slide: string, shape = "3") => boxOf(painted({ slide }), shape)

  it("scales and moves a child", () => {
    expectBox(box(group("2", scaled, child)), { x: 1200, y: 2800, width: 600, height: 1600, ...plain })
  })

  it("subtracts the child offset", () => {
    const frame = groupTransform([1000, 2000, 2000, 4000], [100, 200, 1000, 1000])
    expectBox(box(group("2", frame, child)), { x: 1000, y: 2000, width: 600, height: 1600, ...plain })
  })

  it("flips a child around the group's centre", () => {
    const frame = groupTransform([1000, 2000, 2000, 4000], [0, 0, 1000, 1000], `flipH="1"`)
    expectBox(box(group("2", frame, child)), {
      x: 2200,
      y: 2800,
      width: 600,
      height: 1600,
      rotation: 0,
      flipH: true,
      flipV: false,
    })
  })

  it("flips vertically around the group's centre", () => {
    const frame = groupTransform([1000, 2000, 2000, 4000], [0, 0, 1000, 1000], `flipV="1"`)
    expectBox(box(group("2", frame, child)), {
      x: 1200,
      y: 3600,
      width: 600,
      height: 1600,
      rotation: 0,
      flipH: false,
      flipV: true,
    })
  })

  it("rotates a child around the group's centre", () => {
    const frame = groupTransform([1000, 2000, 2000, 4000], [0, 0, 1000, 1000], `rot="5400000"`)
    expectBox(box(group("2", frame, sp("3", xfrm(100, 200, 300, 400, `rot="1800000"`)))), {
      x: 2100,
      y: 2700,
      width: 600,
      height: 1600,
      rotation: 120,
      flipH: false,
      flipV: false,
    })
  })

  it("flips before it rotates", () => {
    const frame = groupTransform([0, 0, 1000, 1000], [0, 0, 1000, 1000], `rot="5400000" flipH="1"`)
    expectBox(box(group("2", frame, sp("3", xfrm(100, 100, 100, 100)))), {
      x: 800,
      y: 800,
      width: 100,
      height: 100,
      rotation: 90,
      flipH: true,
      flipV: false,
    })
  })

  it("negates a child's rotation under one flip and keeps it under two", () => {
    const rotated = sp("3", xfrm(0, 0, 100, 100, `rot="1800000"`))
    const one = groupTransform([0, 0, 100, 100], [0, 0, 100, 100], `flipV="1"`)
    const two = groupTransform([0, 0, 100, 100], [0, 0, 100, 100], `flipH="1" flipV="1"`)
    expect(box(group("2", one, rotated))?.rotation).toBeCloseTo(330, 6)
    expect(box(group("2", two, rotated))?.rotation).toBeCloseTo(30, 6)
  })

  it("flips a child that is already flipped back", () => {
    const flipped = sp("3", xfrm(0, 0, 100, 100, `flipH="1"`))
    const frame = groupTransform([0, 0, 100, 100], [0, 0, 100, 100], `flipH="1"`)
    expect(box(group("2", frame, flipped))?.flipH).toBe(false)
  })

  it("normalizes rotation to 0 up to but excluding 360", () => {
    const rotated = (turn: number) => sp("3", xfrm(0, 0, 100, 100, `rot="${turn}"`))
    const frame = groupTransform([0, 0, 100, 100], [0, 0, 100, 100], `rot="1800000"`)
    expect(box(group("2", frame, rotated(21000000)))?.rotation).toBe(20)
    expect(box(group("2", frame, rotated(19800000)))?.rotation).toBe(0)
    expect(box(rotated(-5400000))?.rotation).toBe(270)
    expect(box(rotated(21600000))?.rotation).toBe(0)
  })

  it("applies a rotated, flipped, scaled and nested group, and the inner group's own box", () => {
    const outer = groupTransform([0, 0, 2000, 2000], [0, 0, 1000, 1000], `rot="5400000"`)
    const inner = groupTransform([100, 100, 400, 200], [0, 0, 200, 100], `flipH="1"`)
    const leaf = sp("4", xfrm(10, 20, 40, 30, `rot="2700000"`))
    const elements = painted({ slide: group("2", outer, group("3", inner, leaf)) })
    expectBox(boxOf(elements, "4"), {
      x: 1580,
      y: 820,
      width: 160,
      height: 120,
      rotation: 45,
      flipH: true,
      flipV: false,
    })
    expectBox(boxOf(elements, "3"), {
      x: 1200,
      y: 400,
      width: 800,
      height: 400,
      rotation: 90,
      flipH: true,
      flipV: false,
    })
    expectBox(boxOf(elements, "2"), { x: 0, y: 0, width: 2000, height: 2000, ...plain, rotation: 90 })
  })

  it("applies a horizontally flipped outer group around a rotated inner group", () => {
    const outer = groupTransform([5000000, 1000000, 2400000, 2400000], [0, 0, 1200000, 1200000], `flipH="1"`)
    const inner = groupTransform([200000, 300000, 800000, 800000], [0, 0, 400000, 400000], `rot="5400000"`)
    const leaf = sp("4", xfrm(100000, 200000, 400000, 200000, `rot="1800000"`))
    const elements = painted({ slide: group("2", outer, group("3", inner, leaf)) })
    expectBox(boxOf(elements, "4"), {
      x: 5800000,
      y: 2400000,
      width: 1600000,
      height: 800000,
      rotation: 240,
      flipH: true,
      flipV: false,
    })
    expectBox(boxOf(elements, "3"), {
      x: 5400000,
      y: 1600000,
      width: 1600000,
      height: 1600000,
      rotation: 270,
      flipH: true,
      flipV: false,
    })
  })

  it("scales 1 on a zero chExt height and still applies the offset, leaving width scaled", () => {
    const frame = groupTransform([1000, 2000, 3000, 0], [100, 200, 1500, 0])
    expectBox(box(group("2", frame, sp("3", xfrm(400, 250, 600, 10)))), {
      x: 1600,
      y: 2050,
      width: 1200,
      height: 10,
      ...plain,
    })
  })

  it("scales 1 on a zero chExt width and still applies the offset, leaving height scaled", () => {
    const frame = groupTransform([2000, 1000, 0, 3000], [200, 100, 0, 1500])
    expectBox(box(group("2", frame, sp("3", xfrm(250, 400, 10, 600)))), {
      x: 2050,
      y: 1600,
      width: 10,
      height: 1200,
      ...plain,
    })
  })

  it("scales 1 on both axes when chExt is zero on both, whatever the ext", () => {
    const frame = groupTransform([1000, 2000, 500, 700], [100, 200, 0, 0])
    expectBox(box(group("2", frame, sp("3", xfrm(150, 260, 10, 20)))), {
      x: 1050,
      y: 2060,
      width: 10,
      height: 20,
      ...plain,
    })
  })

  it("gives nested shapes and the group itself a box under a zero chExt", () => {
    const frame = groupTransform([1000, 2000, 3000, 0], [100, 200, 1500, 0])
    const nested = group("3", groupTransform([100, 250, 20, 10], [0, 0, 20, 10]), sp("4", xfrm(2, 3, 4, 5)))
    const elements = painted({ slide: group("2", frame, nested) })
    expectBox(boxOf(elements, "2"), { x: 1000, y: 2000, width: 3000, height: 0, ...plain })
    expectBox(boxOf(elements, "3"), { x: 1000, y: 2050, width: 40, height: 10, ...plain })
    expectBox(boxOf(elements, "4"), { x: 1004, y: 2053, width: 8, height: 5, ...plain })
  })

  it("passes a child through a group that has no transform", () => {
    const elements = painted({ slide: group("2", "", child) })
    expect(boxOf(elements, "2")).toBeNull()
    expectBox(boxOf(elements, "3"), { x: 100, y: 200, width: 300, height: 400, ...plain })
  })

  it("ignores the transform on the root of the tree", () => {
    expectBox(box(child), { x: 100, y: 200, width: 300, height: 400, ...plain })
  })

  it("applies the same transforms on layouts and masters", () => {
    const layout = group("10", scaled, child)
    expectBox(boxOf(painted({ layout }), "3"), { x: 1200, y: 2800, width: 600, height: 1600, ...plain })
  })

  it("moves a slide placeholder that inherits through its group", () => {
    const layout = sp("10", xfrm(100, 200, 300, 400), placeholder("title", null))
    const slide = group("2", scaled, sp("3", "", placeholder("title", null)))
    expectBox(boxOf(painted({ layout, slide }), "3"), { x: 1200, y: 2800, width: 600, height: 1600, ...plain })
  })

  it("gives a layout placeholder inside a group its final box", () => {
    const layout = group("10", scaled, sp("11", xfrm(100, 200, 300, 400), placeholder("title", null)))
    expectBox(boxOf(painted({ layout, slide: sp("2", "", placeholder("title", null)) }), "2"), {
      x: 1200,
      y: 2800,
      width: 600,
      height: 1600,
      ...plain,
    })
  })
})

describe("paintReader rule 9: graphic frames", () => {
  const frame = (inside: string) =>
    `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="2" name="t"><a:extLst><a:ext uri="{X}"/></a:extLst></p:cNvPr><p:cNvGraphicFramePr/><p:nvPr><p:extLst><p:ext uri="{Y}"/></p:extLst></p:nvPr></p:nvGraphicFramePr><p:xfrm><a:off x="1" y="2"/><a:ext cx="3" cy="4"/></p:xfrm><a:graphic><a:graphicData uri="u">${inside}</a:graphicData></a:graphic></p:graphicFrame>`

  it("keeps the frame with its box from p:xfrm", () => {
    const elements = painted({ slide: frame("") })
    expect(elements.map((element) => element.kind)).toEqual(["p:graphicFrame"])
    expectBox(boxOf(elements, "2"), { x: 1, y: 2, width: 3, height: 4, ...plain })
  })

  it("never lists anything inside a:graphicData", () => {
    const inside = `<p:oleObj>${sp("3", xfrm(0, 0, 1, 1))}<p:pic><p:nvPicPr><p:cNvPr id="4" name="p"/></p:nvPicPr></p:pic></p:oleObj>`
    expect(ids(painted({ slide: frame(inside) }))).toEqual(["2"])
  })

  it("only takes an a:ext with cx as a size", () => {
    const transform = `<a:xfrm><a:off x="1" y="2"/><a:ext uri="{Z}"/><a:ext cx="3" cy="4"/></a:xfrm>`
    expectBox(boxOf(painted({ slide: sp("2", transform) }), "2"), { x: 1, y: 2, width: 3, height: 4, ...plain })
  })

  it("does not take a size from an a:ext in an extension list", () => {
    const slide = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="s"><a:extLst><a:ext uri="{X}" cx="7" cy="7"/></a:extLst></p:cNvPr></p:nvSpPr><p:spPr/></p:sp>`
    expect(boxOf(painted({ slide }), "2")).toBeNull()
  })
})

describe("paintReader rule 10: group field", () => {
  const frame = groupTransform([0, 0, 1, 1], [0, 0, 1, 1])

  it("names the direct parent group, and null at the top", () => {
    const slide = group("2", frame, group("3", frame, sp("4", xfrm(0, 0, 1, 1)))) + sp("5", xfrm(0, 0, 1, 1))
    expect(painted({ slide }).map((element) => [element.shape, element.kind, element.group])).toEqual([
      ["2", "p:grpSp", null],
      ["3", "p:grpSp", "2"],
      ["4", "p:sp", "3"],
      ["5", "p:sp", null],
    ])
  })

  it("names the group through alternate content", () => {
    const inside = `<mc:AlternateContent><mc:Choice Requires="a">${sp("3", xfrm(0, 0, 1, 1))}</mc:Choice></mc:AlternateContent>`
    expect(painted({ slide: group("2", frame, inside) }).at(-1)?.group).toBe("2")
  })
})

describe("paintReader rule 11: identity and null boxes", () => {
  it("gives a layout or master element that part", () => {
    const elements = painted({ master: sp("20", xfrm(0, 0, 1, 1)), layout: sp("10", xfrm(0, 0, 1, 1)), slide: sp("2") })
    expect(elements.map((element) => element.part)).toEqual([masterPart, layoutPart, slidePart])
  })

  it("gives a null box only when no level has one", () => {
    expect(boxOf(painted({ slide: sp("2") }), "2")).toBeNull()
    expect(boxOf(painted({ slide: sp("2", "", placeholder("title", null)) }), "2")).toBeNull()
  })

  it("treats an empty transform on a placeholder as no transform", () => {
    const layout = sp("10", xfrm(1, 2, 3, 4), placeholder("title", null))
    const slide = sp("2", "<a:xfrm/>", placeholder("title", null))
    expectBox(boxOf(painted({ layout, slide }), "2"), { x: 1, y: 2, width: 3, height: 4, ...plain })
  })

  it("names every kind by its own non-visual id", () => {
    const pic = `<p:pic><p:nvPicPr><p:cNvPr id="3" name="p"/></p:nvPicPr><p:spPr>${xfrm(1, 1, 1, 1)}</p:spPr></p:pic>`
    const line = `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="4" name="c"/></p:nvCxnSpPr><p:spPr>${xfrm(2, 2, 2, 0)}</p:spPr></p:cxnSp>`
    const elements = painted({ slide: pic + line })
    expect(elements.map((element) => [element.shape, element.kind, element.box?.x])).toEqual([
      ["3", "p:pic", 1],
      ["4", "p:cxnSp", 2],
    ])
  })
})

describe("paintReader rule 12: missing and malformed input", () => {
  const without = (input: Deck, ...names: readonly string[]) => {
    const parts = deck(input)
    for (const name of names) parts.delete(name)
    return parts
  }
  const full = {
    master: sp("20", xfrm(0, 0, 1, 1)),
    layout: sp("10", xfrm(0, 0, 1, 1)),
    slide: sp("2", xfrm(0, 0, 1, 1)),
  }

  it("drops the levels above when the slide has no relationships", () => {
    expect(ids(paintedIn(without(full, "ppt/slides/_rels/slide1.xml.rels")))).toEqual(["2"])
  })

  it("drops a level whose part is missing", () => {
    expect(ids(paintedIn(without(full, layoutPart)))).toEqual(["2"])
    expect(ids(paintedIn(without(full, masterPart)))).toEqual(["10", "2"])
    expect(ids(paintedIn(without(full, "ppt/slideLayouts/_rels/slideLayout1.xml.rels")))).toEqual(["10", "2"])
  })

  it("gives a placeholder a null box when its level is missing", () => {
    const parts = without({ slide: sp("2", "", placeholder("title", null)) }, layoutPart)
    expect(boxOf(paintedIn(parts), "2")).toBeNull()
  })

  it("does not follow an external relationship", () => {
    const parts = deck(full)
    parts.set(
      "ppt/slides/_rels/slide1.xml.rels",
      xml(
        `<Relationships><Relationship Id="rId1" Type="${relationship}/slideLayout" TargetMode="External" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`,
      ),
    )
    expect(ids(paintedIn(parts))).toEqual(["2"])
  })

  it("gives a zero size when the presentation is missing or malformed", () => {
    const missing = paintReader(without({}, "ppt/presentation.xml")).slide(slidePart)
    expect([missing.width, missing.height]).toEqual([0, 0])
    const parts = deck({})
    parts.set("ppt/presentation.xml", xml(`<p:presentation><p:sldSz cx="wide" cy=""/></p:presentation>`))
    const malformed = paintReader(parts).slide(slidePart)
    expect([malformed.width, malformed.height]).toEqual([0, 0])
  })

  it.each(["", "abc", "1.5", "1e3", "0x10", "99999999999999999999"])("gives a null box for the number %j", (value) => {
    const offset = `<a:xfrm><a:off x="${value}" y="0"/><a:ext cx="1" cy="1"/></a:xfrm>`
    const size = `<a:xfrm><a:off x="0" y="0"/><a:ext cx="${value}" cy="1"/></a:xfrm>`
    const turned = `<a:xfrm rot="${value}"><a:off x="0" y="0"/><a:ext cx="1" cy="1"/></a:xfrm>`
    expect(boxOf(painted({ slide: sp("2", offset) }), "2")).toBeNull()
    expect(boxOf(painted({ slide: sp("2", size) }), "2")).toBeNull()
    expect(boxOf(painted({ slide: sp("2", turned) }), "2")).toBeNull()
  })

  it("gives a null box for a negative size", () => {
    expect(boxOf(painted({ slide: sp("2", xfrm(0, 0, -1, 1)) }), "2")).toBeNull()
  })

  it("does not inherit past a malformed box of the placeholder's own", () => {
    const layout = sp("10", xfrm(1, 2, 3, 4), placeholder("title", null))
    const own = `<a:xfrm><a:off x="bad" y="0"/><a:ext cx="1" cy="1"/></a:xfrm>`
    expect(boxOf(painted({ layout, slide: sp("2", own, placeholder("title", null)) }), "2")).toBeNull()
  })

  it("falls through a malformed layout box to the master", () => {
    const bad = `<a:xfrm><a:off x="bad" y="0"/><a:ext cx="1" cy="1"/></a:xfrm>`
    const layout = sp("10", bad, placeholder("title", null))
    const master = sp("20", xfrm(1, 2, 3, 4), placeholder("title", null))
    expectBox(boxOf(painted({ layout, master, slide: sp("2", "", placeholder("title", null)) }), "2"), {
      x: 1,
      y: 2,
      width: 3,
      height: 4,
      ...plain,
    })
  })

  it("gives children a null box under a malformed group", () => {
    const bad = `<a:xfrm><a:off x="bad" y="0"/><a:ext cx="1" cy="1"/><a:chOff x="0" y="0"/><a:chExt cx="1" cy="1"/></a:xfrm>`
    const elements = painted({ slide: group("2", bad, sp("3", xfrm(0, 0, 1, 1))) })
    expect(boxOf(elements, "3")).toBeNull()
  })

  it("gives children a null box under a group missing its child frame", () => {
    const partial = `<a:xfrm><a:off x="0" y="0"/><a:ext cx="1" cy="1"/></a:xfrm>`
    expect(boxOf(painted({ slide: group("2", partial, sp("3", xfrm(0, 0, 1, 1))) }), "3")).toBeNull()
  })

  it("gives a null box when nesting overflows the numbers", () => {
    const huge = groupTransform([0, 0, 9000000000000000, 1], [0, 0, 1, 1])
    let slide = sp("3", xfrm(0, 0, 9000000000000000, 1))
    for (let depth = 0; depth < 24; depth += 1) slide = group(`g${depth}`, huge, slide)
    expect(boxOf(painted({ slide }), "3")).toBeNull()
  })

  it("throws a named error for an unknown slide part", () => {
    const reader = paintReader(deck({}))
    expect(() => reader.slide("ppt/slides/slide9.xml")).toThrow(PaintPartError)
    expect(() => reader.slide(layoutPart)).toThrow(PaintPartError)
  })

  it("reads a slide outside the usual folder", () => {
    const parts = new Map([["ppt/custom/one.xml", xml(sheet("p:sld", "", sp("2", xfrm(0, 0, 1, 1))))]])
    expect(ids(paintReader(parts).slide("ppt/custom/one.xml").elements)).toEqual(["2"])
  })

  it("survives a very deep tree", () => {
    const depth = 12_000
    const opening = `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="9" name="g"/></p:nvGrpSpPr><p:grpSpPr/>`.repeat(depth)
    const parts = deck({ slide: `${opening}${"</p:grpSp>".repeat(depth)}` })
    expect(paintedIn(parts)).toHaveLength(depth)
  })
})

const fixtures = `${process.cwd()}/scripts/pptx-fixtures`
const decks = [
  ...readdirSync(fixtures).map((name) => `${fixtures}/${name}`),
  ...readdirSync(`${fixtures}/corpus`).map((name) => `${fixtures}/corpus/${name}`),
].filter((path) => path.endsWith(".pptx"))

const paintedParts =
  /^ppt\/(presentation\.xml|_rels\/presentation\.xml\.rels|(slides|slideLayouts|slideMasters)\/(_rels\/)?[^/]+)$/

const markupParts = (path: string): ReadonlyMap<string, Uint8Array> =>
  new Map(
    readContainer(new Uint8Array(readFileSync(path)))
      .filter((record) => paintedParts.test(record.name))
      .map((record) => [record.name, record.method === stored ? record.stream : inflateRawSync(record.stream)]),
  )

const hiddenRows = (bytes: Uint8Array): readonly string[] => {
  const { elements } = markupDocument(bytes)
  const isHidden = (element: MarkupElement) =>
    element.kind === "p:cNvPr" &&
    element.attributes.some((item) => item.name === "hidden" && (item.value === "1" || item.value === "true"))
  const hiddenShapes = new Set(elements.filter(isHidden).map((item) => elements[item.parent]?.parent))
  const shown = 0
  const hidden = 1
  const fallback = 2
  const states = new Uint8Array(elements.length)
  const rows: string[] = []
  for (const element of elements) {
    const above = states[element.parent] ?? shown
    if (element.kind === "mc:Fallback" || above === fallback) states[element.index] = fallback
    else states[element.index] = hiddenShapes.has(element.index) || above === hidden ? hidden : shown
    if (element.kind === "p:cNvPr" && element.id !== null && states[element.index] === hidden) rows.push(element.id)
  }
  return rows
}

const mayHide = (bytes: Uint8Array): boolean => decodeUtf8(bytes).includes(`hidden="`)

describe("paintReader on the real decks", () => {
  it("lists exactly the shapes readShapes lists, except hidden ones", () => {
    const drift: string[] = []
    let total = 0
    for (const path of decks) {
      const parts = markupParts(path)
      const reader = paintReader(parts)
      const expected = new Map<string, number>()
      const add = (key: string, by: number) => expected.set(key, (expected.get(key) ?? 0) + by)
      for (const row of readShapes(parts)) add(`${row.part}#${row.shape}`, 1)
      for (const { part } of readSlides(parts)) {
        const bytes = parts.get(part)
        if (bytes !== undefined && mayHide(bytes)) for (const id of hiddenRows(bytes)) add(`${part}#${id}`, -1)
        for (const element of reader.slide(part).elements) {
          total += 1
          if (element.from === "slide") add(`${element.part}#${element.shape}`, -1)
        }
      }
      for (const [key, count] of expected) if (count !== 0) drift.push(`${path} ${key} ${count}`)
    }
    expect(drift).toEqual([])
    expect(total).toBeGreaterThan(0)
  }, 30_000)
})
