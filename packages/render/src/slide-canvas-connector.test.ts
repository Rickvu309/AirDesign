import { elementId, type Bound, type ElementId, type Guide, type LayoutGuide, type Place } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { aimAt } from "./connector-drag.js"
import { paintStore, SlideCanvas, type CanvasElement, type CanvasSlide, type PaintBox } from "./index.js"

const hosts: { host: HTMLDivElement; root: Root }[] = []

afterEach(async () => {
  for (const mounted of hosts.splice(0)) {
    await act(async () => {
      mounted.root.unmount()
    })
    mounted.host.remove()
  }
})

const wide = { width: 12_192_000, height: 6_858_000, background: null }
const width = 1219.2
const upright = { rotation: 0, flipH: false, flipV: false }
const line = elementId("256.2")
const card = elementId("256.3")
const lineBox: PaintBox = { x: 1_000_000, y: 1_000_000, width: 2_000_000, height: 0, ...upright }
const cardBox: PaintBox = { x: 4_000_000, y: 500_000, width: 2_000_000, height: 1_000_000, ...upright }

function element(id: ElementId, kind: "shape" | "connector" | "picture", box: PaintBox, preset: string): CanvasElement {
  return {
    key: `ppt/slides/slide1.xml#${id}`,
    id,
    kind,
    box,
    editable: false,
    movable: true,
    placeholder: false,
    filled: kind === "shape",
    fill: null,
    line: null,
    outline: kind === "connector" ? "line" : "box",
    geometry: { preset, adjusts: {} },
    text: null,
  }
}

const elements = [element(line, "connector", lineBox, "straightConnector1"), element(card, "shape", cardBox, "rect")]

async function mounted(
  shown: readonly CanvasElement[] = elements,
  extra: { readonly guides?: readonly Guide[]; readonly layoutGuides?: readonly LayoutGuide[] } = {},
): Promise<{ host: HTMLDivElement; bound: [ElementId, string, Bound | Place][]; moved: [ElementId, unknown][] }> {
  const store = paintStore()
  for (const each of shown)
    if (each.id !== null) store.publish({ id: each.id, kind: each.kind === "picture" ? "shape" : each.kind, text: "" })
  const bound: [ElementId, string, Bound | Place][] = []
  const moved: [ElementId, unknown][] = []
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  const slide: CanvasSlide = { ...wide, ...extra, elements: shown }
  await act(async () => {
    root.render(
      createElement(SlideCanvas, {
        store,
        slide,
        width,
        onBoxes: (each: readonly { id: ElementId; box: unknown }[]) =>
          moved.push(...each.map(({ id, box }) => [id, box] as [ElementId, unknown])),
        onConnect: (id: ElementId, end: string, to: Bound | Place) => bound.push([id, end, to]),
      }),
    )
  })
  return { host, bound, moved }
}

type Held = { readonly shiftKey?: boolean; readonly ctrlKey?: boolean }

async function pointer(target: EventTarget, type: string, x: number, y: number, held: Held = {}): Promise<void> {
  await act(async () => {
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        pointerId: 1,
        button: 0,
        ...held,
      }),
    )
    if (type === "pointermove") await new Promise((painted) => requestAnimationFrame(painted))
  })
}

async function keyEvent(target: EventTarget, type: "keydown" | "keyup", key: string, held: Held = {}): Promise<void> {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, key, ...held }))
  })
}

function guideLines(host: HTMLElement): readonly string[] {
  return [...host.querySelectorAll("[data-guides] [data-guide]")].map((each) => each.getAttribute("data-guide") ?? "")
}

const pixels = (emu: number) => (emu * width) / wide.width

async function chosen(host: HTMLElement): Promise<HTMLElement> {
  const frame = host.querySelector<HTMLElement>(`[data-canvas-element="ppt/slides/slide1.xml#${line}"]`)
  if (frame === null) throw new Error("no connector")
  await pointer(frame, "pointerdown", pixels(2_000_000), pixels(1_000_000))
  await pointer(frame.ownerDocument, "pointerup", pixels(2_000_000), pixels(1_000_000))
  const end = host.querySelector<HTMLElement>('[data-connector-end="end"]')
  if (end === null) throw new Error("no end grip")
  return end
}

describe("a person drags a connector's end onto a shape", () => {
  it("shows the selected connector's two ends as grips instead of corners", async () => {
    const { host } = await mounted()
    await chosen(host)
    expect(host.querySelectorAll("[data-connector-end]")).toHaveLength(2)
    expect(host.querySelector('[data-grip="top-left"]')).toBeNull()
    const end = host.querySelector<HTMLElement>('[data-connector-end="end"]')
    expect([end?.style.left, end?.style.top]).toEqual([
      `${String(pixels(3_000_000))}px`,
      `${String(pixels(1_000_000))}px`,
    ])
  })

  it("shows the sites of the shape under the pointer, marks the nearest, and binds the end to it on release", async () => {
    const { host, bound } = await mounted()
    const end = await chosen(host)
    await pointer(end, "pointerdown", pixels(3_000_000), pixels(1_000_000))
    await pointer(end.ownerDocument, "pointermove", pixels(4_050_000), pixels(1_020_000))
    const sites = [...host.querySelectorAll<HTMLElement>("[data-connector-site]")]
    expect(sites.map((site) => site.dataset.connectorTarget)).toEqual([card, card, card, card])
    expect(host.querySelector("[data-connector-chosen]")?.getAttribute("data-connector-site")).toBe("1")
    expect(host.querySelector("[data-connector-aim]")).not.toBeNull()
    expect(
      [...host.querySelectorAll<HTMLElement>("[data-connector-end]")].map((each) => each.dataset.connectorEnd),
    ).toEqual(["start"])
    await pointer(end.ownerDocument, "pointerup", pixels(4_050_000), pixels(1_020_000))
    expect(bound).toEqual([[line, "end", { node: card, site: 1 }]])
    expect(host.querySelector("[data-connector-site]")).toBeNull()
  })

  it("lands the end on the point it is let go at, away from every site", async () => {
    const { host, bound } = await mounted()
    const end = await chosen(host)
    await pointer(end, "pointerdown", pixels(3_000_000), pixels(1_000_000))
    await pointer(end.ownerDocument, "pointermove", pixels(5_000_000), pixels(1_000_000))
    expect(host.querySelectorAll("[data-connector-site]")).toHaveLength(4)
    expect(host.querySelector("[data-connector-chosen]")).toBeNull()
    await pointer(end.ownerDocument, "pointermove", pixels(9_000_000), pixels(500_000))
    expect(host.querySelector("[data-connector-site]")).toBeNull()
    await pointer(end.ownerDocument, "pointerup", pixels(9_000_000), pixels(500_000))
    const [[id, which, place] = []] = bound
    expect([id, which]).toEqual([line, "end"])
    expect(place).toEqual({
      box: { x: 1_000_000, y: 500_000, cx: 8_000_000, cy: 500_000 },
      rot: 0,
      flipH: false,
      flipV: true,
    })
  })

  it("lands nothing when the end is let go where it was picked up", async () => {
    const { host, bound } = await mounted()
    const end = await chosen(host)
    await pointer(end, "pointerdown", pixels(3_000_000), pixels(1_000_000))
    await pointer(end.ownerDocument, "pointerup", pixels(3_000_000), pixels(1_000_000))
    expect(bound).toEqual([])
  })
})

const left = elementId("256.4")
const leftBox: PaintBox = { x: 0, y: 1_000_000, width: 1_000_000, height: 1_000_000, ...upright }
const tied: CanvasElement = {
  ...element(line, "connector", { x: 1_000_000, y: 1_000_000, width: 3_000_000, height: 500_000, ...upright }, "line"),
  box: { x: 1_000_000, y: 1_000_000, width: 3_000_000, height: 500_000, ...upright },
  connection: { start: { node: left, site: 3 }, end: { node: card, site: 1 } },
}
const boundSlide = [element(left, "shape", leftBox, "rect"), element(card, "shape", cardBox, "rect"), tied]

function placement(host: HTMLElement, id: ElementId): readonly string[] {
  const frame = host.querySelector<HTMLElement>(`[data-canvas-element="ppt/slides/slide1.xml#${id}"]`)
  if (frame === null) throw new Error("no element")
  return [frame.style.left, frame.style.top, frame.style.width, frame.style.height, frame.style.transform]
}

const px = (emu: number) => `${String(pixels(emu))}px`

describe("a connector bound to two shapes", () => {
  it("follows a shape while a person drags it, before the drop", async () => {
    const { host, moved } = await mounted(boundSlide)
    expect(placement(host, line)).toEqual([px(1_000_000), px(1_000_000), px(3_000_000), px(500_000), ""])
    const frame = host.querySelector<HTMLElement>(`[data-canvas-element="ppt/slides/slide1.xml#${card}"]`)
    if (frame === null) throw new Error("no card")
    await pointer(frame, "pointerdown", pixels(5_000_000), pixels(1_000_000))
    await pointer(frame.ownerDocument, "pointermove", pixels(6_000_000), pixels(2_000_000))
    expect(placement(host, line)).toEqual([px(1_000_000), px(1_500_000), px(4_000_000), px(500_000), ""])
    expect(moved).toEqual([])
    await pointer(frame.ownerDocument, "pointerup", pixels(6_000_000), pixels(2_000_000))
    expect(moved).toHaveLength(1)
  })

  it("bends an elbow connector a quarter turn when the shape it ends on moves below it", async () => {
    const elbow = {
      ...tied,
      geometry: { preset: "bentConnector3", adjusts: {} },
      connection: { start: { node: left, site: 2 }, end: { node: card, site: 0 } },
    }
    const { host } = await mounted([boundSlide[0]!, boundSlide[1]!, elbow])
    const frame = host.querySelector<HTMLElement>(`[data-canvas-element="ppt/slides/slide1.xml#${card}"]`)
    if (frame === null) throw new Error("no card")
    await pointer(frame, "pointerdown", pixels(5_000_000), pixels(1_000_000))
    await pointer(frame.ownerDocument, "pointermove", pixels(5_000_000), pixels(4_000_000))
    const [, , , , transform] = placement(host, line)
    expect(transform).toBe("rotate(270deg) scale(-1, 1)")
  })

  it("keeps its body still when a person drags it, since its ends hold it", async () => {
    const { host, moved } = await mounted(boundSlide)
    const frame = host.querySelector<HTMLElement>(`[data-canvas-element="ppt/slides/slide1.xml#${line}"]`)
    if (frame === null) throw new Error("no connector")
    await pointer(frame, "pointerdown", pixels(2_000_000), pixels(1_200_000))
    await pointer(frame.ownerDocument, "pointermove", pixels(3_000_000), pixels(2_200_000))
    await pointer(frame.ownerDocument, "pointerup", pixels(3_000_000), pixels(2_200_000))
    expect(moved).toEqual([])
    expect(placement(host, line)).toEqual([px(1_000_000), px(1_000_000), px(3_000_000), px(500_000), ""])
    expect(host.querySelectorAll("[data-connector-end]")).toHaveLength(2)
    expect(frame.getAttribute("aria-description")).toBe("Delete removes it.")
    for (const init of [{ key: "ArrowRight" }, { key: "ArrowDown", altKey: true, shiftKey: true }]) {
      await act(async () => {
        frame.dispatchEvent(new KeyboardEvent("keydown", { ...init, bubbles: true, cancelable: true }))
        frame.dispatchEvent(new KeyboardEvent("keyup", { ...init, bubbles: true, cancelable: true }))
      })
    }
    expect(placement(host, line)).toEqual([px(1_000_000), px(1_000_000), px(3_000_000), px(500_000), ""])
    expect(moved).toEqual([])
  })
})

describe("aimAt", () => {
  const placed = (each: CanvasElement) => each.box

  it("takes the topmost shape under the point, turned, and skips the connector and shapes in another group", () => {
    const [connector, rectangle] = elements
    if (connector === undefined || rectangle === undefined) throw new Error("elements")
    const turned = { ...rectangle, box: { ...cardBox, rotation: 90 } }
    expect(aimAt([turned], connector, { x: 5_000_000, y: 1_900_000 }, 0, placed)?.site).toBeNull()
    expect(aimAt([turned], connector, { x: 5_000_000, y: 1_995_000 }, 10_000, placed)?.site).toBe(3)
    const grouped = { ...rectangle, group: { id: elementId("256.9"), box: null } }
    expect(aimAt([grouped], connector, { x: 4_000_000, y: 1_000_000 }, 10, placed)).toBeNull()
    expect(aimAt([connector], connector, { x: 2_000_000, y: 1_000_000 }, 10, placed)).toBeNull()
  })

  it("snaps to a site of a photo, a shape whose fills hold an image that the canvas paints as a picture", () => {
    const [connector] = elements
    if (connector === undefined) throw new Error("elements")
    const photo = element(elementId("256.5"), "picture", cardBox, "rect")
    expect(aimAt([photo], connector, { x: 4_005_000, y: 1_000_000 }, 10_000, placed)).toMatchObject({
      node: elementId("256.5"),
      site: 1,
    })
  })

  it("snaps to a site of a shape that a larger one above it covers, and shows the topmost when no site is near", () => {
    const [connector, rectangle] = elements
    if (connector === undefined || rectangle === undefined) throw new Error("elements")
    const oval = element(
      elementId("256.4"),
      "shape",
      { ...cardBox, x: 3_000_000, y: 0, width: 5_000_000, height: 3_000_000 },
      "ellipse",
    )
    expect(aimAt([rectangle, oval], connector, { x: 4_005_000, y: 1_000_000 }, 10_000, placed)).toMatchObject({
      node: card,
      site: 1,
    })
    expect(aimAt([rectangle, oval], connector, { x: 4_500_000, y: 1_000_000 }, 10_000, placed)).toMatchObject({
      node: elementId("256.4"),
      site: null,
    })
  })
})

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
