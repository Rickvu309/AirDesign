import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, expect, it, vi } from "vitest"

const live = vi.hoisted(() => ({ distrusted: 0 }))

vi.mock("@airdesign/live", async (original) => ({
  ...(await original<object>()),
  distrustDevice: async () => {
    live.distrusted += 1
  },
}))

import { Home } from "./home"

type JsdomModule = {
  JSDOM: new (html: string, options?: { url?: string }) => { readonly window: Window & typeof globalThis }
}

afterEach(() => {
  vi.unstubAllGlobals()
  live.distrusted = 0
})

async function page(sent: string[]): Promise<HTMLElement> {
  const jsdomName = "jsdom"
  const jsdom = (await import(jsdomName)) as JsdomModule
  const { window } = new jsdom.JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "http://localhost/",
  })
  window.matchMedia = () =>
    ({ matches: false, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList
  const location = { pathname: "/", search: "", assign: (address: string) => sent.push(address) }
  const seen = new Proxy(window, {
    get: (target, name) => {
      if (name === "location") return location
      const value: unknown = Reflect.get(target, name)
      return typeof value === "function" ? value.bind(target) : value
    },
  })
  for (const [name, value] of Object.entries({
    window: seen,
    document: window.document,
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    Node: window.Node,
    Event: window.Event,
    IS_REACT_ACT_ENVIRONMENT: true,
  }))
    vi.stubGlobal(name, value)
  const host = window.document.getElementById("root")
  if (host === null) throw new Error("root")
  return host
}

it.fails("withdraws this device's trust in every deck when the deck list finds the session ended", async () => {
  const sent: string[] = []
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ ok: false, refusal: "session" }), { status: 401 }))
  const root = createRoot(await page(sent))
  await act(async () => {
    root.render(<Home navigate={() => {}} />)
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))
  })
  await act(async () => {
    root.unmount()
    await new Promise((resolve) => setTimeout(resolve, 20))
  })
  expect(sent.length).toBeGreaterThan(0)
  expect(live.distrusted).toBeGreaterThan(0)
})
