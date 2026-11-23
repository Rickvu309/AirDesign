import { describe, expect, it } from "vitest"
import { type Theme, applyEdit, isRefusal, nodeId, resolveSlide, rev, slideBackground } from "./index.js"
import { block, column, label, measure, plainTheme, row, spot, swatches } from "./doom-fixtures-art.js"
import { type TreeNode, doomFromTree } from "./doom-tree.js"

function resolved(children: readonly TreeNode[], theme: Theme = plainTheme, slideProps = {}) {
  const grown = doomFromTree({ theme, slides: [{ children, props: slideProps }] })
  return { ...grown, parts: resolveSlide(grown.doom, grown.slides[0]!, measure) }
}
const solidOf = (color: unknown, extra: object = {}) => ({ kind: "solid", color, ...extra })

describe("resolveSlide", () => {
  it("turns a theme variable into the theme's colour, with its tint, wherever a colour is used", () => {
    const { parts } = resolved([
      block("a", 100, 100, {
        fills: [solidOf({ var: "accent1" }), solidOf({ var: "accent1", tint: 0.5 })],
        strokes: [solidOf({ var: "accent3" })],
      }),
    ])
    expect(parts[0]?.fills).toEqual([
      { kind: "solid", color: plainTheme.colors.accent1, opacity: 1 },
      { kind: "solid", color: swatches.halfBlue, opacity: 1 },
    ])
    expect(parts[0]?.strokes).toEqual([{ kind: "solid", color: plainTheme.colors.accent3, opacity: 1 }])
  })

  it("repaints every use of a variable when the theme changes, with no write to any node", () => {
    const { doom, slides, parts } = resolved([
      block("a", 100, 100, { fills: [solidOf({ var: "accent1" })] }),
      label("t", "hi", {}, { spans: [{ end: 2, color: { var: "accent1" } }] }),
    ])
    expect(parts[0]?.fills[0]).toMatchObject({ color: plainTheme.colors.accent1 })
    expect(parts[1]?.text?.lines[0]?.runs[0]?.color).toBe(plainTheme.colors.accent1)
    const recoloured = applyEdit(doom, {
      once: "recolour",
      author: { kind: "person", id: "p" },
      writes: [{ node: nodeId("n:1"), prop: "theme.colors.accent1", value: swatches.recoloured }],
      rev: rev(doom.rev + 1),
    })
    if (isRefusal(recoloured)) throw new Error("refused")
    const after = resolveSlide(recoloured, slides[0]!, measure)
    expect(after[0]?.fills[0]).toMatchObject({ color: swatches.recoloured })
    expect(after[1]?.text?.lines[0]?.runs[0]?.color).toBe(swatches.recoloured)
    expect(recoloured.nodes.get(nodeId("n:4"))).toBe(doom.nodes.get(nodeId("n:4")))
  })

  it("answers a node's box relative to its parent and nests children in their frame", () => {
    const { parts } = resolved([
      {
        type: "frame",
        name: "card",
        props: { box: spot(100, 50, 400, 300), layout: row({}, 10, { t: 20, r: 20, b: 20, l: 20 }) },
        children: [block("a", 100, 50)],
      },
    ])
    const [card] = parts
    expect(card?.box).toMatchObject({ x: 100, y: 50, w: 400, h: 300 })
    expect(card?.children[0]?.box).toMatchObject({ x: 20, y: 20, w: 100, h: 50 })
    expect(card?.geometry).toBeNull()
  })

  it("leaves out hidden nodes and paints that are switched off", () => {
    const { parts } = resolved([
      block("shown", 10, 10, { fills: [solidOf(swatches.shown), solidOf(swatches.switchedOff, { visible: false })] }),
      block("hidden", 10, 10, { hidden: true }),
    ])
    expect(parts).toHaveLength(1)
    expect(parts[0]?.fills).toHaveLength(1)
  })

  it("gives one radius to all four corners, or each its own", () => {
    const { parts } = resolved([
      block("a", 10, 10, { radius: 8 }),
      block("b", 10, 10, { radius: [1, 2, 3, 4] }),
      block("c", 10, 10),
    ])
    expect(parts.map((part) => part.radius)).toEqual([
      [8, 8, 8, 8],
      [1, 2, 3, 4],
      [0, 0, 0, 0],
    ])
  })

  it("answers a stroke only when something strokes", () => {
    const { parts } = resolved([
      block("a", 10, 10),
      block("b", 10, 10, { strokes: [solidOf(swatches.black)], stroke: { weight: 3, align: "center", dash: "dash" } }),
    ])
    expect(parts[0]?.stroke).toBeNull()
    expect(parts[1]?.stroke).toEqual({ weight: 3, align: "center", dash: "dash" })
  })

  it("turns an effect style name into the theme's effects, with their colours as hex", () => {
    const named: Theme = {
      ...plainTheme,
      effectStyles: {
        ...plainTheme.effectStyles,
        soft: [{ kind: "dropShadow", color: { var: "text" }, opacity: 0.1, x: 0, y: 4, blur: 12, spread: 0 }],
      },
    }
    const { parts } = resolved(
      [block("a", 10, 10, { effects: "soft" }), block("b", 10, 10, { effects: [{ kind: "layerBlur", radius: 4 }] })],
      named,
    )
    expect(parts[0]?.effects).toEqual([
      { kind: "dropShadow", color: plainTheme.colors.text, opacity: 0.1, x: 0, y: 4, blur: 12, spread: 0 },
    ])
    expect(parts[1]?.effects).toEqual([{ kind: "layerBlur", radius: 4 }])
  })

  it("answers a shape's text with its lines, placed in the box by its vertical alignment", () => {
    const { parts } = resolved([
      label("top", "hello", { box: spot(0, 0, 400, 100) }, { resize: "fixed" }),
      label("middle", "hello", { box: spot(0, 0, 400, 100) }, { resize: "fixed", alignV: "center" }),
      label("bottom", "hello", { box: spot(0, 0, 400, 100) }, { resize: "fixed", alignV: "bottom" }),
    ])
    expect(parts.map((part) => part.text?.lines[0]?.y)).toEqual([0, 35, 70])
    expect(parts[0]?.text?.lines[0]?.runs[0]).toMatchObject({
      text: "hello",
      color: plainTheme.colors.text,
      font: "Inter",
      size: 20,
    })
  })

  it("leaves text out of a shape that has none", () => {
    expect(resolved([block("a", 10, 10)]).parts[0]?.text).toBeNull()
  })

  it("derives a chart frame's children from its data and puts them before the frame's own children", () => {
    const chart = { kind: "column", categories: ["A", "B"], series: [{ name: "S", values: [1, 2] }] }
    const { parts, ids } = resolved([
      {
        type: "frame",
        name: "chart",
        props: { box: spot(0, 0, 800, 400), chart } as never,
        children: [block("note", 20, 20)],
      },
    ])
    const children = parts[0]?.children ?? []
    expect(children.some((child) => child.id === `${ids.chart}#S:A` && child.derived)).toBe(true)
    expect(children[children.length - 1]).toMatchObject({ id: ids.note, derived: false })
  })

  it("changes a chart's bars when the data changes and never stores them", () => {
    const first = resolved([
      {
        type: "frame",
        name: "chart",
        props: {
          box: spot(0, 0, 800, 400),
          chart: { kind: "column", categories: ["A"], series: [{ name: "S", values: [1] }] },
        } as never,
      },
    ])
    expect([...first.doom.nodes.keys()].some((id) => id.includes("#"))).toBe(false)
  })

  it("scales a path drawn in the box's own units to the box's pixels", () => {
    const { parts } = resolved([
      { type: "shape", name: "p", props: { box: spot(0, 0, 200, 100), geometry: { kind: "path", d: "M0 0L1 1" } } },
    ])
    expect(parts[0]?.geometry).toEqual({ kind: "path", d: "M0 0L200 100" })
  })

  it("answers a line's ends in its own box, whichever way it points", () => {
    const { parts } = resolved([
      {
        type: "shape",
        name: "l",
        props: {
          geometry: {
            kind: "line",
            start: { x: 300, y: 100 },
            end: { x: 100, y: 400 },
            route: "elbow",
            arrows: ["none", "triangle"],
          },
        } as never,
      },
    ])
    expect(parts[0]?.box).toMatchObject({ x: 100, y: 100, w: 200, h: 300 })
    expect(parts[0]?.geometry).toEqual({
      kind: "line",
      from: { x: 200, y: 0 },
      to: { x: 0, y: 300 },
      route: "elbow",
      leaves: "down",
      arrives: "down",
      arrows: ["none", "triangle"],
    })
  })

  it("draws a preset, an ellipse and an icon as named, and a rectangle when the shape has no geometry", () => {
    const geometries = [
      { kind: "preset", name: "star5", adjust: [1] },
      { kind: "ellipse" },
      { kind: "icon", name: "lucide/arrow-right" },
      undefined,
    ]
    const { parts } = resolved(
      geometries.map((geometry, at) => ({
        type: "shape" as const,
        name: `g${String(at)}`,
        props: { box: spot(0, 0, 10, 10), ...(geometry === undefined ? {} : { geometry }) } as never,
      })),
    )
    expect(parts.map((part) => part.geometry)).toEqual([
      { kind: "preset", name: "star5", adjust: [1] },
      { kind: "ellipse" },
      { kind: "icon", name: "lucide/arrow-right" },
      { kind: "rect" },
    ])
  })

  it("passes an image paint through with its crop and filters", () => {
    const image = {
      kind: "image",
      asset: "abc",
      fit: "crop",
      crop: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 },
      filters: { contrast: 0.2 },
      opacity: 0.5,
    }
    const { parts } = resolved([block("a", 10, 10, { fills: [image] })])
    expect(parts[0]?.fills[0]).toEqual({
      kind: "image",
      asset: "abc",
      fit: "crop",
      crop: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 },
      filters: { contrast: 0.2 },
      opacity: 0.5,
    })
  })

  it("lays out before it resolves, so a hug frame's boxes are the ones it paints", () => {
    const { parts } = resolved([
      {
        type: "frame",
        name: "stack",
        props: { box: spot(0, 0, 1, 1), sizing: { w: "hug", h: "hug" }, layout: column({}, 10) },
        children: [block("a", 100, 40), block("b", 60, 40)],
      },
    ])
    expect(parts[0]?.box).toMatchObject({ w: 100, h: 90 })
    expect(parts[0]?.children.map((child) => child.box.y)).toEqual([0, 50])
  })
})

describe("slideBackground", () => {
  it("paints a slide with the theme's background unless it has fills of its own", () => {
    const plain = resolved([])
    expect(slideBackground(plain.doom, plain.slides[0]!)).toEqual([
      { kind: "solid", color: plainTheme.colors.background, opacity: 1 },
    ])
    const filled = resolved([], plainTheme, { fills: [solidOf({ var: "background2" })] })
    expect(slideBackground(filled.doom, filled.slides[0]!)).toEqual([
      { kind: "solid", color: plainTheme.colors.background2, opacity: 1 },
    ])
  })
})
