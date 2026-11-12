import { afterEach, describe, expect, it, vi } from "vitest"
import { signInCopy } from "../sign-in-copy"
import { connectSendAgain } from "./send-again"

type JsdomModule = {
  JSDOM: new (html: string) => { readonly window: Window & typeof globalThis }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

async function sendAgainFixture(status: number) {
  const jsdomName = "jsdom"
  const { JSDOM } = (await import(jsdomName)) as JsdomModule
  const dom = new JSDOM(`<button data-send-again>${signInCopy.sendAgain}</button><p role="status"></p>`)
  const button = dom.window.document.querySelector("button")
  const region = dom.window.document.querySelector<HTMLElement>("[role=status]")
  if (!button || !region) throw new Error("fixture")
  const entries = new Map([["airdesign.pending-sign-in-email", "ada@example.com"]])
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
    removeItem: (key: string) => entries.delete(key),
  })
  const sent: unknown[] = []
  vi.stubGlobal("fetch", async (_path: string, init: RequestInit) => {
    sent.push(JSON.parse(String(init.body)))
    return new Response(JSON.stringify({ ok: status < 300 }), { status })
  })
  connectSendAgain(button, region)
  return { dom, button, region, sent }
}

describe("connectSendAgain", () => {
  it("sends the sign-in email again to the pending address and says so", async () => {
    const { dom, button, region, sent } = await sendAgainFixture(202)
    button.dispatchEvent(new dom.window.Event("click"))
    await vi.waitFor(() => expect(region.textContent).toBe(signInCopy.sentAgain))
    expect(sent).toEqual([{ email: "ada@example.com" }])
    expect(region.hasAttribute("data-failed")).toBe(false)
    expect(button.disabled).toBe(false)
  })

  it("says the email was not sent and how to recover when the request fails", async () => {
    const { dom, button, region } = await sendAgainFixture(500)
    button.dispatchEvent(new dom.window.Event("click"))
    await vi.waitFor(() => expect(region.textContent).toBe(signInCopy.emailFailed))
    expect(region.hasAttribute("data-failed")).toBe(true)
  })
})
