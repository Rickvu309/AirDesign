import { elementId, type Bound, type ElementId, type Guide, type LayoutGuide, type Place } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { paintStore, SlideCanvas, type CanvasElement, type CanvasSlide, type PaintBox } from "./index.js"

const hosts: { host: HTMLDivElement; root: Root }[] = []

export async function unmountAll(): Promise<void> {
  for (const mounted of hosts.splice(0)) {
    await act(async () => {
      mounted.root.unmount()
    })
    mounted.host.remove()
  }
}

const wide = { width: 12_192_000, height: 6_858_000, background: null }
const width = 1219.2
export const upright = { rotation: 0, flipH: false, flipV: false }
export const line = elementId("256.2")
export const card = elementId("256.3")
const lineBox: PaintBox = { x: 1_000_000, y: 1_000_000, width: 2_000_000, height: 0, ...upright }
export const cardBox: PaintBox = { x: 4_000_000, y: 500_000, width: 2_000_000, height: 1_000_000, ...upright }

export function element(
  id: ElementId,
  kind: "shape" | "connector" | "picture",
  box: PaintBox,
  preset: string,
): CanvasElement {
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

export const elements = [
  element(line, "connector", lineBox, "straightConnector1"),
  element(card, "shape", cardBox, "rect"),
]

export async function mounted(
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

export async function pointer(target: EventTarget, type: string, x: number, y: number, held: Held = {}): Promise<void> {
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

export async function keyEvent(
  target: EventTarget,
  type: "keydown" | "keyup",
  key: string,
  held: Held = {},
): Promise<void> {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, key, ...held }))
  })
}

export function guideLines(host: HTMLElement): readonly string[] {
  return [...host.querySelectorAll("[data-guides] [data-guide]")].map((each) => each.getAttribute("data-guide") ?? "")
}

export const pixels = (emu: number) => (emu * width) / wide.width

export async function chosen(host: HTMLElement): Promise<HTMLElement> {
  const frame = host.querySelector<HTMLElement>(`[data-canvas-element="ppt/slides/slide1.xml#${line}"]`)
  if (frame === null) throw new Error("no connector")
  await pointer(frame, "pointerdown", pixels(2_000_000), pixels(1_000_000))
  await pointer(frame.ownerDocument, "pointerup", pixels(2_000_000), pixels(1_000_000))
  const end = host.querySelector<HTMLElement>('[data-connector-end="end"]')
  if (end === null) throw new Error("no end grip")
  return end
}
