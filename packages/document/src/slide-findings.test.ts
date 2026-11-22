import { describe, expect, it } from "vitest"
import type { Fill, ResolvedElement, ResolvedSlide, ResolvedText } from "./resolved-slide.js"
import { findingLimits, type Finding } from "./finding.js"
import { elementOverflow, slideFindings } from "./slide-findings.js"
import { fontFace, type FontWidths } from "./text-fit.js"

const point = 12_700
const even = Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((char) => [char, 0.5]))
const widths: FontWidths = {
  [fontFace("Plain", false, false)]: { ascent: 0.8, descent: 0.2, advances: { ...even, " ": 0.25 } },
  [fontFace("Plain", true, false)]: { ascent: 0.8, descent: 0.2, advances: { ...even, " ": 0.25 } },
}

type Shape = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

function words(
  lines: readonly string[],
  size = 10,
  more: Partial<ResolvedText> = {},
  color: string | null = "000000",
  bold = false,
): ResolvedText {
  return {
    paragraphs: lines.map((line) => ({
      align: "left",
      level: 0,
      marginLeft: 0,
      indent: 0,
      lineHeight: null,
      spaceBefore: null,
      spaceAfter: null,
      bullet: null,
      runs:
        line === ""
          ? []
          : [{ text: line, font: "Plain", size, bold, italic: false, color: color === null ? null : { rgb: color } }],
      end: { font: "Plain", size },
    })),
    insets: { left: 0, top: 0, right: 0, bottom: 0 },
    anchor: "top",
    wrap: true,
    fit: "none",
    fontScale: 1,
    lineReduction: 0,
    vertical: false,
    ...more,
  }
}

function element(node: string, shape: Shape, more: Partial<ResolvedElement> = {}): ResolvedElement {
  return {
    node,
    kind: "shape",
    from: "slide",
    box: { x: shape.x * point, y: shape.y * point, cx: shape.w * point, cy: shape.h * point },
    rotation: 0,
    grouped: false,
    placeholder: null,
    fill: "none",
    text: null,
    ...more,
  }
}

function slide(elements: readonly ResolvedElement[], background: Fill = { rgb: "FFFFFF" }): ResolvedSlide {
  return { slide: "256", size: { width: 960 * point, height: 540 * point }, background, elements }
}

function codes(found: readonly Finding[]): readonly string[] {
  return found.map((finding) => `${finding.code} ${finding.node}`)
}

function find(elements: readonly ResolvedElement[], background?: Fill): readonly Finding[] {
  return slideFindings(slide(elements, background), widths).findings
}

describe("overflow", () => {
  const tall = words(["aaaa bbbb cccc dddd eeee ffff"])

  it("reports text taller than its box, by how much, and the size and height that fit", () => {
    const found = find([element("2", { x: 10, y: 10, w: 50, h: 20 }, { text: tall })])
    expect(codes(found)).toEqual(["overflow 2"])
    const overflow = found[0]
    if (overflow?.code !== "overflow") throw new Error("no overflow")
    expect(overflow.needed).toBeCloseTo(36)
    expect(overflow.room).toBeCloseTo(20)
    expect(overflow.fix.height).toBeCloseTo(36)
    expect(overflow.fix.size).toBe(7)
  })

  it("leaves a box PowerPoint shrinks or grows, and text within the tolerance", () => {
    const shrink = words(["aaaa bbbb cccc dddd eeee ffff"], 10, { fit: "shrink" })
    const grow = words(["aaaa bbbb cccc dddd eeee ffff"], 10, { fit: "grow" })
    const close = element("4", { x: 10, y: 100, w: 50, h: 36 - findingLimits.overflow + 0.5 }, { text: tall })
    expect(
      find([
        element("2", { x: 10, y: 10, w: 50, h: 20 }, { text: shrink }),
        element("3", { x: 100, y: 10, w: 50, h: 20 }, { text: grow }),
        close,
      ]),
    ).toEqual([])
  })

  it("judges one element's overflow the way the slide's findings do", () => {
    const box = element("2", { x: 10, y: 10, w: 50, h: 20 }, { text: tall })
    expect(elementOverflow("256", box, widths)).toEqual(find([box])[0])
    expect(elementOverflow("256", element("3", { x: 10, y: 10, w: 50, h: 40 }, { text: tall }), widths)).toBeNull()
    expect(elementOverflow("256", element("4", { x: 10, y: 10, w: 50, h: 5 }), widths)).toBeNull()
    const strange = element("5", { x: 10, y: 10, w: 50, h: 5 }, { text: words(["aaaa 你好"]) })
    expect(elementOverflow("256", strange, widths)).toBe("script")
  })

  it("counts text it cannot judge instead of guessing", () => {
    const strange = words(["aaaa 你好"])
    const result = slideFindings(slide([element("2", { x: 10, y: 10, w: 50, h: 5 }, { text: strange })]), widths)
    expect(result.findings).toEqual([])
    expect(result.unjudged).toEqual([{ node: "2", reason: "script" }])
  })
})

describe("off-slide", () => {
  it("reports text that runs past the slide's edge", () => {
    const found = find([element("2", { x: 930, y: 10, w: 100, h: 20 }, { text: words(["aaaa bbbb"]) })])
    expect(codes(found)).toEqual(["off-slide 2"])
    const off = found[0]
    if (off?.code !== "off-slide") throw new Error("no off-slide")
    expect(off.level).toBe("fault")
    expect(off.past).toBeCloseTo(12.5)
    expect(off.fix).toEqual({ x: 860, y: 10 })
  })

  it("leaves a box that reaches past the edge while its text stays on the slide", () => {
    expect(find([element("2", { x: 900, y: 10, w: 200, h: 20 }, { text: words(["aaaa"]) })])).toEqual([])
  })

  it("leaves a line that runs past the edge when its box sits on the slide", () => {
    const hung = words(["aaaa"])
    const text = {
      ...hung,
      paragraphs: hung.paragraphs.map((paragraph) => ({ ...paragraph, indent: -100 * point })),
    }
    expect(find([element("2", { x: 50, y: 10, w: 200, h: 40 }, { text })])).toEqual([])
  })

  it("leaves a picture that bleeds past the edge, and notes one wholly off the slide", () => {
    const found = find([
      element("2", { x: -20, y: -20, w: 1000, h: 580 }, { fill: "image" }),
      element("3", { x: 1000, y: 10, w: 100, h: 100 }, { fill: "image" }),
    ])
    expect(found.map((finding) => `${finding.code} ${finding.node} ${finding.level}`)).toEqual(["off-slide 3 note"])
  })

  it("reports a chart cut by the slide's edge", () => {
    expect(codes(find([element("2", { x: 800, y: 10, w: 200, h: 100 }, { kind: "chart" })]))).toEqual(["off-slide 2"])
  })
})

describe("overlap", () => {
  const title = words(["aaaa bbbb"])

  it("reports text painted over text", () => {
    const found = find([
      element("2", { x: 10, y: 10, w: 200, h: 40 }, { text: title }),
      element("3", { x: 20, y: 12, w: 200, h: 40 }, { text: words(["cccc dddd"]) }),
    ])
    expect(codes(found)).toEqual(["overlap 2"])
    const overlap = found[0]
    if (overlap?.code !== "overlap") throw new Error("no overlap")
    expect(overlap.other).toBe("3")
    expect(overlap.by).toBe("text")
  })

  it("leaves boxes that overlap while their lines do not", () => {
    expect(
      find([
        element("2", { x: 10, y: 10, w: 200, h: 100 }, { text: title }),
        element("3", { x: 10, y: 40, w: 200, h: 100 }, { text: words(["cccc dddd"]) }),
      ]),
    ).toEqual([])
  })

  it("reports a filled shape painted over text, and leaves a picture there", () => {
    const text = element("2", { x: 10, y: 10, w: 200, h: 40 }, { text: title })
    const found = find([text, element("3", { x: 15, y: 5, w: 30, h: 30 }, { fill: { rgb: "222222" } })])
    expect(codes(found)).toEqual(["overlap 2"])
    expect(found[0]?.code === "overlap" ? found[0].by : null).toBe("cover")
    expect(find([text, element("3", { x: 15, y: 5, w: 30, h: 30 }, { fill: "image" })])).toEqual([])
  })

  it("leaves a picture or a filled shape behind text, an empty frame, a line and a group", () => {
    expect(
      find([
        element("1", { x: 0, y: 0, w: 960, h: 540 }, { fill: "image" }),
        element("2", { x: 5, y: 5, w: 300, h: 100 }, { fill: { rgb: "222222" } }),
        element("3", { x: 10, y: 10, w: 200, h: 40 }, { text: words(["aaaa bbbb"], 10, {}, "FFFFFF") }),
        element("4", { x: 15, y: 5, w: 30, h: 30 }),
        element("5", { x: 0, y: 15, w: 300, h: 0 }, { kind: "connector" }),
        element("6", { x: 400, y: 10, w: 100, h: 40 }, { text: title, grouped: true }),
        element("7", { x: 410, y: 12, w: 100, h: 40 }, { text: title, grouped: true }),
      ]),
    ).toEqual([])
  })
})

describe("small text", () => {
  it("reports text under the readable size, scaled by the slide's height", () => {
    const found = find([element("2", { x: 10, y: 10, w: 400, h: 40 }, { text: words(["aaaa"], 8) })])
    expect(codes(found)).toEqual(["small-text 2"])
    expect(found[0]?.code === "small-text" ? found[0] : null).toMatchObject({ size: 8, fix: { size: 10 } })
  })

  it("counts the stored shrink, and leaves footers, dates and slide numbers", () => {
    const shrunk = words(["aaaa"], 16, { fontScale: 0.5 })
    const found = find([
      element("2", { x: 10, y: 10, w: 400, h: 40 }, { text: shrunk }),
      element("3", { x: 10, y: 500, w: 400, h: 20 }, { text: words(["aaaa"], 8), placeholder: "ftr" }),
      element("4", { x: 10, y: 100, w: 400, h: 40 }, { text: words(["aaaa"], 10) }),
    ])
    expect(codes(found)).toEqual(["small-text 2"])
  })
})

describe("low contrast", () => {
  it("reports text too close in colour to the solid fill behind it", () => {
    const found = find([element("2", { x: 10, y: 10, w: 200, h: 40 }, { text: words(["aaaa"], 10, {}, "BBBBBB") })])
    expect(codes(found)).toEqual(["low-contrast 2"])
    const low = found[0]
    if (low?.code !== "low-contrast") throw new Error("no contrast")
    expect(low.ratio).toBeCloseTo(1.92, 1)
    expect(low.needs).toBe(4.5)
    expect(low.fix.color).toBe("000000")
  })

  it("judges against the shape behind the text, and lets large bold text pass at 3:1", () => {
    expect(
      find([
        element("1", { x: 0, y: 0, w: 300, h: 100 }, { fill: { rgb: "333333" } }),
        element("2", { x: 10, y: 10, w: 200, h: 40 }, { text: words(["aaaa"], 10, {}, "BBBBBB") }),
        element("3", { x: 400, y: 10, w: 300, h: 60 }, { text: words(["aaaa"], 20, {}, "8A8A8A", true) }),
      ]),
    ).toEqual([])
  })

  it("leaves a footer, a date and a slide number", () => {
    const grey = words(["aaaa"], 12, {}, "8B8B8B")
    expect(
      find([
        element("2", { x: 10, y: 500, w: 80, h: 20 }, { placeholder: "ftr", text: grey }),
        element("3", { x: 200, y: 500, w: 80, h: 20 }, { placeholder: "dt", text: grey }),
        element("4", { x: 400, y: 500, w: 40, h: 20 }, { placeholder: "sldNum", text: grey }),
      ]),
    ).toEqual([])
  })

  it("leaves text on a picture, a gradient or a shape that covers only part of it", () => {
    expect(
      find([
        element("1", { x: 0, y: 0, w: 100, h: 100 }, { fill: "image" }),
        element("2", { x: 10, y: 10, w: 200, h: 40 }, { text: words(["aaaa"], 10, {}, "BBBBBB") }),
        element("3", { x: 300, y: 0, w: 300, h: 100 }, { fill: "unknown" }),
        element("4", { x: 310, y: 10, w: 200, h: 40 }, { text: words(["aaaa"], 10, {}, "BBBBBB") }),
        element("5", { x: 600, y: 0, w: 20, h: 100 }, { fill: { rgb: "BBBBBB" } }),
        element("6", { x: 605, y: 10, w: 200, h: 40 }, { text: words(["aaaa"], 10, {}, "CCCCCC") }),
      ]),
    ).toEqual([])
  })
})

describe("empty placeholder", () => {
  it("notes a placeholder that will show its prompt while editing and nothing in a slide show", () => {
    const found = find([
      element("2", { x: 10, y: 10, w: 400, h: 40 }, { placeholder: "title", text: words([""]) }),
      element("3", { x: 10, y: 100, w: 400, h: 40 }, { placeholder: "body", text: words(["aaaa"]) }),
      element("4", { x: 10, y: 200, w: 400, h: 40 }, { text: words([""]) }),
      element("5", { x: 10, y: 500, w: 400, h: 20 }, { placeholder: "sldNum", text: null }),
    ])
    expect(found.map((finding) => `${finding.code} ${finding.node} ${finding.level}`)).toEqual([
      "empty-placeholder 2 note",
    ])
  })
})
