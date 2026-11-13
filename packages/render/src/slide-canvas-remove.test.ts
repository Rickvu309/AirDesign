import { elementId, type ElementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { paintStore, SlideCanvas, type CanvasElement } from "./index.js"

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
  const removed: ElementId[] = []
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
        onRemove: (target: ElementId) => removed.push(target),
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

describe("SlideCanvas remove", () => {
  it("removes the selected element on Delete or Backspace", async () => {
    const { host, removed } = await mounted([element(id)])
    await press(frameOf(host), "Delete")
    await press(frameOf(host), "Backspace")
    expect(removed).toEqual([id, id])
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
