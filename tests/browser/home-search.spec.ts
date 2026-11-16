import { expect, test } from "@playwright/test"
import { first, many, now, second, store } from "./home-store.ts"

test.use({ viewport: { width: 1600, height: 1000 } })

const cards = (page: import("@playwright/test").Page) =>
  page.locator("[data-decks-main]").getByRole("heading", { level: 2 })

test("typing in the search box filters the decks by name and keeps the query in the address", async ({ page }) => {
  const { calls } = await store(page)
  await page.goto("/")
  await expect(cards(page)).toHaveText([first.name, second.name])
  const before = calls.length
  await page.getByRole("searchbox", { name: "Search" }).fill("another")
  await expect(cards(page)).toHaveText([second.name])
  await expect(page).toHaveURL(/\/\?q=another$/)
  expect(calls.length).toBe(before)
})

test("a reload keeps the query and its matches", async ({ page }) => {
  await store(page)
  await page.goto("/?q=REAL")
  await expect(page.getByRole("searchbox", { name: "Search" })).toHaveValue("REAL")
  await expect(cards(page)).toHaveText([first.name])
  await page.reload()
  await expect(page.getByRole("searchbox", { name: "Search" })).toHaveValue("REAL")
  await expect(cards(page)).toHaveText([first.name])
})

test("an account with no decks shows No decks yet for a query, never No decks match", async ({ page }) => {
  await store(page, [])
  await page.goto("/?q=quarterly")
  await expect(page.getByRole("heading", { name: "No decks yet" })).toBeVisible()
  await expect(page.getByRole("heading", { name: /No decks match/ })).toHaveCount(0)
})

test("a query with no match names the query and Clear search brings the decks back", async ({ page }) => {
  await store(page)
  await page.goto("/?q=quarterly")
  await expect(page.getByRole("heading", { name: "No decks match “quarterly”" })).toBeVisible()
  await expect(page.getByText("Check the spelling or search for another name.")).toBeVisible()
  await expect(page.getByText("No decks yet")).toHaveCount(0)
  await page.getByRole("button", { name: "Clear search" }).click()
  await expect(page.getByRole("searchbox", { name: "Search" })).toHaveValue("")
  await expect(page).toHaveURL(/\/$/)
  await expect(cards(page)).toHaveText([first.name, second.name])
})

test("Escape in the search box clears it", async ({ page }) => {
  await store(page)
  await page.goto("/")
  const box = page.getByRole("searchbox", { name: "Search" })
  await box.fill("another")
  await box.press("Escape")
  await expect(box).toHaveValue("")
  await expect(page).toHaveURL(/\/$/)
  await expect(cards(page)).toHaveText([first.name, second.name])
})

test("search keeps the list view", async ({ page }) => {
  await store(page)
  await page.goto("/?view=list")
  await page.getByRole("searchbox", { name: "Search" }).fill("another")
  await expect(page).toHaveURL(/\/\?view=list&q=another$/)
  await expect(page.getByRole("link", { name: second.name })).toBeVisible()
  await expect(page.getByRole("link", { name: first.name })).toHaveCount(0)
})

test("search filters Trash by name too", async ({ page }) => {
  await store(
    page,
    [],
    [
      { ...first, trashed: now },
      { ...second, trashed: now },
    ],
  )
  await page.goto("/trash")
  await page.getByRole("searchbox", { name: "Search" }).fill("another")
  await expect(cards(page)).toHaveText([second.name])
  await expect(page).toHaveURL(/\/trash\?q=another$/)
  await page.getByRole("searchbox", { name: "Search" }).fill("nothing")
  await expect(page.getByRole("heading", { name: "No decks match “nothing”" })).toBeVisible()
})

test("Enter in the search box on Settings opens the deck home with that query", async ({ page }) => {
  await store(page)
  await page.route("**/aira/usage", (route) => route.fulfill({ status: 500, body: "failed" }))
  await page.goto("/settings/usage")
  await page.getByRole("searchbox", { name: "Search" }).fill("another")
  await page.getByRole("searchbox", { name: "Search" }).press("Enter")
  await expect(page).toHaveURL(/\/\?q=another$/)
  await expect(cards(page)).toHaveText([second.name])
})

test("searching Recents looks through every deck, not only the six shown", async ({ page }) => {
  await store(page, many)
  await page.goto("/?q=Deck 0")
  await expect(cards(page)).toHaveText(["Deck 0"])
})

test("settled search announces matches and no matches without moving focus", async ({ page }) => {
  await store(page)
  await page.goto("/")
  await expect(cards(page)).toHaveCount(2)
  const box = page.getByRole("searchbox", { name: "Search" })
  const status = page.getByRole("status")
  await box.fill("another")
  await expect(status).toHaveText("1 deck found")
  await expect(box).toBeFocused()
  await box.fill("nothing")
  await expect(status).toHaveText("No decks match “nothing”")
  await expect(box).toBeFocused()
  await box.press("Escape")
  await expect(status).toHaveText("2 decks found")
  await expect(box).toBeFocused()
})

test("moving a deck to Trash after a search announces nothing new", async ({ page }) => {
  await store(page)
  await page.goto("/")
  await expect(cards(page)).toHaveCount(2)
  const status = page.getByRole("status")
  await page.getByRole("searchbox", { name: "Search" }).fill("another")
  await expect(status).toHaveText("1 deck found")
  await page.getByRole("button", { name: `${second.name} actions` }).click()
  await page.getByRole("menuitem", { name: "Move to Trash" }).click()
  await expect(page.getByText(`${second.name} moved to Trash`, { exact: true })).toBeVisible()
  await page.clock.runFor(1000)
  await expect(status).toHaveText("1 deck found")
})

test("starring a deck after a search keeps the star message", async ({ page }) => {
  await store(page)
  await page.goto("/")
  await expect(cards(page)).toHaveCount(2)
  const status = page.getByRole("status")
  await page.getByRole("searchbox", { name: "Search" }).fill("another")
  await expect(status).toHaveText("1 deck found")
  await page.getByRole("button", { name: `Star ${second.name}` }).click()
  await expect(status).toHaveText(`Starred ${second.name}`)
  await page.clock.runFor(1000)
  await expect(status).toHaveText(`Starred ${second.name}`)
})

test("clearing the search announces once and later changes to the deck count announce nothing", async ({ page }) => {
  await store(page)
  await page.goto("/")
  await expect(cards(page)).toHaveCount(2)
  const status = page.getByRole("status")
  const box = page.getByRole("searchbox", { name: "Search" })
  await box.fill("another")
  await expect(status).toHaveText("1 deck found")
  await box.press("Escape")
  await expect(status).toHaveText("2 decks found")
  await page.getByRole("button", { name: `${second.name} actions` }).click()
  await page.getByRole("menuitem", { name: "Move to Trash" }).click()
  await expect(page.getByText(`${second.name} moved to Trash`, { exact: true })).toBeVisible()
  await page.clock.runFor(1000)
  await expect(status).toHaveText("2 decks found")
})
