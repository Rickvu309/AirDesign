import { act } from "react"
import type { Root } from "react-dom/client"
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest"
import { productCopy } from "@/copy/product-copy"
import { storyIdeas } from "@/copy/story-ideas-copy"

let createRoot: typeof import("react-dom/client").createRoot
let DescribeDeck: typeof import("./describe-deck").DescribeDeck
let host: HTMLDivElement
let root: Root
let close: () => void
const described: string[] = []

beforeAll(async () => {
  const name = "jsdom"
  const { JSDOM } = (await import(name)) as {
    JSDOM: new (html: string, options: { url: string }) => { window: Window & typeof globalThis }
  }
  const { window } = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" })
  close = () => window.close()
  for (const [key, value] of Object.entries({
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    HTMLTextAreaElement: window.HTMLTextAreaElement,
    Element: window.Element,
    Node: window.Node,
    Event: window.Event,
    KeyboardEvent: window.KeyboardEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
  }))
    vi.stubGlobal(key, value)
  createRoot = (await import("react-dom/client")).createRoot
  DescribeDeck = (await import("./describe-deck")).DescribeDeck
})

afterEach(async () => {
  if (root) await act(async () => root.unmount())
  host?.remove()
  described.length = 0
})

afterAll(() => {
  close()
  vi.unstubAllGlobals()
})

async function show(initial = "") {
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
  await act(async () => root.render(<DescribeDeck initial={initial} onDescribe={(text) => described.push(text)} />))
  const field = host.querySelector<HTMLTextAreaElement>(`textarea[aria-label="${productCopy.describeDeck}"]`)
  if (field === null) throw new Error("no describe box")
  return field
}

async function type(field: HTMLTextAreaElement, text: string) {
  const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set
  await act(async () => {
    set?.call(field, text)
    field.dispatchEvent(new window.Event("input", { bubbles: true }))
  })
}

const press = (field: HTMLTextAreaElement, init: { shiftKey?: boolean } = {}) =>
  act(async () => {
    field.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...init }))
  })

it("shows an example in the placeholder and offers words that were already written", async () => {
  const field = await show("A board update on Q3 revenue")
  expect(field.placeholder).toBe(productCopy.describeDeckExample)
  expect(field.getAttribute("aria-label")).toBe(productCopy.describeDeck)
  expect(field.value).toBe("A board update on Q3 revenue")
})

it("describes the deck with the trimmed words on Enter", async () => {
  const field = await show()
  await type(field, "  A board update on Q3 revenue ")
  await press(field)
  expect(described).toEqual(["A board update on Q3 revenue"])
})

it("describes nothing for empty words or a Shift+Enter line break", async () => {
  const field = await show()
  await type(field, "   ")
  await press(field)
  await type(field, "A deck")
  await press(field, { shiftKey: true })
  expect(described).toEqual([])
})

it("keeps Make deck off until there are words", async () => {
  const field = await show()
  const send = () => host.querySelector(`button[aria-label="${productCopy.makeDeck}"]`)
  expect(send()?.hasAttribute("disabled")).toBe(true)
  await type(field, "A deck")
  expect(send()?.hasAttribute("disabled")).toBe(false)
})

const shown = () =>
  [...host.querySelectorAll<HTMLButtonElement>("[data-story-idea]")].map((idea) => idea.textContent?.trim())

it("puts an idea's words in the box and waits for Enter before it describes the deck", async () => {
  const field = await show()
  const idea = host.querySelector<HTMLButtonElement>("[data-story-idea]")
  await act(async () => idea?.click())
  expect(field.value).toBe(storyIdeas[0].words)
  expect(described).toEqual([])
  await press(field)
  expect(described).toEqual([storyIdeas[0].words])
})

it("shows three ideas, and More ideas swaps in three others until the list starts again", async () => {
  await show()
  const first = shown()
  expect(first).toEqual(storyIdeas.slice(0, 3).map((idea) => idea.words))
  const more = [...host.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === productCopy.moreIdeas,
  )
  await act(async () => more?.click())
  expect(shown()).toEqual(storyIdeas.slice(3, 6).map((idea) => idea.words))
  for (let turn = 3; turn < storyIdeas.length; turn += 3) await act(async () => more?.click())
  expect(shown()).toEqual(first)
})
