import { expect, test, type Page } from "@playwright/test"
import { openDeck, settled } from "./design-panel"
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
  await expect(texts).toHaveCount(0)
  await holdDevice(page)
  await page.getByRole("button", { name: "Add text", exact: true }).click()
  await page.keyboard.type("Big tx", { delay: 0 })
  await page.keyboard.press("Backspace")
  await expect(texts).toHaveCount(0)
  await openDevice(page)
  await page.keyboard.type("itle", { delay: 0 })
  await expect(texts).toHaveCount(1)
  await expect(texts.last()).toBeFocused()
  await expect(texts.last()).toHaveText("Big title")
  await expect(page.getByRole("button", { name: "Undo text edit" })).toBeEnabled()
  await page.reload()
  await expect(texts.last()).toHaveText("Big title")
})

test("typing after selecting an imported table leaves its cells unchanged", async ({ page }) => {
  await openDeck(page, "table-added.pptx")
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  const before = await table.textContent()
  await table.click()
  await holdDevice(page)
  await page.keyboard.type("Re", { delay: 0 })
  await openDevice(page)
  await page.keyboard.type("gion", { delay: 0 })
  await expect(table).toHaveText(before ?? "")
  await expect(table.locator('[contenteditable="true"]')).toHaveCount(0)
  await page.reload()
  await settled(page)
  await expect(table).toHaveText(before ?? "")
})

test("the first text box waits for its font, then takes focus and the held keys", async ({ page }) => {
  let release = () => {}
  const ready = new Promise<void>((resolve) => {
    release = resolve
  })
  let requested = () => {}
  const loading = new Promise<void>((resolve) => {
    requested = resolve
  })
  await page.route("**/fonts/family?**", async (route) => {
    requested()
    await ready
    await route.fulfill({ status: 404, body: "" })
  })
  await blankDeck(page)
  await page.getByRole("button", { name: "Add text", exact: true }).click()
  await loading
  const texts = page.locator('[data-slide-paint] [contenteditable="true"]')
  await expect(texts).toHaveCount(0)
  await page.keyboard.type("Waited text", { delay: 0 })
  release()
  await expect(texts).toBeFocused()
  await expect(texts).toHaveText("Waited text")
})
