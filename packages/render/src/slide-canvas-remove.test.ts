import { elementId, type ElementId } from "@airdesign/document"
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
const added = elementId("256.9")

function element(named: ElementId, overrides: Partial<CanvasElement> = {}): CanvasElement {
  return {
    key: `ppt/slides/slide1.xml#${named}`,
    id: named,
    kind: "shape",
    box: { x: 457_200, y: 457_200, width: 5_486_400, height: 1_828_800, rotation: 0, flipH: false, flipV: false },
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

async function mounted(elements: readonly CanvasElement[], entering: ElementId | null = null) {
  const store = paintStore()
  for (const each of elements) {
    if (each.id !== null) store.publish({ id: each.id, kind: each.kind, text: "Hello", picture: null })
  }
  const removed: (readonly ElementId[])[] = []
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
        entering: entering === null ? null : { id: entering },
        onEdit: () => undefined,
        onBox: () => undefined,
        onRemove: (targets: readonly ElementId[]) => removed.push(targets),
      }),
    )
  })
  return { host, removed }
}

function frameOf(host: HTMLElement, named: ElementId = id): HTMLElement {
  const found = host.querySelector<HTMLElement>(`[data-canvas-element="ppt/slides/slide1.xml#${named}"]`)
  if (found === null) throw new Error(`no element ${named}`)
  return found
}

function textOf(host: HTMLElement, named: ElementId = id): HTMLElement {
  const found = frameOf(host, named).querySelector<HTMLElement>('[contenteditable="true"]')
  if (found === null) throw new Error("no text")
  return found
}

async function press(target: HTMLElement, key: string, metaKey = false): Promise<void> {
  await act(async () => {
    target.focus()
    target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key, metaKey }))
  })
}

async function click(target: HTMLElement, shiftKey = false): Promise<void> {
  const init = { bubbles: true, cancelable: true, clientX: 200, clientY: 200, pointerId: 1, button: 0, shiftKey }
  await act(async () => {
    target.dispatchEvent(new PointerEvent("pointerdown", init))
    target.ownerDocument.dispatchEvent(new PointerEvent("pointerup", init))
  })
}

describe("SlideCanvas remove", () => {
  it("removes the selected element on Delete or Backspace", async () => {
    const { host, removed } = await mounted([element(id)])
    await press(frameOf(host), "Delete")
    await press(frameOf(host), "Backspace")
    expect(removed).toEqual([[id], [id]])
  })

  it("removes every chosen element with one Delete", async () => {
    const { host, removed } = await mounted([element(id), element(added)])
    await click(frameOf(host))
    await click(frameOf(host, added), true)
    await press(frameOf(host, added), "Delete")
    expect(removed).toEqual([[id, added]])
  })

  it("leaves out a chosen element that cannot keep its own box", async () => {
    const { host, removed } = await mounted([element(id, { movable: false }), element(added)])
    await click(frameOf(host))
    await click(frameOf(host, added), true)
    await press(frameOf(host, added), "Backspace")
    expect(removed).toEqual([[added]])
  })

  it("leaves Delete and Backspace to the text while a person types, and to the browser with a modifier", async () => {
    const { host, removed } = await mounted([element(id)])
    await press(textOf(host), "Backspace")
    await press(frameOf(host), "Backspace", true)
    expect(removed).toEqual([])
  })

  it("removes nothing that cannot keep its own box", async () => {
    const { host, removed } = await mounted([element(id, { movable: false })])
    await press(frameOf(host), "Delete")
    expect(removed).toEqual([])
  })

  it("selects a new element and puts the caret in its text", async () => {
    const { host } = await mounted([element(id), element(added)], added)
    expect(host.ownerDocument.activeElement).toBe(textOf(host, added))
    expect(host.querySelector<HTMLElement>("[data-selection]")?.dataset.selection).toBe(added)
  })
})
