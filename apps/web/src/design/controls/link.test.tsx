import { resolveControl } from "@/design/panel-arrangement"
import { traits } from "@airdesign/document"
import { act, createElement } from "react"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import type { ControlProps } from "@/design/panel"
import { linkCopy } from "@/copy/link-copy"

let window: Window & typeof globalThis
let createRoot: typeof import("react-dom/client").createRoot
let LinkControl: typeof import("./link").LinkControl

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
  LinkControl = (await import("./link")).LinkControl
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

it.each([
  ["Doom", ["s:1", "s:2"]],
  ["the old editor", ["3", "7"]],
])("links to a slide by its number on %s, and shows that number for the link it holds", async (_editor, slides) => {
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  const onChange = vi.fn()
  const props = (value: unknown): ControlProps => ({
    control: {
      ...resolveControl({
        trait: "link",
        field: "target",
        label: "Link",
        desc: traits.link.fields.target.desc,
        value,
        mixed: false,
        inherited: false,
        reset: null,
      }),
      slides,
    },
    palette: { templateColors: [], deck: [] },
    onChange,
  })
  try {
    await act(async () => root.render(createElement(LinkControl, props(undefined))))
    const input = host.querySelector("input")
    if (input === null) throw new Error("Link")
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set?.call(input, "2")
      input.dispatchEvent(new window.Event("input", { bubbles: true }))
    })
    await act(async () => {
      input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    })
    expect(input.hasAttribute("aria-invalid")).toBe(false)
    expect(onChange).toHaveBeenCalledWith({ kind: "slide", slide: slides[1] })
    await act(async () => root.render(createElement(LinkControl, props({ kind: "slide", slide: slides[1] }))))
    expect(input.value).toBe("2")
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})

it("marks an address it cannot use as invalid and says why, beside the field", async () => {
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  const onChange = vi.fn()
  const control = {
    ...resolveControl({
      trait: "link",
      field: "target",
      label: "Link",
      desc: traits.link.fields.target.desc,
      value: undefined,
      mixed: false,
      inherited: false,
      reset: null,
    }),
    slides: ["s:1"],
  }
  try {
    await act(async () =>
      root.render(createElement(LinkControl, { control, palette: { templateColors: [], deck: [] }, onChange })),
    )
    const input = host.querySelector("input")
    if (input === null) throw new Error("Link")
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set?.call(input, "9")
      input.dispatchEvent(new window.Event("input", { bubbles: true }))
    })
    await act(async () => {
      input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    })
    expect(onChange).not.toHaveBeenCalled()
    expect(input.getAttribute("aria-invalid")).toBe("true")
    const said = window.document.getElementById(input.getAttribute("aria-describedby") ?? "none")
    expect(said?.textContent).toBe(linkCopy.invalid)
    expect(host.querySelector('[data-link-field][data-focus-ring] > input[aria-invalid="true"]')).not.toBeNull()
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set?.call(input, "ana@example.com")
      input.dispatchEvent(new window.Event("input", { bubbles: true }))
    })
    await act(async () => {
      input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    })
    expect(onChange).toHaveBeenCalledWith({ kind: "url", url: "mailto:ana@example.com" })
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})
