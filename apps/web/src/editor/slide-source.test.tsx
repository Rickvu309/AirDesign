import { act, createElement } from "react"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import { designCopy } from "@/copy/design-copy"
import { SlideSource } from "./slide-source"

let window: Window & typeof globalThis
let createRoot: typeof import("react-dom/client").createRoot

beforeAll(async () => {
  const module = "jsdom"
  const { JSDOM } = await import(module)
  window = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" }).window
  for (const [name, value] of Object.entries({
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    HTMLInputElement: window.HTMLInputElement,
    Element: window.Element,
    Node: window.Node,
    navigator: window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true,
  }))
    vi.stubGlobal(name, value)
  createRoot = (await import("react-dom/client")).createRoot
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

async function field(source: string, asked = 0) {
  const saved: string[] = []
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  const render = (next: number) =>
    act(async () =>
      root.render(createElement(SlideSource, { source, asked: next, onSource: (each) => saved.push(each) })),
    )
  await render(asked)
  const input = host.querySelector<HTMLInputElement>("[data-slide-source]")!
  const type = (words: string) =>
    act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!
      setter.call(input, words)
      input.dispatchEvent(new window.Event("input", { bubbles: true }))
    })
  const press = (key: string) =>
    act(async () => {
      input.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true }))
    })
  const stop = () => act(async () => root.unmount())
  return { input, saved, type, press, render, stop }
}

it("saves the source a person types when they press Enter, trimmed", async () => {
  const { input, saved, type, press, stop } = await field("")
  expect(input.getAttribute("aria-label")).toBe(designCopy.source)
  expect(input.placeholder).toBe(designCopy.sourceExample)
  await type("  Source: Team analysis  ")
  await press("Enter")
  expect(saved).toEqual(["Source: Team analysis"])
  await stop()
})

it("clears the source when a person empties the field, and keeps it on Escape", async () => {
  const cleared = await field("Source: Old")
  await cleared.type("")
  await cleared.press("Enter")
  expect(cleared.saved).toEqual([""])
  await cleared.stop()
  const kept = await field("Source: Old")
  await kept.type("Source: New")
  await kept.press("Escape")
  expect(kept.input.value).toBe("Source: Old")
  expect(kept.saved).toEqual([])
  await kept.stop()
})

it("takes focus with its words selected when the person double-clicks the source on the slide", async () => {
  const { input, render, stop } = await field("Source: Filings")
  expect(window.document.activeElement).not.toBe(input)
  await render(1)
  expect(window.document.activeElement).toBe(input)
  expect([input.selectionStart, input.selectionEnd]).toEqual([0, "Source: Filings".length])
  await stop()
})
