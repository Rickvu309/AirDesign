import { cellText, readTextValue, traits } from "@airdesign/document"
import { act, createElement } from "react"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import type { ControlProps } from "@/design/panel"

let window: Window & typeof globalThis
let createRoot: typeof import("react-dom/client").createRoot
let TextControl: typeof import("./text").TextControl

beforeAll(async () => {
  const module = "jsdom"
  const { JSDOM } = await import(module)
  window = new JSDOM("<!doctype html><html><body></body></html>").window
  for (const [name, value] of Object.entries({
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    Node: window.Node,
    IS_REACT_ACT_ENVIRONMENT: true,
  }))
    vi.stubGlobal(name, value)
  createRoot = (await import("react-dom/client")).createRoot
  TextControl = (await import("./text")).TextControl
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

it.each(["A".repeat(8001), "é".repeat(4001), '"'.repeat(4000)])(
  "keeps over-limit Text on save and blur, then saves its correction",
  async (typed) => {
    const host = window.document.createElement("div")
    window.document.body.append(host)
    const root = createRoot(host)
    const onChange = vi.fn()
    const props: ControlProps = {
      row: {
        trait: "text",
        field: "value",
        label: "Text",
        control: "text",
        desc: traits.text.fields.value.desc,
        value: "Hello",
        mixed: false,
        inherited: false,
        caption: false,
        reset: null,
        change: () => {
          throw new Error("unused")
        },
      },
      palette: { theme: [], deck: [], behind: null },
      onChange,
    }
    try {
      await act(async () => root.render(createElement(TextControl, props)))
      const input = host.querySelector("textarea")
      if (input === null) throw new Error("Text")
      async function enter(text: string) {
        await act(async () => {
          Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set?.call(input, text)
          input?.dispatchEvent(new window.Event("input", { bubbles: true }))
        })
      }
      await enter(typed)
      expect(input.getAttribute("aria-invalid")).toBe("true")
      const id = input.getAttribute("aria-describedby") ?? ""
      expect(window.document.getElementById(id)?.textContent).toBe(
        "Use less text. Text and formatting must fit within 8,000 bytes.",
      )
      await act(async () => {
        input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }))
        input.dispatchEvent(new window.Event("focusout", { bubbles: true }))
      })
      expect(input.value).toBe(typed)
      expect(onChange).not.toHaveBeenCalled()
      await enter("Corrected text")
      expect(input.hasAttribute("aria-invalid")).toBe(false)
      await act(async () => input.dispatchEvent(new window.Event("focusout", { bubbles: true })))
      expect(onChange).toHaveBeenCalledOnce()
      expect(cellText(readTextValue(onChange.mock.calls[0]?.[0]) ?? [])).toBe("Corrected text")
    } finally {
      await act(async () => root.unmount())
      host.remove()
    }
  },
)
