import { afterEach, describe, expect, it } from "vitest"
import {
  line,
  card,
  element,
  mounted,
  upright,
  pointer,
  keyEvent,
  guideLines,
  pixels,
  chosen,
  unmountAll,
} from "./connector-canvas-fixture.js"
import type { PaintBox } from "./index.js"

afterEach(unmountAll)

describe("snapping and Shift angle lock on line and arrow ends", () => {
  const marginCardBox: PaintBox = { x: 500_000, y: 2_500_000, width: 7_500_000, height: 800_000, ...upright }
  const ruleBox: PaintBox = { x: 500_000, y: 4_500_000, width: 2_000_000, height: 0, ...upright }
  const ruleElements = [element(line, "connector", ruleBox, "line"), element(card, "shape", marginCardBox, "rect")]

  it("snaps a dragged end to another layer edge and to the opposite end's height, shows red guides, and clears them on release", async () => {
    const { host, bound } = await mounted(ruleElements)
    const end = await chosen(host)
    await pointer(end, "pointerdown", pixels(2_500_000), pixels(4_500_000))
    await pointer(end.ownerDocument, "pointermove", pixels(8_030_000), pixels(4_525_000))
    expect(guideLines(host)).toEqual(["snap x 800", "snap y 450"])
    const preview = host.querySelector<SVGLineElement>("[data-connector-aim] line")
    expect([preview?.getAttribute("x2"), preview?.getAttribute("y2")]).toEqual(["800", "450"])
    await pointer(end.ownerDocument, "pointerup", pixels(8_030_000), pixels(4_525_000))
    expect(host.querySelector("[data-guides]")).toBeNull()
    expect(bound).toEqual([
      [line, "end", { box: { x: 500_000, y: 4_500_000, cx: 7_500_000, cy: 0 }, rot: 0, flipH: false, flipV: false }],
    ])
  })

  it("snaps a dragged end to ruler guides, layout columns and grid lines", async () => {
    const tone = { color: "FF0000", opacity: 10, shown: true }
    const { host, bound } = await mounted(ruleElements, {
      guides: [{ axis: "y", offset: 4_800_000 }],
      layoutGuides: [
        { pattern: "columns", count: 12, align: "stretch", size: 0, offset: 508_000, gutter: 127_000, ...tone },
        { pattern: "grid", size: 1_000_000, count: 0, align: "stretch", offset: 0, gutter: 0, ...tone },
      ],
    })
    const end = await chosen(host)
    await pointer(end, "pointerdown", pixels(2_500_000), pixels(4_500_000))
    await pointer(end.ownerDocument, "pointermove", pixels(11_654_000), pixels(4_825_000))
    await pointer(end.ownerDocument, "pointerup", pixels(11_654_000), pixels(4_825_000))
    expect(bound).toEqual([
      [
        line,
        "end",
        { box: { x: 500_000, y: 4_500_000, cx: 11_184_000, cy: 300_000 }, rot: 0, flipH: false, flipV: false },
      ],
    ])
  })

  it("disables snapping and guides while Control is held and updates live when Control toggles mid-drag", async () => {
    const { host, bound } = await mounted(ruleElements)
    const end = await chosen(host)
    await pointer(end, "pointerdown", pixels(2_500_000), pixels(4_500_000))
    await pointer(end.ownerDocument, "pointermove", pixels(8_030_000), pixels(4_525_000))
    expect(guideLines(host)).toEqual(["snap x 800", "snap y 450"])
    await keyEvent(end.ownerDocument, "keydown", "Control", { ctrlKey: true })
    expect(host.querySelector("[data-guides]")).toBeNull()
    const preview = host.querySelector<SVGLineElement>("[data-connector-aim] line")
    expect([preview?.getAttribute("x2"), preview?.getAttribute("y2")]).toEqual(["803", "452.5"])
    await pointer(end.ownerDocument, "pointerup", pixels(8_030_000), pixels(4_525_000), { ctrlKey: true })
    expect(bound).toEqual([
      [
        line,
        "end",
        { box: { x: 500_000, y: 4_500_000, cx: 7_530_000, cy: 25_000 }, rot: 0, flipH: false, flipV: false },
      ],
    ])
  })

  it("holds 45-degree steps with Shift, snaps along the ray, ignores shape sites, and updates live mid-drag", async () => {
    const { host, bound } = await mounted(ruleElements)
    const end = await chosen(host)
    await pointer(end, "pointerdown", pixels(2_500_000), pixels(4_500_000))
    await pointer(end.ownerDocument, "pointermove", pixels(8_030_000), pixels(4_800_000))
    expect(guideLines(host)).toEqual(["snap x 800"])
    await keyEvent(end.ownerDocument, "keydown", "Shift", { shiftKey: true })
    const horizontal = host.querySelector<SVGLineElement>("[data-connector-aim] line")
    expect([horizontal?.getAttribute("x2"), horizontal?.getAttribute("y2")]).toEqual(["800", "450"])
    await pointer(end.ownerDocument, "pointermove", pixels(2_400_000), pixels(2_700_000), { shiftKey: true })
    const diagonal = host.querySelector<SVGLineElement>("[data-connector-aim] line")
    expect([diagonal?.getAttribute("x2"), diagonal?.getAttribute("y2")]).toEqual(["235", "265"])
    await pointer(end.ownerDocument, "pointerup", pixels(8_030_000), pixels(4_800_000), { shiftKey: true })
    expect(bound).toEqual([
      [line, "end", { box: { x: 500_000, y: 4_500_000, cx: 7_500_000, cy: 0 }, rot: 0, flipH: false, flipV: false }],
    ])
  })

  it("snaps a whole free line with the existing move snapping when dragged by its body", async () => {
    const { host, moved } = await mounted(ruleElements)
    const frame = host.querySelector<HTMLElement>(`[data-canvas-element="ppt/slides/slide1.xml#${line}"]`)
    if (frame === null) throw new Error("no line")
    await pointer(frame, "pointerdown", pixels(1_500_000), pixels(4_500_000))
    await pointer(frame.ownerDocument, "pointermove", pixels(7_030_000), pixels(3_320_000))
    expect(guideLines(host)).toEqual(["snap x 800", "snap y 330"])
    await pointer(frame.ownerDocument, "pointerup", pixels(7_030_000), pixels(3_320_000))
    expect(moved).toEqual([[line, { x: 6_000_000, y: 3_300_000, cx: 2_000_000, cy: 0 }]])
  })

  it("ignores shape connection sites while Shift or Control is held on an arrow end", async () => {
    const { host, bound } = await mounted()
    const end = await chosen(host)
    await pointer(end, "pointerdown", pixels(3_000_000), pixels(1_000_000))
    await pointer(end.ownerDocument, "pointermove", pixels(4_030_000), pixels(1_060_000), { shiftKey: true })
    expect(host.querySelector("[data-connector-site]")).toBeNull()
    expect(guideLines(host)).toEqual(["snap x 400"])
    await pointer(end.ownerDocument, "pointerup", pixels(4_030_000), pixels(1_060_000), { shiftKey: true })
    expect(bound).toEqual([
      [line, "end", { box: { x: 1_000_000, y: 1_000_000, cx: 3_000_000, cy: 0 }, rot: 0, flipH: false, flipV: false }],
    ])

    const nextEnd = host.querySelector<HTMLElement>('[data-connector-end="end"]')
    if (nextEnd === null) throw new Error("no end grip")
    await pointer(nextEnd, "pointerdown", pixels(3_000_000), pixels(1_000_000))
    await pointer(nextEnd.ownerDocument, "pointermove", pixels(4_030_000), pixels(1_020_000), { ctrlKey: true })
    expect(host.querySelector("[data-connector-site]")).toBeNull()
    expect(host.querySelector("[data-guides]")).toBeNull()
    await pointer(nextEnd.ownerDocument, "pointerup", pixels(4_030_000), pixels(1_020_000), { ctrlKey: true })
    expect(bound[1]).toEqual([
      line,
      "end",
      { box: { x: 1_000_000, y: 1_000_000, cx: 3_030_000, cy: 20_000 }, rot: 0, flipH: false, flipV: false },
    ])
  })

  it("snaps the start end to the opposite end and left edge when dragging start", async () => {
    const startRule: PaintBox = { x: 2_500_000, y: 4_500_000, width: 5_500_000, height: 0, ...upright }
    const { host, bound } = await mounted([
      element(line, "connector", startRule, "line"),
      element(card, "shape", marginCardBox, "rect"),
    ])
    await chosen(host)
    const start = host.querySelector<HTMLElement>('[data-connector-end="start"]')
    if (start === null) throw new Error("no start grip")
    await pointer(start, "pointerdown", pixels(2_500_000), pixels(4_500_000))
    await pointer(start.ownerDocument, "pointermove", pixels(530_000), pixels(4_525_000))
    expect(guideLines(host)).toEqual(["snap x 50", "snap y 450"])
    await pointer(start.ownerDocument, "pointerup", pixels(530_000), pixels(4_525_000))
    expect(bound).toEqual([
      [line, "start", { box: { x: 500_000, y: 4_500_000, cx: 7_500_000, cy: 0 }, rot: 0, flipH: false, flipV: false }],
    ])
  })
})
