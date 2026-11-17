import { expect } from "@playwright/test"
import path from "node:path"
import { openDeck } from "../open-deck.mjs"
import { editor } from "../editor-screen.mjs"

async function network(page, online) {
  await page.evaluate((online) => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: online })
    window.dispatchEvent(new Event(online ? "online" : "offline"))
  }, online)
}

async function drive(kit) {
  const { page, deckRoutes } = kit
  const { cookie } = await kit.signIn()
  await page.goto("/")
  await openDeck(page, path.join(kit.repo, "scripts/pptx-fixtures/clean.pptx"))
  const deck = new URL(page.url()).pathname.split("/").at(-1)
  const revision = async () => (await kit.post(deckRoutes.open, { deck }, cookie)).json.revision
  const before = await revision()
  let down = true
  let held = 0
  let release
  const released = new Promise((resolve) => (release = resolve))
  await page.route(
    (url) => url.pathname === deckRoutes.commit.path,
    async (route) => {
      if (down) return route.abort("connectionfailed")
      held += 1
      await released
      await route.fallback()
    },
  )
  const status = page.locator("[data-save-status]")
  const text = page.locator('[contenteditable="true"]')
  await text.click()
  await text.press("End")
  await text.press("!")
  await expect(status).toHaveText("Unable to reach AirDesign")
  down = false
  await expect.poll(() => held, { timeout: 15_000 }).toBe(1)
  await network(page, false)
  await expect(status).toHaveText("Offline, saved on this device")
  await network(page, true)
  await expect(status).toHaveText("Unable to reach AirDesign")
  release()
  await expect.poll(revision).toBe(before + 1)
  await page.waitForTimeout(1000)
  await expect(status).toHaveText(/^(Saved|Saving…)$/)
}

export default { name: "editor-reconnected", design: editor, drive }
