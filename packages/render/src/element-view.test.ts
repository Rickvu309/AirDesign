import { elementId, slideId, type ElementId, type SlideId } from "@airdesign/document"
import { act, createElement, useState, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { ElementView, OpenSlide, paintStore, useElement, type PaintStore } from "./index.js"

const hosts: { host: HTMLDivElement; root: Root }[] = []

afterEach(async () => {
  for (const mounted of hosts.splice(0)) {
    await act(async () => {
      mounted.root.unmount()
    })
    mounted.host.remove()
  }
})

async function render(node: ReactNode): Promise<HTMLDivElement> {
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  await act(async () => {
    root.render(node)
  })
  return host
}

function counts() {
  let slidePaints = 0
  const elementPaints = new Map<ElementId, number>()
  return {
    slidePaints: () => slidePaints,
    elementPaints: (id: ElementId) => elementPaints.get(id) ?? 0,
    onPaint: () => {
      slidePaints += 1
    },
    onElementPaint: (id: ElementId) => {
      elementPaints.set(id, (elementPaints.get(id) ?? 0) + 1)
    },
  }
}

function deck() {
  const store = paintStore()
  const slide = slideId("slide")
  const left = elementId("1.1")
  const right = elementId("1.2")
  store.publish({ id: left, kind: "shape", text: "left", picture: null })
  store.publish({ id: right, kind: "shape", text: "right", picture: null })
  store.setSlides([{ id: slide, elements: [left, right] }])
  return { store, slide, left, right }
}

function Parent(props: {
  readonly store: PaintStore
  readonly id: SlideId
  readonly onPaint: () => void
  readonly onElementPaint: (id: ElementId) => void
}) {
  const [label, setLabel] = useState("First")
  return createElement(
    "div",
    null,
    createElement("button", { type: "button", onClick: () => setLabel("Second") }, "rename"),
    createElement(OpenSlide, {
      store: props.store,
      id: props.id,
      label,
      onPaint: props.onPaint,
      onElementPaint: props.onElementPaint,
    }),
  )
}

describe("OpenSlide", () => {
  it("one element paints", async () => {
    expect(typeof useElement).toBe("function")
    expect(typeof ElementView).toBe("object")
    const { store, slide, left, right } = deck()
    const painted = counts()
    const host = await render(
      createElement(OpenSlide, {
        store,
        id: slide,
        label: "Deck",
        onPaint: painted.onPaint,
        onElementPaint: painted.onElementPaint,
      }),
    )
    const slidePaints = painted.slidePaints()
    const leftPaints = painted.elementPaints(left)
    const rightPaints = painted.elementPaints(right)
    expect(leftPaints).toBeGreaterThan(0)
    expect(rightPaints).toBeGreaterThan(0)

    store.publish({ id: left, kind: "shape", text: "changed", picture: null })
    await act(async () => {})

    expect(painted.elementPaints(left)).toBe(leftPaints + 1)
    expect(painted.elementPaints(right)).toBe(rightPaints)
    expect(painted.slidePaints()).toBe(slidePaints)
    expect(host.querySelector(`[data-element="${left}"]`)?.textContent).toBe("changed")
    expect(host.querySelector(`[data-element="${right}"]`)?.textContent).toBe("right")
  })

  it("parent rerender skips elements", async () => {
    const { store, slide, left, right } = deck()
    const painted = counts()
    const host = await render(
      createElement(Parent, {
        store,
        id: slide,
        onPaint: painted.onPaint,
        onElementPaint: painted.onElementPaint,
      }),
    )
    const slidePaints = painted.slidePaints()
    const leftPaints = painted.elementPaints(left)
    const rightPaints = painted.elementPaints(right)
    const button = host.querySelector("button")
    if (!(button instanceof HTMLButtonElement)) throw new Error("missing rename")

    await act(async () => {
      button.click()
    })

    expect(host.textContent).toContain("Second")
    expect(painted.slidePaints()).toBe(slidePaints + 1)
    expect(painted.elementPaints(left)).toBe(leftPaints)
    expect(painted.elementPaints(right)).toBe(rightPaints)
  })
})
