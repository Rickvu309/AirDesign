import { expect, type Page } from "@playwright/test"
import { tableCopy } from "../../apps/web/src/copy/table-copy"
import { holdDevice, holdableDevice, openDevice } from "./slow-device"
import { decksOn, test } from "./deck-test"
import { placeText } from "./text-place"

test.use({ viewport: { width: 1600, height: 1000 } })

test.beforeEach(async ({ page }) => {
  await holdableDevice(page)
})

async function blankDeck(page: Page): Promise<void> {
  await decksOn(page).blank()
}

test("keys typed at once after Add text box land in the new box, before and after it paints", async ({ page }) => {
  await blankDeck(page)
  const texts = page.locator('[data-slide-paint] [contenteditable="true"]')
  await expect(texts).toHaveCount(0)
  await holdDevice(page)
  await placeText(page)
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

test("keys typed at once after adding a table land in its first cell", async ({ page }) => {
  await blankDeck(page)
  const cell = page.locator('[data-slide-paint] [data-canvas-table] [data-table-text="0.0"]')
  await page.getByRole("button", { name: tableCopy.tool, exact: true }).click()
  await holdDevice(page)
  await page.getByRole("button", { name: tableCopy.sizeOf(3, 3), exact: true }).click()
  await page.keyboard.type("Re", { delay: 0 })
  await expect(cell).toHaveCount(0)
  await openDevice(page)
  await page.keyboard.type("gion", { delay: 0 })
  await expect(cell).toBeFocused()
  await expect(cell).toHaveText("Region")
  await expect(page.locator("[data-table-picker]")).toHaveCount(0)
})

test("the first text box takes focus while its font is still arriving, and the keys land in it", async ({ page }) => {
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
  await placeText(page)
  await loading
  const texts = page.locator('[data-slide-paint] [contenteditable="true"]')
  await expect(texts).toHaveCount(1)
  await expect(texts).toBeFocused()
  await expect(page.locator("[data-slide-paint] [data-fonts-pending]")).toBeAttached()
  await page.keyboard.type("Waited text", { delay: 0 })
  await expect(texts).toHaveText("Waited text")
  release()
  await expect(page.locator("[data-slide-paint] [data-fonts-pending]")).toHaveCount(0)
  await expect(texts).toBeFocused()
  await expect(texts).toHaveText("Waited text")
})
