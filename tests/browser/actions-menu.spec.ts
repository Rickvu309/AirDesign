import { expect, test, type Page } from "@playwright/test"
import { newBlankDeck } from "./new-deck"

const absent = ["Chart", "Icon", "Remove background", "Boost resolution", "Search actions"]

test.use({ viewport: { width: 1600, height: 1000 }, reducedMotion: "reduce" })

async function openBlank(page: Page): Promise<void> {
  await page.goto("/")
  await newBlankDeck(page)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

test("the Actions menu names Table, opens and closes from the keyboard, and returns focus to its button", async ({
  page,
}) => {
  await openBlank(page)
  const actions = page.getByRole("button", { name: "Actions", exact: true })
  await actions.focus()
  await page.keyboard.press("ArrowDown")
  const menu = page.getByRole("menu")
  await expect(menu).toBeVisible()
  await expect(page.getByRole("menuitem")).toHaveCount(1)
  const table = page.getByRole("menuitem", { name: "Table", exact: true })
  await expect(table).toBeEnabled()
  await expect(menu.getByText("Insert", { exact: true })).toBeVisible()
  for (const name of absent) await expect(menu.getByText(name, { exact: true }), name).toHaveCount(0)
  const motions = await page.evaluate(() =>
    document.getAnimations().map((animation) => animation.effect?.getComputedTiming().duration ?? 0),
  )
  expect(motions.filter((duration) => duration !== 0)).toEqual([])
  await page.keyboard.press("Escape")
  await expect(menu).toHaveCount(0)
  await expect(actions).toBeFocused()
})

test("Enter on Table inserts a table through the same undoable insert", async ({ page }) => {
  await openBlank(page)
  await page.getByRole("button", { name: "Actions", exact: true }).focus()
  await page.keyboard.press("Enter")
  await page.getByRole("menuitem", { name: "Table", exact: true }).focus()
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-slide-paint] [data-canvas-table]")).toHaveCount(1)
  await expect(page.getByRole("button", { name: "Undo add table", exact: true })).toBeEnabled()
})
