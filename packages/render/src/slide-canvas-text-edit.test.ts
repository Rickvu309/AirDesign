import { elementId, type Box, type ElementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { paintStore, SlideCanvas, type CanvasElement } from "./index.js"

const hosts: { host: HTMLDivElement; root: Root }[] = []

afterEach(async () => {
  for (const mounted of hosts.splice(0)) {
    await act(async () => {
      mounted.root.unmount()
    })
    mounted.host.remove()
  }
})

const id = elementId("256.2")
const other = elementId("256.3")
const place = { x: 457_200, y: 457_200, width: 5_486_400, height: 1_828_800, rotation: 0, flipH: false, flipV: false }

function element(named: ElementId, overrides: Partial<CanvasElement> = {}): CanvasElement {
  return {
    key: `ppt/slides/slide1.xml#${named}`,
    id: named,
    kind: "shape",
    box: place,
    editable: true,
    movable: true,
    placeholder: false,
    filled: true,
    fill: null,
    line: null,
    outline: "box",
    text: null,
    ...overrides,
  }
}

const boxes: [ElementId, Box][] = []

async function mounted(elements: readonly CanvasElement[]): Promise<HTMLDivElement> {
  boxes.length = 0
  const store = paintStore()
  for (const each of elements) if (each.id !== null) store.publish({ id: each.id, kind: "shape", text: "Hello" })
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  await act(async () => {
    root.render(
      createElement(SlideCanvas, {
        store,
        slide: { width: 12_192_000, height: 6_858_000, background: null, elements },
        width: 800,
        onEdit: () => undefined,
        onBoxes: (moved: readonly { id: ElementId; box: Box }[]) => {
          boxes.push(...moved.map(({ id, box }): [ElementId, Box] => [id, box]))
        },
      }),
    )
  })
  return host
}

async function pointer(target: EventTarget, type: string, x: number, y: number): Promise<PointerEvent> {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    pointerId: 1,
    button: 0,
  })
  await act(async () => {
    target.dispatchEvent(event)
  })
  return event
}

function textOf(host: HTMLElement, named: ElementId): HTMLElement {
  const found = host.querySelector<HTMLElement>(
    `[data-canvas-element="ppt/slides/slide1.xml#${named}"] [contenteditable="true"]`,
  )
  if (found === null) throw new Error(`no text in ${named}`)
  return found
}

async function click(target: HTMLElement, detail: number): Promise<void> {
  await act(async () => {
    const at = { bubbles: true, cancelable: true, clientX: 100, clientY: 80, button: 0 }
    target.dispatchEvent(new PointerEvent("pointerdown", { ...at, pointerId: 1 }))
    target.ownerDocument.dispatchEvent(new PointerEvent("pointerup", { ...at, pointerId: 1 }))
    target.dispatchEvent(new MouseEvent("click", { ...at, detail }))
    if (detail === 2) target.dispatchEvent(new MouseEvent("dblclick", { ...at, detail }))
  })
}

describe("editing a text layer on the slide", () => {
  it("selects a text layer on a click and goes into its text on a double-click", async () => {
    const host = await mounted([element(id)])
    const text = textOf(host, id)
    await click(text, 1)
    expect(host.querySelector<HTMLElement>("[data-selection]")?.dataset.selection).toBe(id)
    expect(host.ownerDocument.activeElement).not.toBe(text)
    await click(text, 2)
    expect(host.ownerDocument.activeElement).toBe(text)
  })

  it("does not go into the text of a layer that is not the only one selected", async () => {
    const host = await mounted([element(id), element(other, { box: { ...place, y: 3_000_000 } })])
    const text = textOf(host, id)
    await act(async () => {
      text.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true, clientX: 100, clientY: 80 }))
    })
    expect(host.ownerDocument.activeElement).not.toBe(text)
  })

  it("goes straight into another text layer's text on one click while a text is being edited", async () => {
    const host = await mounted([element(id), element(other, { box: { ...place, y: 3_000_000 } })])
    await act(async () => {
      textOf(host, id).focus()
    })
    const press = new PointerEvent("pointerdown", { bubbles: true, cancelable: true, clientX: 100, clientY: 220 })
    await act(async () => {
      textOf(host, other).dispatchEvent(press)
    })
    expect(press.defaultPrevented).toBe(false)
  })

  it("leaves a press in the text being typed in to the caret and starts no move", async () => {
    const host = await mounted([element(id)])
    const text = textOf(host, id)
    await act(async () => {
      text.focus()
    })
    const press = await pointer(text, "pointerdown", 40, 40)
    expect(press.defaultPrevented).toBe(false)
    await pointer(host.ownerDocument, "pointermove", 140, 140)
    await pointer(host.ownerDocument, "pointerup", 140, 140)
    expect(boxes).toEqual([])
  })

  it("keeps a right press in a layer's text out of the text when nobody is typing in it", async () => {
    const host = await mounted([element(id)])
    const text = textOf(host, id)
    const at = { bubbles: true, cancelable: true, clientX: 100, clientY: 80, pointerId: 1, button: 2 }
    const resting = new PointerEvent("pointerdown", at)
    await act(async () => {
      text.dispatchEvent(resting)
    })
    expect(resting.defaultPrevented).toBe(true)
    expect(host.ownerDocument.activeElement).toBe(text.closest("[data-canvas-element]"))
    await act(async () => {
      text.focus()
    })
    const typing = new PointerEvent("pointerdown", at)
    await act(async () => {
      text.dispatchEvent(typing)
    })
    expect(typing.defaultPrevented).toBe(false)
  })

  it("selects and moves a text layer from a press in its text when nobody is typing in it", async () => {
    const host = await mounted([element(id)])
    const text = textOf(host, id)
    await pointer(text, "pointerdown", 100, 80)
    await pointer(host.ownerDocument, "pointermove", 115, 95)
    await pointer(host.ownerDocument, "pointermove", 130, 110)
    await pointer(host.ownerDocument, "pointerup", 130, 110)
    expect(host.ownerDocument.activeElement).toBe(text.closest("[data-canvas-element]"))
    expect(host.querySelector<HTMLElement>("[data-selection]")?.dataset.selection).toBe(id)
    expect(boxes).toEqual([[id, { x: 914_400, y: 914_400, cx: 5_486_400, cy: 1_828_800 }]])
  })
})
