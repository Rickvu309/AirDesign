import { doomFromTree } from "@airdesign/doom"
import { testTheme } from "@airdesign/doom/testing"
import { memoryDoomRemote } from "@airdesign/live"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { ChatDeckView } from "./chat-deck-view"
import { connectChatHost, type ChatHost, type HostState } from "./chat-host"
import { DeckView, type Shell } from "./deck-view"

vi.mock("./chat-host", () => ({ connectChatHost: vi.fn(), parentLine: vi.fn() }))

const id = "trips"
const grown = doomFromTree({
  theme: testTheme,
  slides: [
    {
      children: [
        {
          type: "shape",
          name: "Growth",
          props: {
            box: { x: 0, y: 0, w: 500, h: 300, rotation: 0, flipH: false, flipV: false },
            geometry: { kind: "preset", name: "rect" },
            fills: [{ kind: "solid", color: { var: "accent1" } }],
          },
        },
      ],
    },
    { children: [] },
    { children: [] },
  ],
})

let host: HTMLDivElement
let root: Root
let browser: Window & typeof globalThis

beforeEach(async () => {
  const name = "jsdom"
  const { JSDOM } = (await import(name)) as {
    JSDOM: new (html: string, options: { url: string }) => { window: Window & typeof globalThis }
  }
  browser = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" }).window
  Object.defineProperties(browser.HTMLElement.prototype, {
    clientWidth: { value: 300 },
    clientHeight: { value: 250 },
    scrollIntoView: { value: () => undefined },
  })
  for (const [key, value] of Object.entries({
    window: browser,
    location: browser.location,
    document: browser.document,
    HTMLElement: browser.HTMLElement,
    Element: browser.Element,
    Node: browser.Node,
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    vi.stubGlobal(key, value)
  }
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  browser.close()
  vi.unstubAllGlobals()
})

function find<T extends Element>(selector: string): T {
  const element = host.querySelector<T>(selector)
  if (element === null) throw new Error(`Missing ${selector}`)
  return element
}

const button = (name: string) => find<HTMLButtonElement>(`button[aria-label="${name}"]`)
const slide = () => find<HTMLElement>("[data-view-slide]")
const current = () => slide().getAttribute("data-view-slide")
const click = async (at: HTMLElement) => act(async () => at.click())
const key = async (name: string, isComposing = false) =>
  act(async () =>
    find("main").dispatchEvent(new browser.KeyboardEvent("keydown", { key: name, bubbles: true, isComposing })),
  )

async function open(shell: Shell = {}) {
  const remote = memoryDoomRemote(grown.edit)
  expect((await remote.create({ deck: id })).ok).toBe(true)
  const show = async (next: Shell) => act(async () => root.render(<DeckView id={id} remote={remote} shell={next} />))
  await show(shell)
  return show
}

it("steps forward and back with the header controls at 300 pixels", async () => {
  await open()
  expect(current()).toBe(grown.slides[0])
  expect(button("Previous slide").getAttribute("aria-disabled")).toBe("true")
  await click(button("Next slide"))
  expect(current()).toBe(grown.slides[1])
  expect(host.textContent).toContain("2 / 3")
  await click(button("Previous slide"))
  expect(current()).toBe(grown.slides[0])
})

it("steps with arrows, Home and End while focused outside the filmstrip", async () => {
  await open()
  find<HTMLElement>("main").focus()
  await key("ArrowRight")
  expect(current()).toBe(grown.slides[1])
  await key("End")
  expect(current()).toBe(grown.slides[2])
  await key("ArrowLeft")
  expect(current()).toBe(grown.slides[1])
  await key("Home")
  expect(current()).toBe(grown.slides[0])
})

it("offers fullscreen only when the host supports it", async () => {
  const requestDisplayMode = vi.fn<ChatHost["requestDisplayMode"]>()
  const show = await open({ requestDisplayMode })
  expect(host.querySelector('[aria-label="Fullscreen"]')).toBeNull()
  await show({ requestDisplayMode, canFullscreen: true })
  await click(button("Fullscreen"))
  expect(requestDisplayMode).toHaveBeenCalledExactlyOnceWith("fullscreen")
})

it("exits fullscreen before Escape clears the selection", async () => {
  const requestDisplayMode = vi.fn<ChatHost["requestDisplayMode"]>()
  const tellModel = vi.fn<NonNullable<Shell["tellModel"]>>()
  const shell = { requestDisplayMode, tellModel, canFullscreen: true }
  const show = await open({ ...shell, displayMode: "fullscreen" })
  await click(slide())
  expect(host.querySelector("[data-view-selected]")).not.toBeNull()
  await key("Escape", true)
  expect(requestDisplayMode).not.toHaveBeenCalled()
  await key("Escape")
  expect(requestDisplayMode).toHaveBeenCalledExactlyOnceWith("inline")
  expect(host.querySelector("[data-view-selected]")).not.toBeNull()
  await show({ ...shell, displayMode: "inline" })
  await key("Escape")
  expect(host.querySelector("[data-view-selected]")).toBeNull()
  expect(tellModel).toHaveBeenLastCalledWith(expect.objectContaining({ selected: [] }))
})

it("shows the selected layer name and clears its outline and model context", async () => {
  const tellModel = vi.fn()
  await open({ tellModel })
  expect(host.querySelector("[data-view-selection]")).toBeNull()
  await click(slide())
  expect(find("[data-view-selection]").textContent).toContain("Growth")
  await click(button("Clear selection"))
  expect(host.querySelector("[data-view-selection], [data-view-selected]")).toBeNull()
  expect(tellModel).toHaveBeenLastCalledWith(expect.objectContaining({ selected: [] }))
})

it("uses the host color scheme for its light and dark chrome tokens", async () => {
  const variables = { "--color-background-primary": "light-dark(white, black)" }
  let state: HostState = { shown: null, context: { theme: "light", styles: { variables } } }
  let changed = () => {}
  vi.mocked(connectChatHost).mockResolvedValue({
    callTool: async () => undefined,
    openLink() {},
    sizeTo() {},
    requestDisplayMode: async () => undefined,
    state: () => state,
    subscribe: (watcher) => {
      changed = watcher
      return () => {}
    },
    closed: new AbortController().signal,
  })
  await act(async () => root.render(<ChatDeckView />))
  const { style } = document.documentElement
  expect(style.colorScheme).toBe("light")
  expect(style.getPropertyValue("--color-background-primary")).toBe(variables["--color-background-primary"])
  state = { ...state, context: { ...state.context, theme: "dark" } }
  await act(async () => changed())
  expect(style.colorScheme).toBe("dark")
  expect(style.getPropertyValue("--color-background-primary")).toBe(variables["--color-background-primary"])
})
