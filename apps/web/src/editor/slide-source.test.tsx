import * as doom from "@airdesign/doom"
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

async function field(source: string, asked = false) {
  const saved: string[] = []
  const taken: boolean[] = []
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  const render = (next: boolean) =>
    act(async () =>
      root.render(
        createElement(SlideSource, {
          source,
          asked: next,
          onTaken: () => taken.push(true),
          onSource: (each) => saved.push(each),
        }),
      ),
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
  return { input, saved, taken, type, press, render, stop, host }
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

it("takes focus with its words selected once, when the person double-clicks the source on the slide", async () => {
  const { input, taken, render, stop } = await field("Source: Filings")
  expect(window.document.activeElement).not.toBe(input)
  await render(true)
  expect(window.document.activeElement).toBe(input)
  expect([input.selectionStart, input.selectionEnd]).toEqual([0, "Source: Filings".length])
  expect(taken).toEqual([true])
  await stop()
})

it("leaves the field alone when it shows again with no request, as after the layer selection clears", async () => {
  const { input, taken, stop } = await field("Source: Filings", false)
  expect(window.document.activeElement).not.toBe(input)
  expect(taken).toEqual([])
  await stop()
})

it("saves the same words the agent path stores for the same raw input", async () => {
  const raws = ["  Source: A\n\n B  ", "So\u0000urce", `${"a".repeat(297)}😀`, "é".repeat(500), "x".repeat(400)]
  for (const raw of raws) {
    const { saved, type, press, stop } = await field("Source: Old")
    await type(raw)
    await press("Enter")
    const read = doom.readAgentChange({ op: "set", target: "t:1", source: raw })
    if ("refused" in read) throw new Error(JSON.stringify(read))
    expect(saved).toEqual([doom.sourceLine(raw)])
    expect(read).toMatchObject({ source: doom.sourceLine(raw) })
    await stop()
  }
})

it("returns focus to the canvas on Escape, keeping the saved source", async () => {
  const stage = window.document.createElement("div")
  stage.tabIndex = 0
  stage.setAttribute("data-canvas-stage", "")
  window.document.body.append(stage)
  const { input, saved, type, press, stop } = await field("Source: Old", true)
  expect(window.document.activeElement).toBe(input)
  await type("Source: New")
  await press("Escape")
  expect(window.document.activeElement).toBe(stage)
  expect(input.value).toBe("Source: Old")
  expect(saved).toEqual([])
  await stop()
  stage.remove()
})
