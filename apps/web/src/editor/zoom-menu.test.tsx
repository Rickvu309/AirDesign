import type { Root } from "react-dom/client"
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest"

let act: typeof import("react").act
let ZoomMenu: typeof import("@/editor/zoom-menu").ZoomMenu

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
    ["InputEvent", window.InputEvent],
    ["DOMRect", window.DOMRect],
    ["getComputedStyle", window.getComputedStyle.bind(window)],
    ["MutationObserver", window.MutationObserver],
    ["IS_REACT_ACT_ENVIRONMENT", true],
    [
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    ],
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
  ZoomMenu = (await import("@/editor/zoom-menu")).ZoomMenu
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

async function opened() {
  const canvas = window.document.createElement("div")
  canvas.tabIndex = -1
  const button = window.document.createElement("button")
  button.type = "button"
  canvas.append(button)
  window.document.body.append(canvas)
  const host = window.document.createElement("div")
  window.document.body.append(host)
  root = createRoot(host)
  await act(async () =>
    root?.render(<ZoomMenu zoom={100} percent={100} onZoom={() => undefined} canvas={{ current: canvas }} />),
  )
  const trigger = host.querySelector<HTMLButtonElement>("[data-zoom-readout]")
  if (trigger === null) throw new Error("missing zoom readout")
  await act(async () => {
    trigger.dispatchEvent(
      new window.PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType: "mouse" }),
    )
    trigger.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }))
    flushFrames()
  })
  const field = window.document.querySelector<HTMLInputElement>("[data-zoom-field]")
  if (field === null) throw new Error("missing zoom field")
  return { canvas, button, field }
}

function holdLateCanvasFocus() {
  const queued: Array<() => void> = []
  const real = globalThis.queueMicrotask.bind(globalThis)
  const wrapped = (fn: () => void) => {
    if (Function.prototype.toString.call(fn).includes("focusVisible: false")) queued.push(fn)
    else real(fn)
  }
  vi.stubGlobal("queueMicrotask", wrapped)
  return {
    queued,
    release() {
      for (const fn of queued.splice(0)) fn()
    },
    restore() {
      vi.stubGlobal("queueMicrotask", real)
    },
  }
}

it("returns focus to the grid after a typed zoom when the keyboard has not moved on", async () => {
  const { canvas, field } = await opened()
  await act(async () => {
    field.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))
    flushFrames()
  })
  expect(window.document.activeElement).toBe(canvas)
})

it("keeps a grid control focused when typed zoom restores after the keyboard has moved", async () => {
  const { button, field } = await opened()
  const late = holdLateCanvasFocus()
  try {
    await act(async () => {
      field.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))
      flushFrames()
    })
    expect(late.queued).toHaveLength(1)
    button.focus()
    expect(window.document.activeElement).toBe(button)
    await act(async () => late.release())
    expect(window.document.activeElement).toBe(button)
  } finally {
    late.restore()
  }
})

it.each([
  ["Chrome and Firefox", { isComposing: true }],
  ["Safari", { keyCode: 229 }],
])("keeps Escape from the menu while an IME composes in the zoom field in %s", async (_browser, init) => {
  const { field } = await opened()
  const reached = vi.fn()
  window.document.addEventListener("keydown", reached)
  try {
    await act(async () => {
      field.dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true, ...init }),
      )
    })
    expect(reached).not.toHaveBeenCalled()
  } finally {
    window.document.removeEventListener("keydown", reached)
  }
})
