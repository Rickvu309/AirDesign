import { expect, type Page } from "@playwright/test"
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

test("keys typed at once after placing text land in it, while the device holds its writes and after", async ({
  page,
}) => {
  await blankDeck(page)
  const texts = page.locator('[data-slide-paint] [contenteditable="true"]')
  await expect(texts).toHaveCount(0)
  await holdDevice(page)
  await placeText(page)
  await page.keyboard.type("Big tx", { delay: 0 })
  await page.keyboard.press("Backspace")
  await expect(texts).toHaveCount(1)
  await expect(texts.last()).toHaveText("Big t")
  await openDevice(page)
  await page.keyboard.type("itle", { delay: 0 })
  await expect(texts).toHaveCount(1)
  await expect(texts.last()).toBeFocused()
  await expect(texts.last()).toHaveText("Big title")
  await expect(page.getByRole("button", { name: "Undo text edit" })).toBeEnabled()
  await page.reload()
  await expect(texts.last()).toHaveText("Big title")
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
