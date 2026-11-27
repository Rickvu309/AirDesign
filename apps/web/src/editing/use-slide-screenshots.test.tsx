import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest"
import { quietFor, useSlideScreenshots } from "./use-slide-screenshots"

const world = vi.hoisted(() => ({ reported: 0 }))

vi.mock("./slide-screenshot-report", () => ({
  reportSlideScreenshots: async () => {
    world.reported += 1
    return true
  },
  unresolvedAssets: () => [],
}))

vi.mock("./slide-capture", () => ({ captureSlide: async () => null }))

let root: Root | null = null

beforeAll(async () => {
  const jsdomName = "jsdom"
  const jsdom = (await import(jsdomName)) as {
    JSDOM: new (html: string, options?: { url?: string }) => { readonly window: Window & typeof globalThis }
  }
  const window = new jsdom.JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" }).window
  vi.stubGlobal("window", window)
  vi.stubGlobal("document", window.document)
  vi.stubGlobal("HTMLElement", window.HTMLElement)
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
})

beforeEach(() => {
  vi.useFakeTimers()
  world.reported = 0
})

afterEach(async () => {
  await act(async () => {
    root?.unmount()
  })
  root = null
  vi.useRealTimers()
})

function fakeClient() {
  const listeners = new Set<() => void>()
  const state = { wanted: false }
  const fold = {}
  return {
    state,
    notify: () => {
      for (const listener of listeners) listener()
    },
    client: {
      server: () => fold,
      pending: () => [],
      reportScreenshots: async () => ({ ok: true as const, missing: [] }),
      screenshotsWanted: () => state.wanted,
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    },
  }
}

async function mount(client: ReturnType<typeof fakeClient>["client"]): Promise<void> {
  function Host() {
    useSlideScreenshots(client as never, () => undefined)
    return null
  }
  root = createRoot(document.createElement("div"))
  await act(async () => {
    root?.render(createElement(Host))
  })
}

const pass = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

it("paints and reports no slide screenshot while no agent has asked for one", async () => {
  const held = fakeClient()
  await mount(held.client)
  await pass(quietFor * 10)
  held.notify()
  await pass(quietFor * 10)
  expect(world.reported).toBe(0)
})

it("reports at once when an agent asks, again a quiet moment after each change while it stays interested, and stops when the window ends", async () => {
  const held = fakeClient()
  await mount(held.client)
  held.state.wanted = true
  held.notify()
  await pass(0)
  expect(world.reported).toBe(1)
  held.notify()
  await pass(quietFor - 1)
  expect(world.reported).toBe(1)
  await pass(1)
  expect(world.reported).toBe(2)
  held.state.wanted = false
  held.notify()
  await pass(quietFor * 10)
  expect(world.reported).toBe(2)
})
