import { afterEach, expect, it, vi } from "vitest"
import { appUrl } from "./app-url"

afterEach(() => {
  vi.unstubAllGlobals()
})

it("points the view's links at the app's origin inside a chat, not at the chat's address", () => {
  vi.stubGlobal("location", { origin: "https://sandbox.example" })
  vi.stubGlobal("document", { documentElement: { dataset: { origin: "https://studio.example" } } })
  expect(appUrl("/s/d1")).toBe("https://studio.example/s/d1")
  expect(appUrl("/")).toBe("https://studio.example/")
})

it("points them at the page's own origin in a browser tab", () => {
  vi.stubGlobal("location", { origin: "https://studio.example" })
  vi.stubGlobal("document", { documentElement: { dataset: {} } })
  expect(appUrl("/s/d1")).toBe("https://studio.example/s/d1")
})
