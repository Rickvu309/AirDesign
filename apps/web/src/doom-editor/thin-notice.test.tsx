import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeAll, expect, it, vi } from "vitest"
import { productCopy } from "../copy/product-copy"
import { ThinNoticeView, type ThinNotice } from "./thin-notice"

type JsdomModule = {
  JSDOM: new (html: string, options?: { url?: string }) => { readonly window: Window & typeof globalThis }
}

let jsdom: JsdomModule | undefined

beforeAll(async () => {
  const jsdomName = "jsdom"
  jsdom = (await import(jsdomName)) as JsdomModule
})

const teardowns: (() => Promise<void> | void)[] = []

afterEach(async () => {
  for (const teardown of teardowns.splice(0).reverse()) await teardown()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function openPage(): { readonly window: Window & typeof globalThis; readonly root: Root } {
  if (jsdom === undefined) throw new Error("jsdom")
  const { window } = new jsdom.JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "http://localhost/",
  })
  vi.useFakeTimers()
  const defined: [string, unknown][] = [
    ["window", window],
    ["document", window.document],
    ["navigator", window.navigator],
    ["HTMLElement", window.HTMLElement],
    ["Element", window.Element],
    ["Node", window.Node],
    ["IS_REACT_ACT_ENVIRONMENT", true],
    ["requestAnimationFrame", (step: () => void) => setTimeout(step, 0)],
    ["cancelAnimationFrame", (handle: number) => clearTimeout(handle)],
  ]
  Object.defineProperty(window, "matchMedia", {
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  })
  for (const [name, value] of defined) vi.stubGlobal(name, value)
  const container = window.document.getElementById("root")
  if (container === null) throw new Error("root")
  const root = createRoot(container)
  teardowns.push(async () => {
    await act(async () => {
      root.unmount()
    })
    await vi.runOnlyPendingTimersAsync()
    window.close()
  })
  return { window, root }
}

async function show(root: Root, notice: ThinNotice | null, wait: number): Promise<void> {
  await act(async () => {
    root.render(<ThinNoticeView notice={notice} onTryAgain={() => undefined} />)
  })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(wait)
  })
}

function shownText(window: Window & typeof globalThis): string[] {
  return [...window.document.querySelectorAll("[data-sonner-toast]")]
    .filter((toast) => toast.getAttribute("data-removed") !== "true")
    .map((toast) => toast.textContent ?? "")
}

it("the offline notice shows again when it comes back while its last showing is still leaving", async () => {
  const { window, root } = openPage()
  await show(root, null, 0)
  await show(root, "offline", 100)
  expect(shownText(window)).toEqual([productCopy.editorOffline])
  await show(root, null, 50)
  expect(shownText(window)).toEqual([])
  await show(root, "offline", 600)
  expect(shownText(window)).toEqual([productCopy.editorOffline])
})

it("a notice that changes while it shows replaces its text in the same place", async () => {
  const { window, root } = openPage()
  await show(root, null, 0)
  await show(root, "offline", 100)
  await show(root, "unreached", 300)
  expect(shownText(window)).toEqual([productCopy.editorUnreached])
  expect(window.document.querySelectorAll("[data-sonner-toast]")).toHaveLength(1)
})

it("a recovery notice shown again before dismissal reaches Sonner has active controls", async () => {
  const { window, root } = openPage()
  await show(root, "storage-failed", 100)
  const leaving = window.document.querySelector<HTMLElement>("[data-sonner-toast]")
  expect(leaving).not.toBeNull()
  await act(async () => root.render(<ThinNoticeView notice={null} onTryAgain={() => undefined} />))
  expect(leaving?.inert).toBe(true)
  await show(root, "storage-failed", 1)
  const active = [...window.document.querySelectorAll<HTMLElement>("[data-sonner-toast]")].find(
    (toast) => toast !== leaving,
  )
  expect(active).toBeDefined()
  expect(active?.inert === true).toBe(false)
  expect(active?.getAttribute("aria-hidden")).toBeNull()
})
