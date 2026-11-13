import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"

async function slowRename(page, deckRoutes) {
  const onDeck = () => new URL(page.url()).pathname.startsWith("/deck/")
  let loads = 0
  let deckLoad = onDeck() ? loads : -1
  page.on("domcontentloaded", () => loads++)
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame() && onDeck()) deckLoad = loads
  })
  await page.route(
    (url) => url.pathname === deckRoutes.rename.path,
    async (route) => {
      const fromDeck = loads === deckLoad
      await new Promise((resolve) => setTimeout(resolve, 300))
      const left = loads !== deckLoad || !onDeck()
      await (fromDeck && left ? route.abort() : route.fallback()).catch(() => undefined)
    },
  )
}

async function backHome(page) {
  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("main").locator("article").first()).toBeVisible()
  await page.waitForTimeout(1000)
}

async function drive(kit) {
  await fixtureDeck(kit)
  await slowRename(kit.page, kit.deckRoutes)
  await kit.page.getByRole("button", { name: "Rename deck: clean" }).click()
  const field = kit.page.getByRole("textbox", { name: "Deck name" })
  await field.fill("Board pack")
  await field.press("Enter")
  await backHome(kit.page)
}

export default { name: "home-after-rename-back", design: "/screens/s31-02-decks-browse-recents-grid", drive }
