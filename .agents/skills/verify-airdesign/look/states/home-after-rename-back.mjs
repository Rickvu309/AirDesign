import { expect } from "@playwright/test"
import { newDoomDeck } from "../../bin/new-deck.mjs"

async function slowRename(page, doomRoutes) {
  const onDeck = () => new URL(page.url()).pathname.startsWith("/s/")
  await page.route(
    (url) => url.pathname === doomRoutes.edit.path,
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 300))
      await (onDeck() ? route.fallback() : route.abort()).catch(() => undefined)
    },
  )
}

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.goto("/")
  await newDoomDeck(page)
  await slowRename(page, kit.doomRoutes)
  await page.getByRole("button", { name: "Rename deck: Blank deck" }).click()
  const field = page.getByRole("textbox", { name: "Deck name" })
  await field.fill("Board pack")
  await field.press("Enter")
  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("main").locator("article").first()).toBeVisible()
  await page.waitForTimeout(1000)
}

export default { name: "home-after-rename-back", design: "/screens/s31-02-decks-browse-recents-grid", drive }
