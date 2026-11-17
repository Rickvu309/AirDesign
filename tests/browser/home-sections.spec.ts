import { expect, test } from "@playwright/test"
import { many, store } from "./home-store.ts"

test.use({ viewport: { width: 1600, height: 1000 } })

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

test("the loaded list header stays in the loading header's position", async ({ page }) => {
  let release = () => {}
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  await store(page, many)
  await page.route("**/decks/list", async (route) => {
    await pending
    await route.fallback()
  })
  await page.goto("/?view=list")
  const header = page.getByText("Name", { exact: true })
  await expect(header).toBeVisible()
  const before = await header.boundingBox()
  release()
  await expect(cards(page)).toHaveCount(6)
  const after = await header.boundingBox()
  expect(after?.y).toBe(before?.y)
})

test("All decks uses the compact design while Recents keeps its previews", async ({ page }) => {
  await store(page, many)
  for (const [address, gap, height] of [
    ["/all", 24, 180],
    ["/", 32, 200],
  ] as const) {
    await page.goto(address)
    await expect(cards(page)).toHaveCount(address === "/all" ? 8 : 6)
    const geometry = await page
      .locator("[data-decks-main] article")
      .first()
      .evaluate((card) => {
        const grid = card.parentElement
        const header = document.querySelector("[data-decks-header]")
        return {
          gap: grid && header ? grid.getBoundingClientRect().top - header.getBoundingClientRect().bottom : null,
          height: card.lastElementChild?.getBoundingClientRect().height,
        }
      })
    expect(geometry).toEqual({ gap, height })
  }
})

test("list mode keeps the importing card visible", async ({ page }) => {
  await store(page)
  await page.goto("/?view=list")
  await expect(cards(page)).toHaveCount(2)
  await page.evaluate(() => {
    File.prototype.arrayBuffer = () => new Promise(() => {})
  })
  await page.locator("input[type=file]").setInputFiles({
    name: "Report.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: Buffer.from("held"),
  })
  await expect(page.getByText("Importing", { exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Report.pptx" })).toBeVisible()
  await expect(page.getByText("Name", { exact: true })).toBeVisible()
})
