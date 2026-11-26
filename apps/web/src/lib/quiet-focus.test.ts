import { expect, it } from "vitest"
import { quietFocusUntilTab } from "./quiet-focus"

it("keeps focus quiet until Tab moves it, and quiet again once the pointer is down", async () => {
  const module = "jsdom"
  const { JSDOM } = (await import(module)) as { JSDOM: new (html: string) => { window: Window & typeof globalThis } }
  const { window } = new JSDOM("")
  const root = window.document.documentElement
  const press = (key: string) =>
    window.document.body.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true }))

  const stop = quietFocusUntilTab(root)
  expect(root.dataset.quietFocus).toBe("")
  press("Enter")
  press("ArrowRight")
  expect(root.dataset.quietFocus).toBe("")
  press("Tab")
  expect(root.dataset.quietFocus).toBeUndefined()
  press("Enter")
  expect(root.dataset.quietFocus).toBeUndefined()
  window.document.body.dispatchEvent(new window.Event("pointerdown", { bubbles: true }))
  expect(root.dataset.quietFocus).toBe("")
  stop()
  expect(root.dataset.quietFocus).toBeUndefined()
})
