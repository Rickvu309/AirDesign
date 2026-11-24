import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest"
import { nodeId, type NodeId } from "@airdesign/doom"
import { useCurrentSlide } from "./use-current-slide"

const ids = ["a:1", "a:2", "a:3"].map(nodeId)
let host: HTMLDivElement
let root: Root
let close: () => void
let show: (id: NodeId) => void = () => undefined
let current: NodeId | undefined

beforeAll(async () => {
  const name = "jsdom"
  const { JSDOM } = (await import(name)) as {
    JSDOM: new (html: string, options: { url: string }) => { window: Window & typeof globalThis }
  }
  const { window } = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/s/abc" })
  close = () => window.close()
  for (const [key, value] of Object.entries({
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  }))
    vi.stubGlobal(key, value)
})

afterEach(async () => {
  if (root) await act(async () => root.unmount())
  host?.remove()
  window.history.replaceState(null, "", "/s/abc")
})

afterAll(() => {
  close()
  vi.unstubAllGlobals()
})

function Probe({ slides }: { readonly slides: readonly NodeId[] }) {
  const [slide, choose] = useCurrentSlide(slides)
  current = slide
  show = choose
  return null
}

async function open(search: string, slides: readonly NodeId[] = ids) {
  window.history.replaceState(null, "", `/s/abc${search}`)
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
  await act(async () => root.render(<Probe slides={slides} />))
}

it("opens at the slide named in the address", async () => {
  await open("?node-id=a%3A3")
  expect(current).toBe("a:3")
})

it("opens at slide 1 when the address names a slide that is gone", async () => {
  await open("?node-id=gone%3A9")
  expect(current).toBe("a:1")
  expect(window.location.search).toBe("?node-id=a%3A1")
})

it("puts the current slide in the address", async () => {
  await open("")
  expect(window.location.search).toBe("?node-id=a%3A1")
})

it("moves between slides by replacing the history entry, not adding one", async () => {
  await open("")
  const length = window.history.length
  await act(async () => show(nodeId("a:2")))
  await act(async () => show(nodeId("a:3")))
  expect(current).toBe("a:3")
  expect(window.location.search).toBe("?node-id=a%3A3")
  expect(window.history.length).toBe(length)
})
