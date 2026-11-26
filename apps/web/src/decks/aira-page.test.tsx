import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest"
import { productCopy } from "@/copy/product-copy"
import { storyIdeas } from "@/copy/story-ideas-copy"
import { AiraPage } from "@/decks/aira-page"
import {
  clearFirstRequest,
  clearOpeningDeck,
  handFirstRequest,
  noteOpeningDeck,
  peekFirstRequest,
} from "@/lib/first-request"

const listing = {
  ok: true,
  account: { email: "person@example.com" },
  decks: [{ deck: "kept", name: "Board update", starred: true }],
  trash: [],
}

let host: HTMLDivElement
let root: Root
let close: () => void
const opened: string[] = []
const asked: string[] = []

beforeAll(async () => {
  const name = "jsdom"
  const { JSDOM } = (await import(name)) as {
    JSDOM: new (html: string, options: { url: string }) => { window: Window & typeof globalThis }
  }
  const { window } = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/aira" })
  close = () => window.close()
  for (const [key, value] of Object.entries({
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    HTMLTextAreaElement: window.HTMLTextAreaElement,
    Element: window.Element,
    Node: window.Node,
    Event: window.Event,
    KeyboardEvent: window.KeyboardEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
  }))
    vi.stubGlobal(key, value)
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (path) => {
      asked.push(String(path))
      return Response.json(String(path).endsWith("/delete") ? { ok: true, deleted: ["half-open"] } : listing)
    }),
  )
})

afterEach(async () => {
  clearFirstRequest()
  clearOpeningDeck()
  if (root) await act(async () => root.unmount())
  host?.remove()
  opened.length = 0
  asked.length = 0
})

afterAll(() => {
  close()
  vi.unstubAllGlobals()
})

async function show() {
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
  await act(async () => root.render(<AiraPage navigate={(path) => opened.push(path)} />))
  const field = host.querySelector<HTMLTextAreaElement>(`textarea[aria-label="${productCopy.describeDeck}"]`)
  if (field === null) throw new Error("no describe box")
  return field
}

it("asks what story to tell, on the Aira page of the person's own account", async () => {
  await show()
  expect(host.querySelector("h1")?.textContent).toBe(productCopy.storyHeadline)
  expect(host.querySelector('a[aria-current="page"]')?.textContent).toBe(productCopy.agentName)
  expect(host.querySelector("[data-account-name]")?.getAttribute("title")).toBe("person@example.com")
  expect(host.textContent).toContain("Board update")
})

it("hands an idea's words to the editor and opens a new deck on Enter", async () => {
  const field = await show()
  await act(async () => host.querySelector<HTMLButtonElement>("[data-story-idea]")?.click())
  await act(async () => {
    field.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))
  })
  expect(peekFirstRequest()).toBe(storyIdeas[0].words)
  expect(opened).toEqual(["/s"])
})

it("offers the words again, and drops the half-opened deck, when the editor was left before it opened", async () => {
  handFirstRequest("A board update on Q3 revenue, numbers first")
  noteOpeningDeck("half-open")
  const field = await show()
  expect(field.value).toBe("A board update on Q3 revenue, numbers first")
  expect(asked.filter((path) => path.endsWith("/trash") || path.endsWith("/delete"))).toHaveLength(2)
})
