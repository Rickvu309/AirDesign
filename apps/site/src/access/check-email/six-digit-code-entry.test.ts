import { afterEach, describe, expect, it, vi } from "vitest"
import { connectSixDigitCodeEntry } from "./six-digit-code-entry"

type JsdomModule = {
  JSDOM: new (html: string) => { readonly window: Window & typeof globalThis }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

async function codeEntryFixture() {
  const jsdomName = "jsdom"
  const { JSDOM } = (await import(jsdomName)) as JsdomModule
  const dom = new JSDOM(`
    <div>
      <div data-six-digit-code>
        <div data-code-box></div>
        <div data-code-box></div>
        <div data-code-box></div>
        <div data-code-box></div>
        <div data-code-box></div>
        <div data-code-box></div>
        <input />
      </div>
      <p id="sign-in-code-error" role="alert" data-code-error>
        <span data-failure hidden>Unable to finish this run</span>
      </p>
    </div>
  `)
  const entry = dom.window.document.querySelector("[data-six-digit-code]")
  const input = entry?.querySelector("input")
  const failure = dom.window.document.querySelector<HTMLElement>("[data-failure]")
  const region = dom.window.document.querySelector("[data-code-error]")
  if (!entry || !input || !failure || !region) throw new Error("fixture")
  return { dom, entry, input, failure, region }
}

describe("connectSixDigitCodeEntry", () => {
  it("tells the person when a code is refused, and clears that when the code changes", async () => {
    const entries = new Map<string, string>()
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => entries.set(key, value),
      removeItem: (key: string) => entries.delete(key),
    })
    const { dom, entry, input, failure, region } = await codeEntryFixture()
    vi.stubGlobal("document", dom.window.document)
    vi.stubGlobal("location", { assign: vi.fn() })
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ ok: false }), { status: 401 }))
    entries.set("airdesign.pending-sign-in-email", "ada@example.com")
    connectSixDigitCodeEntry(entry)

    input.value = "123456"
    input.dispatchEvent(new dom.window.Event("input"))
    await vi.waitFor(() => {
      expect(failure.hasAttribute("hidden")).toBe(false)
    })
    expect(failure.textContent).toBe("Unable to finish this run")
    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(input.getAttribute("aria-describedby")).toBe(region.id)

    input.value = "12345"
    input.dispatchEvent(new dom.window.Event("input"))
    expect(failure.hasAttribute("hidden")).toBe(true)
    expect(input.hasAttribute("aria-invalid")).toBe(false)
    expect(input.hasAttribute("aria-describedby")).toBe(false)
  })
})
