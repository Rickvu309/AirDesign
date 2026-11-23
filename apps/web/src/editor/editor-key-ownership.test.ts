import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest"
import { editorOwnsKey, toolKeyPlace } from "./editor-key-ownership"

let window: Window & typeof globalThis

beforeAll(async () => {
  const name = "jsdom"
  const { JSDOM } = await import(name)
  window = new JSDOM("<!doctype html><html><body></body></html>").window
  for (const name of [
    "window",
    "document",
    "Node",
    "Element",
    "HTMLInputElement",
    "KeyboardEvent",
    "FocusEvent",
  ] as const)
    vi.stubGlobal(name, window[name])
})

afterEach(() => window.document.body.replaceChildren())
afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

it.each(["menu", "popover"])("hands Escape to the %s before grid capture and element handlers", (kind) => {
  const document = window.document
  document.body.innerHTML = `<button id="slide"></button><div data-open ${kind === "menu" ? 'role="menu"' : 'data-slot="popover-content"'}><input></div>`
  const slide = document.querySelector("button")!
  const popup = document.querySelector<HTMLElement>("[data-open]")!
  const events: string[] = []
  const capture = (event: KeyboardEvent) => {
    if (editorOwnsKey(event)) events.push("canvas")
  }
  const another = (event: KeyboardEvent) => {
    if (editorOwnsKey(event)) events.push("drag")
  }
  window.addEventListener("keydown", capture, true)
  window.addEventListener("keydown", another, true)
  slide.addEventListener("keydown", () => events.push("slide"))
  popup.addEventListener("keydown", () => {
    events.push("popup")
    popup.removeAttribute("data-open")
  })
  try {
    slide.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }))
    expect(events).toEqual(["popup"])
    events.length = 0
    slide.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }))
    expect(events).toEqual(["canvas", "drag", "slide"])
  } finally {
    window.removeEventListener("keydown", capture, true)
    window.removeEventListener("keydown", another, true)
  }
})

it("keeps composing Escape and background keys out of the grid without sending menu commands", () => {
  window.document.body.innerHTML = '<button></button><div role="menu" data-open></div>'
  const slide = window.document.querySelector("button")!
  const popup = window.document.querySelector<HTMLElement>('[role="menu"]')!
  const keys: string[] = []
  popup.addEventListener("keydown", (event) => keys.push(event.key))
  slide.addEventListener("keydown", (event) => expect(editorOwnsKey(event)).toBe(false))
  for (const key of ["Escape", "Delete", "Enter", " ", "ArrowRight", "+"]) {
    const event = new window.KeyboardEvent("keydown", { key, isComposing: true, cancelable: true })
    slide.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  }
  expect(keys).toEqual([])
})

it("gives the one-key tools to the slide, the layers and the slide list, and not to a button elsewhere", () => {
  window.document.body.innerHTML = [
    '<div data-slide-paint><div id="layer"></div></div>',
    '<div data-layers-panel><button id="row"></button></div>',
    '<div data-slide-list><button id="slide"></button></div>',
    '<button id="present"></button>',
  ].join("")
  const at = (id: string) => window.document.getElementById(id)
  expect([at("layer"), at("row"), at("slide"), at("present"), window.document.body, null].map(toolKeyPlace)).toEqual([
    "editor",
    "editor",
    "slides",
    null,
    null,
    null,
  ])
})
