import { act, createElement, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { Passage, elementId, paintStore } from "./index.js"

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

async function render(node: ReactNode): Promise<{ host: HTMLDivElement; root: Root }> {
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  await act(async () => {
    root.render(node)
  })
  return { host, root }
}

describe("Passage", () => {
  it("composition keeps the text node", async () => {
    const store = paintStore()
    const id = elementId("body")
    expect(store.publish({ id, kind: "shape", text: "hello", picture: null })).toEqual({ ok: true })
    function Parent(props: { readonly generation: number }) {
      return createElement("div", { "data-generation": props.generation }, createElement(Passage, { store, id }))
    }
    const mounted = await render(createElement(Parent, { generation: 0 }))
    const host = mounted.host
    const editor = host.querySelector("[contenteditable]")
    if (!(editor instanceof HTMLElement)) throw new Error("missing passage")
    editor.focus()
    const textNode = editor.firstChild
    if (!(textNode instanceof Text)) throw new Error("missing text")
    const selection = window.getSelection()
    if (selection === null) throw new Error("missing selection")
    const range = document.createRange()
    range.setStart(textNode, 1)
    range.setEnd(textNode, 4)
    selection.removeAllRanges()
    selection.addRange(range)
    const active = document.activeElement

    await act(async () => {
      editor.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))
      editor.dispatchEvent(new CompositionEvent("compositionupdate", { bubbles: true, data: "helloあ" }))
    })
    textNode.nodeValue = "helloあ"
    range.setStart(textNode, 1)
    range.setEnd(textNode, 4)
    selection.removeAllRanges()
    selection.addRange(range)
    await act(async () => {
      mounted.root.render(createElement(Parent, { generation: 1 }))
    })

    expect(editor.firstChild).toBe(textNode)
    expect(textNode.nodeValue).toBe("helloあ")
    expect(document.activeElement).toBe(active)
    expect(selection.rangeCount).toBe(1)
    const during = selection.getRangeAt(0)
    expect(during).toBe(range)
    expect(during.startContainer).toBe(textNode)
    expect(during.startOffset).toBe(1)
    expect(during.endOffset).toBe(4)
    expect(store.getElement(id)?.text).toBe("hello")

    const record = store.getElement(id)
    if (record === null) throw new Error("missing record")
    store.publish({ id: record.id, kind: record.kind, text: "outside", picture: record.picture })
    expect(editor.firstChild).toBe(textNode)
    expect(store.getElement(id)?.text).toBe("hello")

    const seen: string[] = []
    store.elementSubscribe(id)(() => {
      const text = store.getElement(id)?.text
      if (text !== undefined) seen.push(text)
    })
    await act(async () => {
      editor.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "helloあ" }))
    })

    expect(seen[0]).toBe("helloあ")
    expect(store.getElement(id)?.text).toBe("outside")
  })

  it("reports committed text and stays quiet during composition", async () => {
    const seen: string[] = []
    const store = paintStore()
    const id = elementId("body")
    expect(store.publish({ id, kind: "shape", text: "hello", picture: null })).toEqual({ ok: true })
    const mounted = await render(
      createElement(Passage, {
        store,
        id,
        onEdit: (value) => {
          seen.push(value)
        },
      }),
    )
    const editor = mounted.host.querySelector("[contenteditable]")
    if (!(editor instanceof HTMLElement)) throw new Error("missing passage")
    const textNode = editor.firstChild
    await act(async () => {
      editor.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))
      editor.dispatchEvent(new CompositionEvent("compositionupdate", { bubbles: true, data: "helloあ" }))
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, data: "あ" }))
    })
    expect(seen).toEqual([])
    expect(editor.firstChild).toBe(textNode)
    editor.textContent = "helloあ"
    await act(async () => {
      editor.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "helloあ" }))
    })
    expect(seen).toEqual(["helloあ"])
    editor.textContent = "Hello!"
    await act(async () => {
      editor.dispatchEvent(new InputEvent("input", { bubbles: true }))
    })
    expect(seen).toEqual(["helloあ", "Hello!"])
  })
})
