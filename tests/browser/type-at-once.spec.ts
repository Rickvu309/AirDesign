import { expect, test, type Page } from "@playwright/test"
import { newBlankDeck } from "./new-deck"
import { holdDevice, holdableDevice, openDevice } from "./slow-device"

test.use({ viewport: { width: 1600, height: 1000 } })

test.beforeEach(async ({ page }) => {
  await holdableDevice(page)
})

async function blankDeck(page: Page): Promise<void> {
  await page.goto("/")
  await newBlankDeck(page)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

test("keys typed at once after Add text box land in the new box, before and after it paints", async ({ page }) => {
  await blankDeck(page)
  const texts = page.locator('[data-slide-paint] [contenteditable="true"]')
  await expect(texts).toHaveCount(2)
  await holdDevice(page)
  await page.getByRole("button", { name: "Add text box", exact: true }).click()
  await page.keyboard.type("Big tx", { delay: 0 })
  await page.keyboard.press("Backspace")
  await expect(texts).toHaveCount(2)
  await openDevice(page)
  await page.keyboard.type("itle", { delay: 0 })
  await expect(texts).toHaveCount(3)
  await expect(texts.last()).toBeFocused()
  await expect(texts.last()).toHaveText("Big title")
  await expect(page.getByRole("button", { name: "Undo text edit" })).toBeEnabled()
  await page.reload()
  await expect(texts.last()).toHaveText("Big title")
})

test("keys typed at once after adding a table land in its first cell", async ({ page }) => {
  await blankDeck(page)
  const cell = page.locator('[data-slide-paint] [data-canvas-table] [data-table-text="0.0"]')
  await page.getByRole("button", { name: "Actions", exact: true }).click()
  await holdDevice(page)
  await page.getByRole("menuitem", { name: "Table", exact: true }).click()
  await page.keyboard.type("Re", { delay: 0 })
  await expect(cell).toHaveCount(0)
  await openDevice(page)
  await page.keyboard.type("gion", { delay: 0 })
  await expect(cell).toBeFocused()
  await expect(cell).toHaveText("Region")
  await expect(page.getByRole("menuitem", { name: "Table", exact: true })).toHaveCount(0)
})
