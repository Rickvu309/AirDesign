import { elementId, slideId, writeTextValue, type SlideCommand } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest"
import { toast } from "@/components/ui/toast"
import { productCopy } from "@/copy/product-copy"
import { editedRegister, onSlide, twoBoxSlide, xml } from "../slide-fixtures"
import { useDeckPaint, type DeckPaint } from "./use-deck-paint"

const title = elementId("256.2")
let window: Window & typeof globalThis
let root: Root | null = null

function said(text: string): string {
  return writeTextValue([{ from: 0, runs: [{ from: 0, text }] }])
}

function Deck(props: { readonly load: () => Promise<boolean>; readonly seen: { shown: DeckPaint | null } }) {
  const nothing = () => undefined
  const pictures = { store: { bytes: new Map(), load: props.load, keep: nothing } }
  props.seen.shown = useDeckPaint("deck", pictures, { show: nothing })
  return null
}

beforeAll(async () => {
  const jsdomName = "jsdom"
  const jsdom = (await import(jsdomName)) as {
    JSDOM: new (html: string, options?: { url?: string }) => { readonly window: Window & typeof globalThis }
  }
  window = new jsdom.JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" }).window
  const shared: [string, unknown][] = [
    ["window", window],
    ["document", window.document],
    ["HTMLElement", window.HTMLElement],
    ["IS_REACT_ACT_ENVIRONMENT", true],
  ]
  for (const [name, value] of shared) vi.stubGlobal(name, value)
})

afterEach(async () => {
  await act(async () => root?.unmount())
  root = null
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

it("pictures that finish loading after an edit painted keep the edit on the slide", async () => {
  const loads: ((more: boolean) => void)[] = []
  const load = () => new Promise<boolean>((resolve) => loads.push(resolve))
  const seen: { shown: DeckPaint | null } = { shown: null }
  const host = window.document.createElement("div")
  window.document.body.append(host)
  root = createRoot(host)
  await act(async () => root?.render(createElement(Deck, { load, seen })))
  const shown = seen.shown
  if (shown === null) throw new Error("not rendered")
  await act(async () => shown.showOpened(onSlide(xml(twoBoxSlide)), editedRegister([["256.2", said("Hello")]])))
  shown.repaint.current(editedRegister([["256.2", said("Hello from Aira")]]))
  expect(shown.store.current.getElement(title)?.text).toBe(said("Hello from Aira"))
  await act(async () => loads.shift()?.(true))
  expect(shown.store.current.getElement(title)?.text).toBe(said("Hello from Aira"))
})

it("leaves out an edit the device cannot write with one notice, paints the edits after it, and takes the notice down once every edit writes", async () => {
  const error = vi.spyOn(toast, "error")
  const seen: { shown: DeckPaint | null } = { shown: null }
  const host = window.document.createElement("div")
  window.document.body.append(host)
  root = createRoot(host)
  await act(async () => root?.render(createElement(Deck, { load: () => Promise.resolve(false), seen })))
  const shown = seen.shown
  if (shown === null) throw new Error("not rendered")
  const box = { x: 0, y: 0, cx: 1000, cy: 1000 }
  const element = { node: elementId("256.9"), kind: "table", value: "not a table", box, grouped: false } as const
  const unwritable: SlideCommand = { slide: "element-add", id: slideId("256"), element }
  const edited = editedRegister([["256.2", said("Hello again")]])
  const register = { ...edited, file: [slideId("256")], order: [unwritable] }
  await act(async () => shown.showOpened(onSlide(xml(twoBoxSlide)), register))
  expect(shown.store.current.getElement(title)?.text).toBe(said("Hello again"))
  expect(shown.store.current.getElement(elementId("256.9"))).toBeNull()
  await act(async () => shown.showOpened(onSlide(xml(twoBoxSlide)), register))
  expect(error.mock.calls).toEqual([
    [productCopy.editsLeftOut, { id: "edits-left-out", description: productCopy.editsLeftOutBody }],
  ])
  const dismiss = vi.spyOn(toast, "dismiss").mockImplementation((id) => id ?? "")
  await act(async () => shown.showOpened(onSlide(xml(twoBoxSlide)), edited))
  expect(dismiss.mock.calls).toEqual([["edits-left-out"]])
  error.mockRestore()
  dismiss.mockRestore()
})
