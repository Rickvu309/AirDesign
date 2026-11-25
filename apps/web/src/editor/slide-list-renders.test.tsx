import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import { SlideSidebar, type SlideStrip } from "@/editor/slide-sidebar"
import { nodeId } from "@airdesign/doom"

const menus = vi.hoisted(() => ({ rendered: 0 }))

vi.mock("@/components/ui/dropdown-menu", async () => {
  const actual = await vi.importActual<typeof import("@/components/ui/dropdown-menu")>("@/components/ui/dropdown-menu")
  return {
    ...actual,
    DropdownMenu: (props: Parameters<typeof actual.DropdownMenu>[0]) => {
      menus.rendered += 1
      return actual.DropdownMenu(props)
    },
  }
})

let window: Window & typeof globalThis

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
    ["Element", window.Element],
    ["Node", window.Node],
    ["IS_REACT_ACT_ENVIRONMENT", true],
    ["requestAnimationFrame", (step: () => void) => setTimeout(step, 0)],
    ["cancelAnimationFrame", (handle: number) => clearTimeout(handle)],
  ]
  for (const [name, value] of shared) vi.stubGlobal(name, value)
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

const stripOf = (current: number): SlideStrip => ({
  count: 6,
  slideIds: [nodeId("n:1"), nodeId("n:2"), nodeId("n:3"), nodeId("n:4"), nodeId("n:5"), nodeId("n:6")],
  current,
  onSelect: () => undefined,
  onClone: () => undefined,
  onRemove: () => undefined,
  onMove: () => undefined,
  onSkip: () => undefined,
  thumbHeight: 101,
  thumb: () => null,
})

it("leaves the closed slide menus alone when the deck paints again with the same slides", async () => {
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  await act(async () => root.render(<SlideSidebar title="Deck" strip={stripOf(0)} />))
  const first = menus.rendered
  expect(first).toBeGreaterThanOrEqual(6)

  for (let typed = 0; typed < 5; typed += 1)
    await act(async () => root.render(<SlideSidebar title="Deck" strip={stripOf(0)} />))
  expect(menus.rendered).toBe(first)

  await act(async () => root.render(<SlideSidebar title="Deck" strip={stripOf(1)} />))
  expect(menus.rendered).toBe(first)

  await act(async () => root.unmount())
  host.remove()
})
