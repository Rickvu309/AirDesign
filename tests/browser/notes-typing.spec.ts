import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"

const fixture = join(process.cwd(), "scripts/pptx-fixtures/nasa-1d-cnn.pptx")
const typed = " Start with the bill savings."

async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("speaker notes take the cursor when they open, and one Ctrl+Z takes back the whole burst", async ({ page }) => {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(fixture)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await expect(page.getByRole("button", { name: "Expand speaker notes" })).toHaveCount(1)
  await page.getByRole("button", { name: "Expand speaker notes" }).click()
  const field = page.getByRole("textbox", { name: "Speaker notes", exact: true })
  await expect(field).toBeFocused()
  const before = await field.inputValue()
  await page.keyboard.type(typed)
  await expect(field).toHaveValue(`${before}${typed}`)
  await page.keyboard.press("ControlOrMeta+z")
  await expect(field).toHaveValue(before)
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect(field).toHaveValue(`${before}${typed}`)
  await page.reload()
  await settled(page)
  await page.getByRole("button", { name: "Expand speaker notes" }).focus()
  await page.keyboard.press("Enter")
  await expect(field).toBeFocused()
  await expect(field).toHaveValue(`${before}${typed}`)
  expect(await field.evaluate((box: HTMLTextAreaElement) => box.selectionStart === box.value.length)).toBe(true)
})
