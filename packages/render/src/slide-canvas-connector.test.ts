import { elementId, type Bound, type ElementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { aimAt } from "./connector-drag.js"
import { paintStore, SlideCanvas, type CanvasElement, type CanvasSlide, type PaintBox } from "./index.js"

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)

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

function element(id: ElementId, kind: "shape" | "connector", box: PaintBox, preset: string): CanvasElement {
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

async function mounted(): Promise<{ host: HTMLDivElement; bound: [ElementId, string, Bound][] }> {
  const store = paintStore()
  for (const each of elements)
    if (each.id !== null) store.publish({ id: each.id, kind: each.kind, text: "", picture: null })
  const bound: [ElementId, string, Bound][] = []
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  const slide: CanvasSlide = { ...wide, elements }
  await act(async () => {
    root.render(
      createElement(SlideCanvas, {
        store,
        slide,
        width,
        onBox: () => undefined,
        onConnect: (id: ElementId, end: string, to: Bound) => bound.push([id, end, to]),
      }),
    )
  })
  return { host, bound }
}

async function pointer(target: EventTarget, type: string, x: number, y: number): Promise<void> {
  await act(async () => {
    target.dispatchEvent(
      new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, button: 0 }),
    )
  })
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

  it("binds nothing when the end is let go away from every site", async () => {
    const { host, bound } = await mounted()
    const end = await chosen(host)
    await pointer(end, "pointerdown", pixels(3_000_000), pixels(1_000_000))
    await pointer(end.ownerDocument, "pointermove", pixels(5_000_000), pixels(1_000_000))
    expect(host.querySelectorAll("[data-connector-site]")).toHaveLength(4)
    expect(host.querySelector("[data-connector-chosen]")).toBeNull()
    await pointer(end.ownerDocument, "pointerup", pixels(5_000_000), pixels(1_000_000))
    await pointer(end, "pointerdown", pixels(3_000_000), pixels(1_000_000))
    await pointer(end.ownerDocument, "pointerup", pixels(9_000_000), pixels(5_000_000))
    expect(bound).toEqual([])
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
