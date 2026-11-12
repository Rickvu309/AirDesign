import { afterEach, expect, it, vi } from "vitest"

const live = vi.hoisted(() => ({ distrusted: 0 }))

vi.mock("@airdesign/live", () => ({
  distrustDevice: async () => {
    live.distrusted += 1
  },
  dropChats: async () => {},
  deleteDatabase: async () => {},
}))

import { signOut } from "./settings-page"

afterEach(() => {
  vi.unstubAllGlobals()
  live.distrusted = 0
})

it.fails("withdraws this device's trust in every deck when a person signs out from Settings", async () => {
  vi.stubGlobal("fetch", async () => new Response("{}", { status: 200 }))
  const location = { pathname: "/settings/account", search: "", assign: () => {} }
  vi.stubGlobal("window", { location })
  await signOut()
  expect(live.distrusted).toBe(1)
})
