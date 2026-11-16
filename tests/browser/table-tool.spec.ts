import { expect, test, type Page } from "@playwright/test"
import { newBlankDeck } from "./new-deck"

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

test("Insert table opens a size picker from the keyboard, names the size, and Escape returns focus to its button", async ({
  page,
}) => {
  await openBlank(page)
  await expect(page.getByRole("button", { name: "Actions", exact: true })).toHaveCount(0)
  const tool = page.getByRole("button", { name: "Insert table", exact: true })
  await tool.focus()
  await page.keyboard.press("Enter")
  const sizes = page.getByRole("group", { name: "Table size" })
  await expect(sizes.getByRole("button")).toHaveCount(80)
  await expect(sizes.getByRole("button", { name: "1 row, 1 column", exact: true })).toBeFocused()
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("ArrowRight")
  await expect(sizes.getByRole("button", { name: "2 rows, 2 columns", exact: true })).toBeFocused()
  await expect(page.locator("[data-table-picker]")).toContainText("2 rows, 2 columns")
  await expect(sizes.locator("[data-picked]")).toHaveCount(4)
  const motions = await page.evaluate(() =>
    document.getAnimations().map((animation) => animation.effect?.getComputedTiming().duration ?? 0),
  )
  expect(motions.filter((duration) => duration !== 0)).toEqual([])
  await page.keyboard.press("Escape")
  await expect(sizes).toHaveCount(0)
  await expect(tool).toBeFocused()
})

test("arrows to four rows by three columns and Enter inserts that table through the undoable insert", async ({
  page,
}) => {
  await openBlank(page)
  await page.getByRole("button", { name: "Insert table", exact: true }).focus()
  await page.keyboard.press("Enter")
  for (const key of ["ArrowDown", "ArrowDown", "ArrowDown", "ArrowRight", "ArrowRight"]) await page.keyboard.press(key)
  await expect(page.getByRole("button", { name: "4 rows, 3 columns", exact: true })).toBeFocused()
  await page.keyboard.press("Enter")
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  await expect(table.locator('[role="row"]')).toHaveCount(4)
  await expect(table.locator('[role="row"]').first().locator("[data-table-cell]")).toHaveCount(3)
  await expect(table.locator('[data-table-text="0.0"]')).toBeFocused()
  await expect(page.getByRole("group", { name: "Table size" })).toHaveCount(0)
  await page.getByRole("button", { name: "Undo add table", exact: true }).click()
  await expect(table).toHaveCount(0)
})

test("an arrow key pressed while the picker opens, before it takes focus, still moves the size", async ({ page }) => {
  await openBlank(page)
  await page.getByRole("button", { name: "Insert table", exact: true }).evaluate((tool) => {
    if (!(tool instanceof HTMLElement)) return
    tool.click()
    tool.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }))
  })
  await expect(page.locator("[data-table-picker]")).toContainText("2 rows, 1 column")
  await expect(page.getByRole("button", { name: "2 rows, 1 column", exact: true })).toBeFocused()
})

test("pointing at a size shows it, and a click inserts it", async ({ page }) => {
  await openBlank(page)
  await page.getByRole("button", { name: "Insert table", exact: true }).click()
  const size = page.getByRole("button", { name: "2 rows, 5 columns", exact: true })
  await size.hover()
  await expect(page.locator("[data-table-picker]")).toContainText("2 rows, 5 columns")
  await size.click()
  const rows = page.locator("[data-slide-paint] [data-canvas-table] [role='row']")
  await expect(rows).toHaveCount(2)
  await expect(rows.first().locator("[data-table-cell]")).toHaveCount(5)
})
