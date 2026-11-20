import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest"
import { controlHandsKeysBack, editorOwnsKey, handOf, leavesPicker, pickerHandsKeysBack } from "./editor-key-ownership"

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

it.each(["Enter", "Escape"])("gives the keys back to the canvas after %s in a design panel control", (key) => {
  window.document.body.innerHTML =
    '<div data-design-panel><input id="opacity"><textarea></textarea></div><input id="elsewhere">'
  const read = (selector: string, init: KeyboardEventInit = {}) => {
    let handsBack: boolean | null = null
    const target = window.document.querySelector(selector)!
    target.addEventListener("keydown", (event) => (handsBack = controlHandsKeysBack(event as KeyboardEvent)), {
      once: true,
    })
    target.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }))
    return handsBack
  }
  expect(read("#opacity")).toBe(true)
  expect(read("#opacity", { isComposing: true })).toBe(false)
  expect(read("#opacity", { ctrlKey: true })).toBe(false)
  expect(read("textarea")).toBe(false)
  expect(read("#elsewhere")).toBe(false)
})

it("keeps the keys in a design panel control for every other key", () => {
  window.document.body.innerHTML = "<div data-design-panel><input></div>"
  const input = window.document.querySelector("input")!
  const read: boolean[] = []
  input.addEventListener("keydown", (event) => read.push(controlHandsKeysBack(event as KeyboardEvent)))
  for (const key of ["l", "r", "Tab", "ArrowUp", "Backspace"])
    input.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true }))
  expect(read).toEqual([false, false, false, false, false])
})

it("gives the keys back to the canvas when focus leaves a picker for its trigger in the design panel", () => {
  window.document.body.innerHTML = `
    <div data-design-panel><button id="trigger" aria-haspopup="listbox"></button><input id="opacity"></div>
    <div data-slot="select-content"><div role="option" tabindex="-1" id="option"></div><div role="option" tabindex="-1" id="next"></div></div>
    <div data-slot="popover-content"><button id="swatch"></button></div>
    <div data-slot="dropdown-menu-content"><div role="menuitem" tabindex="-1" id="step"></div></div>`
  const at = (id: string) => window.document.getElementById(id)!
  const moves: [string, string, boolean][] = []
  window.document.addEventListener("focusout", (event) => {
    const from = (event.target as Element).id
    const to = (event.relatedTarget as Element | null)?.id ?? "nothing"
    moves.push([from, to, leavesPicker(event as FocusEvent)])
  })
  for (const [from, to] of [
    ["option", "next"],
    ["option", "trigger"],
    ["swatch", "trigger"],
    ["step", "opacity"],
    ["opacity", "trigger"],
  ]) {
    at(from).focus()
    at(to).focus()
  }
  at("step").focus()
  at("step").blur()
  expect(moves.filter(([, , leaves]) => leaves).map(([from, to]) => `${from} to ${to}`)).toEqual([
    "option to trigger",
    "swatch to trigger",
    "step to opacity",
    "step to nothing",
  ])
  expect(pickerHandsKeysBack(at("trigger"), "pointer")).toBe(true)
  expect(pickerHandsKeysBack(at("trigger"), "keys")).toBe(false)
  expect(pickerHandsKeysBack(at("trigger"), null)).toBe(false)
  expect(pickerHandsKeysBack(at("opacity"), "pointer")).toBe(false)
  expect(pickerHandsKeysBack(at("swatch"), "pointer")).toBe(false)
})

it("reads the hand that last worked a picker, and Escape or a held key alone does not change it", () => {
  const key = (name: string) => new window.KeyboardEvent("keydown", { key: name })
  const pointer = { type: "pointerdown" } as unknown as PointerEvent
  expect(handOf(pointer, "keys")).toBe("pointer")
  expect(handOf(key("ArrowRight"), "pointer")).toBe("keys")
  expect(handOf(key("Enter"), "pointer")).toBe("keys")
  expect(handOf(key("Escape"), "pointer")).toBe("pointer")
  expect(handOf(key("Shift"), "pointer")).toBe("pointer")
})
