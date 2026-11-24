import { act, StrictMode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest"
import { AiraPanel } from "@/aira/aira-panel"
import { airaCopy } from "@/copy/aira-copy"
import type { UsageLoad } from "@/aira/usage-load"

let host: HTMLDivElement
let root: Root
let close: () => void
const sent: string[] = []

beforeAll(async () => {
  const name = "jsdom"
  const { JSDOM } = (await import(name)) as {
    JSDOM: new (html: string, options: { url: string }) => { window: Window & typeof globalThis }
  }
  const { window } = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/s/abc" })
  close = () => window.close()
  window.matchMedia = () =>
    ({ matches: true, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList
  for (const [key, value] of Object.entries({
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    Node: window.Node,
    IS_REACT_ACT_ENVIRONMENT: true,
  }))
    vi.stubGlobal(key, value)
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (_input, init) => {
      sent.push(String(init?.body ?? ""))
      return new Response("{}", { status: 500 })
    }),
  )
})

afterEach(async () => {
  if (root) await act(async () => root.unmount())
  host?.remove()
  sent.length = 0
})

afterAll(() => {
  close()
  vi.unstubAllGlobals()
})

async function open(
  start: { readonly request?: string; readonly draft?: string; readonly usage?: () => Promise<UsageLoad> },
  strict = false,
  online = true,
) {
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
  const panel = (
    <AiraPanel
      deck="deck-1"
      hidden={false}
      online={online}
      undo={async () => ({ ok: false, reason: "nothing" }) as never}
      store={{
        list: async () => [],
        put: async () => undefined,
        drop: async () => undefined,
        take: () => [],
        shelve: () => undefined,
      }}
      start={start}
    />
  )
  await act(async () => root.render(strict ? <StrictMode>{panel}</StrictMode> : panel))
  await act(async () => new Promise((resolve) => setTimeout(resolve, 20)))
}

it("sends the first request once, as the first message of the chat", async () => {
  await open({ request: "A board update on Q3 revenue" })
  expect(host.textContent).toContain("A board update on Q3 revenue")
  expect(sent.filter((body) => body.includes("A board update on Q3 revenue"))).toHaveLength(1)
})

it("puts the words in the composer when the deck opens offline", async () => {
  const words = "A board update on Q3 revenue"
  await open({ request: words }, false, false)
  expect(host.querySelector("textarea")?.value).toBe(words)
  expect(sent.filter((body) => body.includes(words))).toHaveLength(0)
})

it("puts the words in the composer when the week is used up", async () => {
  const words = "A board update on Q3 revenue"
  await open({
    request: words,
    usage: async () => ({
      kind: "usage",
      email: "person@example.com",
      usage: { used: 2, allowed: 2, resets: "2026-11-30T00:00:00.000Z" },
      available: false,
    }),
  })
  expect(host.querySelector("textarea")?.value).toBe(words)
  expect(sent.filter((body) => body.includes(words))).toHaveLength(0)
})

it("sends the first request once when development mounts the panel twice", async () => {
  await open({ request: "A board update on Q3 revenue" }, true)
  expect(sent.filter((body) => body.includes("A board update on Q3 revenue"))).toHaveLength(1)
})

it("sends nothing when there is no first request", async () => {
  await open({})
  expect(host.querySelector("[data-aira-welcome]")).not.toBeNull()
})

it("sends the original request when the person clicks Try again", async () => {
  const request = "A board update on Q3 revenue"
  await open({ request })
  const retry = [...host.querySelectorAll("button")].find((button) => button.textContent === airaCopy.retry)
  expect(retry).toBeDefined()
  await act(async () => retry?.click())
  expect(sent.filter((body) => body.includes(request))).toHaveLength(2)
})
