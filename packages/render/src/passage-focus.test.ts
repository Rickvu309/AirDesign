import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { elementId } from "@airdesign/document"
import { afterEach, expect, it, vi } from "vitest"
import { Passage, paintStore } from "./index.js"

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)

afterEach(() => {
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

it("a value from elsewhere does not move the selection into a box that has lost focus", async () => {
  const store = paintStore()
  const id = elementId("1.1")
  const show = (text: string) =>
    act(async () => {
      store.publish({ id, kind: "shape", text, picture: null })
    })
  await show("Hello world")
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  await act(async () => {
    root.render(createElement(Passage, { store, id, onEdit: () => {} }))
  })
  const editor = host.querySelector<HTMLElement>("[contenteditable]")
  const text = editor?.querySelector("[data-run]")?.firstChild
  if (editor === null || editor === undefined || !(text instanceof Text)) throw new Error("missing passage")
  const frame = document.createElement("div")
  frame.tabIndex = -1
  host.append(frame)
  frame.focus()
  const selection = window.getSelection()
  const range = document.createRange()
  range.setStart(text, 5)
  selection?.removeAllRanges()
  selection?.addRange(range)
  const placed = vi.spyOn(Selection.prototype, "addRange")

  await show("Hello wide world")

  expect(editor.textContent).toBe("Hello wide world")
  expect(placed).not.toHaveBeenCalled()
  expect(document.activeElement).toBe(frame)
  await act(async () => {
    root.unmount()
  })
})
