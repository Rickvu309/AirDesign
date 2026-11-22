import { elementId, openRegister, slideId, writeTextValue, type Register, type SlideCommand } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest"
import { toast } from "@/components/ui/toast"
import { productCopy } from "@/copy/product-copy"
import { elementCommand } from "@/element-edit"
import { fileSlides } from "@/slide-edit"
import { editedRegister, onSlide, twoBoxSlide, xml } from "../slide-fixtures"
import { storeLane, type StoreLane } from "./store-lane"
import { useDeckPaint, type DeckPaint } from "./use-deck-paint"

const device = vi.hoisted(() => ({ link: null as unknown }))

vi.mock("@airdesign/live", async () => ({
  ...(await vi.importActual<Record<string, unknown>>("@airdesign/live")),
  connect: () => device.link,
}))

const title = elementId("256.2")
let window: Window & typeof globalThis
let root: Root | null = null

function said(text: string): string {
  return writeTextValue([{ from: 0, runs: [{ from: 0, text }] }])
}

function Deck(props: {
  readonly load: () => Promise<boolean>
  readonly seen: { shown: DeckPaint | null }
  readonly lane: StoreLane
}) {
  const nothing = () => undefined
  const pictures = { store: { bytes: new Map(), load: props.load, keep: nothing } }
  props.seen.shown = useDeckPaint("deck", pictures, { show: nothing }, props.lane)
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
  await act(async () => root?.render(createElement(Deck, { load, seen, lane: storeLane() })))
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
  await act(async () =>
    root?.render(createElement(Deck, { load: () => Promise.resolve(false), seen, lane: storeLane() })),
  )
  const shown = seen.shown
  if (shown === null) throw new Error("not rendered")
  const box = { x: 0, y: 0, cx: 1000, cy: 1000 }
  const element = { node: elementId("256.9"), kind: "chart", value: "not a chart", box, grouped: false } as const
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

it("keeps a placed text box in the painted register when a freed layer's device read answers after the box stores", async () => {
  const reads: ((register: Register) => void)[] = []
  device.link = {
    openDeck: () => new Promise((resolve) => reads.push((register) => resolve({ ok: true, register }))),
  }
  const lane = storeLane()
  const seen: { shown: DeckPaint | null } = { shown: null }
  const host = window.document.createElement("div")
  window.document.body.append(host)
  root = createRoot(host)
  await act(async () => root?.render(createElement(Deck, { load: () => Promise.resolve(false), seen, lane })))
  const shown = seen.shown
  if (shown === null) throw new Error("not rendered")
  const parts = onSlide(xml(twoBoxSlide))
  const opened = openRegister("", "")
  await act(async () => shown.showOpened(parts, opened))
  const room = { width: 12_192_000, height: 6_858_000 }
  const add = elementCommand(parts, opened, {
    change: "text",
    index: 0,
    size: room,
    place: { x: 1_524_000, y: 762_000 },
  })
  if (add?.slide !== "element-add") throw new Error("element-add")
  const node = add.element.node
  shown.placed.current = [{ node, file: fileSlides(parts, opened), add, undoable: null, kept: null }]
  await act(async () => shown.showRegister(shown.shownRegister.current))
  const release = shown.busy.current.hold(title)
  shown.busy.current.missed(title)
  release()
  const stored = lane(async () => {
    shown.placed.current = []
  })
  await act(async () => new Promise((later) => setTimeout(later, 0)))
  await act(async () => reads.shift()?.(opened))
  await act(async () => stored)
  const adds = shown.shownRegister.current?.order.flatMap((command) =>
    command.slide === "element-add" ? [command.element.node] : [],
  )
  expect(adds).toEqual([node])
})
