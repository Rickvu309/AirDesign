import { expect, test } from "@playwright/test"
import { first, store, type Deck } from "./home-store.ts"

test.use({ viewport: { width: 1600, height: 1000 } })

const many: Deck[] = Array.from({ length: 8 }, (_, index) => ({
  ...first,
  deck: `deck-${index}`,
  name: `Deck ${index}`,
  edited: new Date(Date.UTC(2026, 10, 1 + index, 9)).toISOString(),
}))

const cards = (page: import("@playwright/test").Page) =>
  page.locator("[data-decks-main]").getByRole("heading", { level: 2 })

test("Recents shows the six most recently edited decks, newest first", async ({ page }) => {
  await store(page, many)
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Recents", level: 1 })).toBeVisible()
  await expect(cards(page)).toHaveText(["Deck 7", "Deck 6", "Deck 5", "Deck 4", "Deck 3", "Deck 2"])
})

test("All decks has its own address and shows every deck, newest first", async ({ page }) => {
  await store(page, many)
  await page.goto("/")
  const nav = page.getByRole("navigation", { name: "Decks" })
  await expect(nav.getByRole("link", { name: "Recents" })).toHaveAttribute("aria-current", "page")
  await expect(nav.getByRole("link", { name: "All decks" })).not.toHaveAttribute("aria-current", "page")
  await nav.getByRole("link", { name: "All decks" }).click()
  await expect(page).toHaveURL(/\/all$/)
  await expect(page.getByRole("heading", { name: "All decks", level: 1 })).toBeVisible()
  await expect(nav.getByRole("link", { name: "All decks" })).toHaveAttribute("aria-current", "page")
  await expect(nav.getByRole("link", { name: "Recents" })).not.toHaveAttribute("aria-current", "page")
  await expect(cards(page)).toHaveText(many.map((deck) => deck.name).reverse())
  await page.reload()
  await expect(page.getByRole("heading", { name: "All decks", level: 1 })).toBeVisible()
  await expect(cards(page)).toHaveCount(8)
})

test("the layout switch stays on the section it was clicked in", async ({ page }) => {
  await store(page, many)
  await page.goto("/all")
  await page.getByRole("group", { name: "Layout" }).getByRole("link").nth(1).click()
  await expect(page).toHaveURL(/\/all\?view=list$/)
  await expect(page.getByRole("heading", { name: "All decks", level: 1 })).toBeVisible()
})

test("All decks with no decks shows the empty state", async ({ page }) => {
  await store(page, [])
  await page.goto("/all")
  await expect(page.getByRole("heading", { name: "No decks yet" })).toBeVisible()
})
