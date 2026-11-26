import type { Root } from "react-dom/client"
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest"
import { defaultTheme, measureWith, slideStarts } from "@airdesign/doom"
import { editorCopy } from "@/copy/editor-copy"
import { layoutPictures } from "@/editor/layout-pictures"

let act: typeof import("react").act
let NewSlideMenu: typeof import("@/editor/new-slide-menu").NewSlideMenu

let window: Window & typeof globalThis
let root: Root | null = null
let createRoot: typeof import("react-dom/client").createRoot
let frames: Array<{ id: number; callback: FrameRequestCallback }> = []
let nextFrame = 0

beforeAll(async () => {
  const jsdomName = "jsdom"
  const { JSDOM } = await import(jsdomName)
  window = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" }).window
  const shared: [string, unknown][] = [
    ["window", window],
    ["document", window.document],
    ["HTMLElement", window.HTMLElement],
    ["Element", window.Element],
    ["Node", window.Node],
    ["Event", window.Event],
    ["KeyboardEvent", window.KeyboardEvent],
    ["PointerEvent", window.PointerEvent],
    ["MouseEvent", window.MouseEvent],
    ["DOMRect", window.DOMRect],
    ["getComputedStyle", window.getComputedStyle.bind(window)],
    ["MutationObserver", window.MutationObserver],
    ["IS_REACT_ACT_ENVIRONMENT", true],
    [
      "requestAnimationFrame",
      (callback: FrameRequestCallback) => {
        const id = ++nextFrame
        frames.push({ id, callback })
        return id
      },
    ],
    [
      "cancelAnimationFrame",
      (id: number) => {
        frames = frames.filter((frame) => frame.id !== id)
      },
    ],
  ]
  for (const [name, value] of shared) vi.stubGlobal(name, value)
  window.requestAnimationFrame = globalThis.requestAnimationFrame
  window.cancelAnimationFrame = globalThis.cancelAnimationFrame
  act = (await import("react")).act
  createRoot = (await import("react-dom/client")).createRoot
  NewSlideMenu = (await import("@/editor/new-slide-menu")).NewSlideMenu
})

afterEach(() => {
  act(() => root?.unmount())
  root = null
  frames = []
  window.document.body.replaceChildren()
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

function flushFrames() {
  const pending = frames.splice(0)
  for (const frame of pending) frame.callback(0)
}

const layouts = slideStarts.map((part) => ({ part, name: editorCopy.slideStarts[part] }))
const wide = { w: 1920, h: 1080 }
const pictures = layoutPictures(defaultTheme, wide, undefined, measureWith({}))
let warmed = 0
const source = (held: typeof pictures | null) => ({
  pictures: held,
  size: wide,
  warm: () => {
    warmed += 1
  },
})

async function mount(
  onChoose: (part: (typeof slideStarts)[number]) => void = () => undefined,
  held: typeof pictures | null = pictures,
) {
  warmed = 0
  const host = window.document.createElement("div")
  window.document.body.append(host)
  root = createRoot(host)
  await act(async () => root?.render(<NewSlideMenu layouts={layouts} source={source(held)} onChoose={onChoose} />))
  const trigger = host.querySelector<HTMLButtonElement>("[data-new-slide-layouts]")
  if (trigger === null) throw new Error("missing new slide menu")
  return trigger
}

async function openMenu(onChoose: (part: (typeof slideStarts)[number]) => void = () => undefined): Promise<void> {
  const trigger = await mount(onChoose)
  await act(async () => {
    trigger.dispatchEvent(
      new window.PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType: "mouse" }),
    )
    trigger.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }))
    flushFrames()
  })
}

function press(target: Element, key: string) {
  target.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }))
}

const menuPanel = () => window.document.querySelector<HTMLElement>("[data-layout-menu]")
const items = () => [...window.document.querySelectorAll<HTMLElement>('[role="menuitem"]')]

it("shows a painted picture of each starting slide beside its name", async () => {
  await openMenu()
  const items = [...window.document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
  expect(items.map((item) => item.getAttribute("data-layout"))).toEqual([...slideStarts])
  for (const item of items) {
    const part = item.getAttribute("data-layout")
    const name = item.querySelector(":scope > span:not([data-layout-thumb])")
    expect(name?.textContent, part ?? "").toBe(editorCopy.slideStarts[part as keyof typeof editorCopy.slideStarts])
    const thumb = item.querySelector("[data-layout-thumb]")
    expect(thumb, part ?? "").not.toBeNull()
    expect(thumb?.getAttribute("aria-hidden"), part ?? "").toBe("true")
    expect(thumb?.querySelector("[data-slide-paint]"), part ?? "").not.toBeNull()
  }
})

it("chooses the layout that was clicked", async () => {
  const chosen: string[] = []
  await openMenu((part) => chosen.push(part))
  const grid = window.document.querySelector<HTMLElement>('[data-layout="grid"]')
  if (grid === null) throw new Error("missing grid layout")
  await act(async () => {
    grid.click()
  })
  expect(chosen).toEqual(["grid"])
})

it("opens with Enter or Space on the trigger, hands the keys to the menu while open, and closes cleanly", async () => {
  const trigger = await mount()
  for (const key of ["Enter", " "]) {
    trigger.focus()
    const down = new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
    await act(async () => trigger.dispatchEvent(down))
    expect(down.defaultPrevented, key).toBe(true)
    expect(trigger.getAttribute("aria-expanded"), key).toBe("true")
    expect(menuPanel()?.hasAttribute("data-open"), key).toBe(true)
    expect(window.document.activeElement, key).toBe(items()[0])
    await act(async () => press(window.document.activeElement as Element, "Escape"))
    expect(menuPanel()?.hasAttribute("data-open"), key).toBe(false)
  }
})

it("opens from an assistive technology's click and focuses the first layout", async () => {
  const trigger = await mount()
  expect(trigger.getAttribute("aria-expanded")).toBe("false")
  trigger.focus()
  await act(async () => trigger.click())
  expect(trigger.getAttribute("aria-expanded")).toBe("true")
  expect(window.document.activeElement).toBe(items()[0])
  await act(async () => press(window.document.activeElement as Element, "Escape"))
  expect(trigger.getAttribute("aria-expanded")).toBe("false")
  expect(window.document.activeElement).toBe(trigger)
  await act(async () => press(trigger, "ArrowDown"))
  expect(trigger.getAttribute("aria-expanded")).toBe("true")
  expect(window.document.activeElement).toBe(items()[0])
})

it("opens with ArrowUp on the last layout and walks with the arrows and Home and End", async () => {
  const trigger = await mount()
  await act(async () => press(trigger, "ArrowUp"))
  expect(window.document.activeElement).toBe(items().at(-1))
  await act(async () => press(window.document.activeElement as Element, "ArrowDown"))
  expect(window.document.activeElement).toBe(items()[0])
  await act(async () => press(window.document.activeElement as Element, "ArrowUp"))
  expect(window.document.activeElement).toBe(items().at(-1))
  await act(async () => press(window.document.activeElement as Element, "Home"))
  expect(window.document.activeElement).toBe(items()[0])
  await act(async () => press(window.document.activeElement as Element, "End"))
  expect(window.document.activeElement).toBe(items().at(-1))
})

it("puts focus in the menu when a pointer opens it, and the first arrow lands on the first layout", async () => {
  await openMenu()
  expect(window.document.activeElement).toBe(menuPanel())
  await act(async () => press(menuPanel() as Element, "ArrowDown"))
  expect(window.document.activeElement).toBe(items()[0])
})

it("returns focus to the trigger when a layout is chosen with Enter", async () => {
  const chosen: string[] = []
  const trigger = await mount((part) => chosen.push(part))
  await act(async () => press(trigger, "ArrowDown"))
  await act(async () => items()[1]?.click())
  expect(chosen).toEqual([slideStarts[1]])
  expect(trigger.getAttribute("aria-expanded")).toBe("false")
  expect(window.document.activeElement).toBe(trigger)
})

it("closes on Tab and keeps focus on the trigger so the next Tab walks on", async () => {
  const trigger = await mount()
  await act(async () => press(trigger, "ArrowDown"))
  await act(async () => press(window.document.activeElement as Element, "Tab"))
  expect(trigger.getAttribute("aria-expanded")).toBe("false")
  expect(menuPanel()?.hidden).toBe(true)
  expect(window.document.activeElement).toBe(trigger)
})

it("warms the pictures when the pointer arrives, the trigger takes focus, or the menu opens", async () => {
  const trigger = await mount()
  expect(warmed).toBe(0)
  await act(async () => {
    trigger.dispatchEvent(new window.PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }))
  })
  const entered = warmed
  expect(entered).toBeGreaterThan(0)
  await act(async () => trigger.focus())
  expect(warmed).toBeGreaterThan(entered)
  const focused = warmed
  await act(async () => press(trigger, "ArrowDown"))
  expect(warmed).toBeGreaterThan(focused)
})

it("keeps each row's picture space while the pictures are not ready, so the menu does not jump", async () => {
  const trigger = await mount(undefined, null)
  await act(async () => press(trigger, "ArrowDown"))
  const pending = [...window.document.querySelectorAll<HTMLElement>("[data-layout-thumb-pending]")]
  expect(pending).toHaveLength(slideStarts.length)
  expect(pending.every((thumb) => thumb.style.width === "84px" && thumb.style.height === "47px")).toBe(true)
  expect(window.document.querySelector("[data-slide-paint]")).toBeNull()
  expect(items().map((item) => item.textContent)).toEqual(slideStarts.map((part) => editorCopy.slideStarts[part]))
})
