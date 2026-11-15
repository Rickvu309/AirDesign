import { paintKind } from "@airdesign/pptx"
import { elementId } from "@airdesign/document"
import type {
  PaintBox,
  PaintElement,
  PaintFill,
  PaintLine,
  PaintParagraph,
  PaintReader,
  PaintRunStyle,
  PaintText,
  SlidePaint,
} from "@airdesign/pptx"
import { expect, it } from "vitest"
import { slideCanvases, type CanvasSource } from "./canvas-slide"

const part = "ppt/slides/slide1.xml"
const box: PaintBox = { x: 1, y: 2, width: 3, height: 4, rotation: 0, flipH: false, flipV: false }
const size = { width: 12_192_000, height: 6_858_000 }
const id = elementId("256.2")

function row(overrides: Partial<PaintElement> = {}): PaintElement {
  return {
    part,
    shape: "2",
    from: "slide",
    kind: "p:sp",
    box,
    group: null,
    placeholder: null,
    text: null,
    fill: null,
    line: null,
    geometry: null,
    image: null,
    ...overrides,
  }
}

function reader(paint: Omit<SlidePaint, "background">, reads: string[] = []): PaintReader {
  return {
    slide(slidePart) {
      reads.push(slidePart)
      return { ...paint, background: null }
    },
  }
}

const source: CanvasSource = { part, shapes: new Map([["2", { id, kind: "shape", editable: true, movable: false }]]) }
const movable: CanvasSource = { part, shapes: new Map([["2", { id, kind: "shape", editable: true, movable: true }]]) }

it("carries the deck's size and each row's own box", () => {
  const canvas = slideCanvases(reader({ ...size, elements: [row()] }), [source])(0)
  expect(canvas).toEqual({
    ...size,
    background: null,
    part,
    elements: [
      {
        key: `${part}#2`,
        id,
        kind: "shape",
        box,
        editable: true,
        movable: false,
        placeholder: false,
        filled: false,
        fill: null,
        line: null,
        outline: "box",
        text: null,
      },
    ],
  })
})

const css = (hex: string): string => `#${hex}`

const seen = { hex: "112233", alpha: 1 }
const clear = { hex: "112233", alpha: 0 }

it.each<[string, PaintFill | null, boolean]>([
  ["no fill read", null, false],
  ["no fill", { type: "none" }, false],
  ["a clear solid", { type: "solid", color: clear }, false],
  ["a solid", { type: "solid", color: seen }, true],
  ["a clear gradient", { type: "gradient", stops: [{ position: 0, color: clear }], angle: 0, path: null }, false],
  [
    "a gradient",
    {
      type: "gradient",
      stops: [
        { position: 0, color: clear },
        { position: 1, color: seen },
      ],
      angle: 0,
      path: null,
    },
    true,
  ],
  ["a clear pattern", { type: "pattern", preset: "pct5", foreground: clear, background: clear }, false],
  ["a pattern", { type: "pattern", preset: "pct5", foreground: clear, background: seen }, true],
  [
    "a picture",
    {
      type: "picture",
      part: "ppt/media/image1.png",
      contentType: "image/png",
      crop: { left: 0, top: 0, right: 0, bottom: 0 },
      tile: false,
    },
    true,
  ],
])("reads whether %s is a visible fill", (_name, fill, filled) => {
  const canvas = slideCanvases(reader({ ...size, elements: [row({ fill })] }), [source])(0)
  expect(canvas?.elements[0]?.filled).toBe(filled)
})

it("says which row is a placeholder", () => {
  const title = row({ shape: "3", placeholder: { type: "title", index: null } })
  const canvas = slideCanvases(reader({ ...size, elements: [row(), title] }), [source])(0)
  expect(canvas?.elements.map((each) => [each.key, each.placeholder])).toEqual([
    [`${part}#2`, false],
    [`${part}#3`, true],
  ])
})

it("paints a layout row under the slide with no document id even when its shape number matches a slide shape", () => {
  const layout = "ppt/slideLayouts/slideLayout1.xml"
  const canvas = slideCanvases(reader({ ...size, elements: [row({ part: layout, from: "layout" }), row()] }), [source])(
    0,
  )
  expect(canvas?.elements.map((each) => [each.key, each.id, each.editable])).toEqual([
    [`${layout}#2`, null, false],
    [`${part}#2`, id, true],
  ])
})

it("leaves a group out, since its children carry their own boxes", () => {
  const canvas = slideCanvases(
    reader({ ...size, elements: [row({ shape: "9", kind: "p:grpSp" }), row({ group: "9" })] }),
    [source],
  )(0)
  expect(canvas?.elements.map((each) => each.key)).toEqual([`${part}#2`])
})

it("paints a group's effects over everything it holds, a group inside it included", () => {
  const shapes = new Map([
    ["9", { id: elementId("256.9"), kind: "group" as const, editable: false, movable: true }],
    ["7", { id: elementId("256.7"), kind: "group" as const, editable: false, movable: false }],
    ["2", { id, kind: "shape" as const, editable: true, movable: false }],
    ["3", { id: elementId("256.3"), kind: "shape" as const, editable: true, movable: false }],
    ["4", { id: elementId("256.4"), kind: "shape" as const, editable: true, movable: false }],
  ])
  const glow = { radius: 63_500, color: { hex: "FF0000", alpha: 1 } }
  const canvas = slideCanvases(
    reader({
      ...size,
      elements: [
        row({ shape: "9", kind: "p:grpSp", effects: { glow } }),
        row({ shape: "7", kind: "p:grpSp", group: "9" }),
        row({ shape: "2", group: "7" }),
        row({ shape: "3", group: "9" }),
        row({ shape: "4" }),
      ],
    }),
    [{ part, shapes }],
  )(0)
  expect(canvas?.elements.map((each) => [each.key, each.held ?? 0])).toEqual([
    [`${part}#9`, 3],
    [`${part}#7`, 1],
    [`${part}#2`, 0],
    [`${part}#3`, 0],
    [`${part}#4`, 0],
  ])
  expect(canvas?.elements[0]?.effects).toEqual({ glow: { radius: 63_500, color: css("FF0000") } })
})

it("counts what a group holds through a group inside it that has no element", () => {
  const shapes = new Map([
    ["9", { id: elementId("256.9"), kind: "group" as const, editable: false, movable: true }],
    ["2", { id, kind: "shape" as const, editable: true, movable: false }],
  ])
  const canvas = slideCanvases(
    reader({
      ...size,
      elements: [
        row({ shape: "9", kind: "p:grpSp", effects: { softEdge: { radius: 1 } } }),
        row({ shape: "7", kind: "p:grpSp", group: "9" }),
        row({ shape: "2", group: "7" }),
      ],
    }),
    [{ part, shapes }],
  )(0)
  expect(canvas?.elements.map((each) => [each.key, each.held ?? 0])).toEqual([
    [`${part}#9`, 1],
    [`${part}#2`, 0],
  ])
})

it("gives two rows that share a shape number different keys", () => {
  const canvas = slideCanvases(reader({ ...size, elements: [row(), row()] }), [source])(0)
  expect(canvas?.elements.map((each) => each.key)).toEqual([`${part}#2`, `${part}#2#1`])
})

it("reads only the slide that is asked for, and once", () => {
  const reads: string[] = []
  const other: CanvasSource = { part: "ppt/slides/slide2.xml", shapes: new Map() }
  const canvases = slideCanvases(reader({ ...size, elements: [] }, reads), [source, other])
  expect(reads).toEqual([])
  const first = canvases(1)
  expect(canvases(1)).toBe(first)
  expect(reads).toEqual(["ppt/slides/slide2.xml"])
})

it("answers no slide past the end of the deck", () => {
  expect(slideCanvases(reader({ ...size, elements: [] }), [])(0)).toBeNull()
})

it("uses the standard slide when the deck names no size", () => {
  const canvas = slideCanvases(reader({ width: 0, height: 0, elements: [] }), [source])(0)
  expect(canvas).toMatchObject({ width: 9_144_000, height: 6_858_000 })
})

it("keeps every shape's words on the slide when the reader cannot read it", () => {
  const broken: PaintReader = {
    slide() {
      throw new Error("markup")
    },
  }
  const canvas = slideCanvases(broken, [source])(0)
  expect(canvas?.elements).toEqual([
    {
      key: `${part}#2`,
      id,
      kind: "shape",
      box: null,
      editable: true,
      movable: false,
      placeholder: false,
      filled: false,
      fill: null,
      line: null,
      outline: "box",
      text: null,
    },
  ])
})

it("keeps every shape's words on the slide when the reader lists none of the slide's own shapes", () => {
  const layout = "ppt/slideLayouts/slideLayout1.xml"
  const canvas = slideCanvases(reader({ ...size, elements: [row({ part: layout, from: "layout" })] }), [source])(0)
  expect(canvas?.elements.map((each) => [each.key, each.box])).toEqual([
    [`${layout}#2`, box],
    [`${part}#2`, null],
  ])
})

it("names each kind the way the record does", () => {
  expect(["p:sp", "p:pic", "p:cxnSp", "p:grpSp", "p:graphicFrame"].map((kind) => paintKind(kind as never))).toEqual([
    "shape",
    "picture",
    "connector",
    "group",
    "chart",
  ])
})

it("paints the slide with the file's background", () => {
  const paint: SlidePaint = {
    ...size,
    elements: [row()],
    background: { type: "solid", color: { hex: "A1B2C3", alpha: 1 } },
  }
  const canvas = slideCanvases({ slide: () => paint }, [source])(0)
  expect(canvas?.background).toBe(css("A1B2C3"))
})

function painted(overrides: Partial<PaintElement>) {
  const canvas = slideCanvases(reader({ ...size, elements: [row(overrides)] }), [source])(0)
  const element = canvas?.elements[0]
  if (element === undefined) throw new Error("no element")
  return element
}

it.each<[string, PaintFill, string | null]>([
  ["no fill", { type: "none" }, null],
  ["a solid", { type: "solid", color: { hex: "0A0B0C", alpha: 1 } }, css("0A0B0C")],
  ["a clear solid", { type: "solid", color: { hex: "0A0B0C", alpha: 0.5 } }, css("0A0B0C80")],
  [
    "a linear gradient",
    {
      type: "gradient",
      stops: [
        { position: 0, color: { hex: "000000", alpha: 1 } },
        { position: 1, color: { hex: "FFFFFF", alpha: 1 } },
      ],
      angle: 45,
      path: null,
    },
    `linear-gradient(135deg, ${css("000000")} 0%, ${css("FFFFFF")} 100%)`,
  ],
  [
    "a path gradient",
    {
      type: "gradient",
      stops: [{ position: 0.5, color: { hex: "123456", alpha: 1 } }],
      angle: null,
      path: { kind: "circle", focus: null },
    },
    `radial-gradient(${css("123456")} 50%)`,
  ],
  [
    "a pattern, by its background",
    {
      type: "pattern",
      preset: "pct5",
      foreground: { hex: "111111", alpha: 1 },
      background: { hex: "EEEEEE", alpha: 1 },
    },
    css("EEEEEE"),
  ],
])("turns %s into the fill the box paints", (_, fill, css) => {
  expect(painted({ fill }).fill).toBe(css)
})

const picture = {
  type: "picture",
  part: "ppt/media/image1.png",
  contentType: "image/png",
  crop: { left: 0, top: 0, right: 0, bottom: 0 },
  tile: false,
} as const
const layer = 'url("blob:1") 0% 0% / 100% 100% no-repeat'
const drawn = () => "blob:1"
const undrawn = () => null

function pictured(overrides: Partial<PaintElement>, src: (image: unknown) => string | null) {
  const canvas = slideCanvases(reader({ ...size, elements: [row(overrides)] }), [source], src)(0)
  return canvas?.elements[0]?.fill
}

it("paints a picture fill from the picture's own address", () => {
  expect(pictured({ fill: picture }, drawn)).toBe(layer)
})

it("shows a picture fill the browser cannot draw as the box it cannot show", () => {
  expect(pictured({ fill: picture }, undrawn)).toBe("var(--line)")
})

it("paints a picture's image at its box over the picture's own fill", () => {
  const under = { type: "solid", color: { hex: "0A0B0C", alpha: 1 } } as const
  expect(pictured({ kind: "p:pic", image: picture, fill: under }, drawn)).toBe(`${layer}, ${css("0A0B0C")}`)
  expect(pictured({ kind: "p:pic", image: picture }, drawn)).toBe(layer)
})

it("shows a picture the browser cannot draw as the box it cannot show", () => {
  expect(pictured({ kind: "p:pic", image: picture }, undrawn)).toBe("var(--line)")
})

it("paints the slide's picture background", () => {
  const paint: SlidePaint = { ...size, elements: [], background: picture }
  expect(slideCanvases({ slide: () => paint }, [source], drawn)(0)?.background).toBe(layer)
  expect(slideCanvases({ slide: () => paint }, [source], undrawn)(0)?.background).toBe("var(--line)")
})

const line: PaintLine = {
  fill: { type: "solid", color: { hex: "334455", alpha: 1 } },
  width: 38_100,
  dash: "dash",
  head: null,
  tail: null,
}

it("carries a line's colour, width and dash apart from the fill", () => {
  const element = painted({ fill: { type: "solid", color: { hex: "AABBCC", alpha: 1 } }, line })
  expect(element.fill).toBe(css("AABBCC"))
  expect(element.line).toEqual({ color: css("334455"), width: 38_100, dash: [4, 3] })
})

it("paints no line when the line has no fill", () => {
  expect(painted({ line: { ...line, fill: { type: "none" } } }).line).toBeNull()
})

it.each<[string, readonly number[] | null]>([
  ["solid", null],
  ["dot", [1, 3]],
  ["dash", [4, 3]],
  ["lgDash", [8, 3]],
  ["dashDot", [4, 3, 1, 3]],
  ["lgDashDot", [8, 3, 1, 3]],
  ["lgDashDotDot", [8, 3, 1, 3, 1, 3]],
  ["sysDash", [3, 1]],
  ["sysDot", [1, 1]],
  ["sysDashDot", [3, 1, 1, 1]],
  ["sysDashDotDot", [3, 1, 1, 1, 1, 1]],
])("gives a %s line the dash PowerPoint draws, in line widths", (dash, expected) => {
  expect(painted({ line: { ...line, dash } }).line?.dash ?? null).toEqual(expected)
})

it("draws a solid line with no dash", () => {
  expect(painted({ line: { ...line, dash: "solid" } }).line?.dash).toBeNull()
})

it.each<[string, Partial<PaintElement>, string]>([
  ["a rectangle", { geometry: "rect" }, "box"],
  ["a preset with vector geometry", { geometry: "star5" }, "box"],
  ["a rounded rectangle", { geometry: "roundRect" }, "round"],
  ["an ellipse", { geometry: "ellipse" }, "ellipse"],
  ["a line", { geometry: "line" }, "line"],
  ["a connector", { kind: "p:cxnSp", geometry: "bentConnector3" }, "line"],
])("draws %s with its outline", (_, overrides, outline) => {
  expect(painted(overrides).outline).toBe(outline)
})

it("never fills a line", () => {
  expect(painted({ geometry: "line", fill: { type: "solid", color: seen } }).fill).toBeNull()
})

const runLook: PaintRunStyle = {
  font: "Serifa",
  size: 24,
  bold: true,
  italic: true,
  underline: false,
  strike: false,
  baseline: 0,
  color: { hex: "102030", alpha: 1 },
  highlight: null,
}

const paragraph: PaintParagraph = {
  from: 2,
  align: "distributed",
  level: 0,
  marginLeft: 0,
  indent: 0,
  lineSpacing: null,
  spaceBefore: null,
  spaceAfter: null,
  bullet: null,
  runs: [{ ...runLook, from: 3, kind: "text", text: "words" }],
  endStyle: { ...runLook, size: 12, font: null, color: null, bold: false, italic: false },
}

const text: PaintText = {
  paragraphs: [paragraph],
  anchor: "middle",
  insets: { left: 1, top: 2, right: 3, bottom: 4 },
  wrap: false,
  fit: "shrink",
  vertical: false,
  flow: "horz",
  columns: 1,
  columnGap: 0,
  fontScale: 0.5,
  spacingReduction: 0,
}

it("keeps a paragraph's bullet, gaps and run marks, and reduces its line spacing", () => {
  const marked: PaintText = {
    ...text,
    fontScale: 1,
    spacingReduction: 0.5,
    paragraphs: [
      {
        ...paragraph,
        marginLeft: 285_750,
        indent: -285_750,
        lineSpacing: { points: 10 },
        spaceBefore: { points: 6 },
        spaceAfter: { percent: 0.2 },
        bullet: { autoNumber: "arabicPeriod", start: 1, number: 2, font: null, color: null, size: null },
        runs: [
          {
            ...runLook,
            from: 3,
            kind: "text",
            text: "words",
            underline: true,
            strike: true,
            baseline: 0.3,
            highlight: { hex: "FFFF00", alpha: 1 },
          },
        ],
      },
    ],
  }
  expect(painted({ text: marked }).text?.paragraphs[0]).toMatchObject({
    marginLeft: 285_750,
    indent: -285_750,
    lineSpacing: { length: 63_500 },
    spaceBefore: { length: 76_200 },
    spaceAfter: { percent: 0.2 },
    bullet: { autoNumber: "arabicPeriod", number: 2, font: null, color: null, size: null },
    runs: [{ underline: true, strike: true, baseline: 0.3, highlight: css("FFFF00"), size: 304_800 }],
  })
  const tightened: PaintText = { ...text, spacingReduction: 0.25 }
  expect(painted({ text: tightened }).text?.paragraphs[0]?.lineSpacing).toEqual({ percent: 0.75 })
})

it("turns a paragraph's points into the slide's units, shrunk by the box's font scale", () => {
  expect(painted({ text }).text).toEqual({
    anchor: "middle",
    insets: { left: 1, top: 2, right: 3, bottom: 4 },
    wrap: false,
    flow: "horz",
    columns: 1,
    columnGap: 0,
    paragraphs: [
      {
        from: 2,
        align: "justify",
        marginLeft: 0,
        indent: 0,
        lineSpacing: null,
        spaceBefore: null,
        spaceAfter: null,
        bullet: null,
        runs: [
          {
            from: 3,
            text: "words",
            font: "Serifa",
            size: 152_400,
            points: 2400,
            bold: true,
            italic: true,
            underline: false,
            strike: false,
            baseline: 0,
            color: css("102030"),
            highlight: null,
          },
        ],
        endStyle: {
          font: null,
          size: 76_200,
          points: 1200,
          bold: false,
          italic: false,
          underline: false,
          strike: false,
          baseline: 0,
          color: null,
          highlight: null,
        },
      },
    ],
  })
})

it("lets a slide shape move when the host can keep its box", () => {
  const canvas = slideCanvases(reader({ ...size, elements: [row()] }), [movable])(0)
  expect(canvas?.elements.map((each) => each.movable)).toEqual([true])
})

it("does not move a shape inside a group, since its box is in the group's space", () => {
  const canvas = slideCanvases(reader({ ...size, elements: [row({ group: "5" })] }), [movable])(0)
  expect(canvas?.elements.map((each) => each.movable)).toEqual([false])
})

it("does not move a shape the reader gave no place", () => {
  const placeless = slideCanvases(reader({ ...size, elements: [row({ box: null })] }), [movable])(0)
  const broken = slideCanvases({ slide: () => ({ ...size, background: null, elements: [] }) }, [movable])(0)
  expect([...(placeless?.elements ?? []), ...(broken?.elements ?? [])].map((each) => each.movable)).toEqual([
    false,
    false,
  ])
})
