import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"

const clean = join(process.cwd(), "scripts/pptx-fixtures/clean.pptx")

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

async function open(page: Page): Promise<void> {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(clean)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
  await expect(page.locator("[data-slide-entry='1'] [data-thumb-paint]")).toContainText("Hello")
}

function entry(page: Page, number: number) {
  return page.locator(`[data-slide-entry="${String(number)}"]`)
}

function actions(page: Page, number: number) {
  return page.getByRole("button", { name: `Slide ${String(number)} actions` })
}

function item(page: Page, name: RegExp) {
  return page.getByRole("menuitem", { name })
}

test("one slide can be duplicated from its menu, and move and delete are unavailable", async ({ page }) => {
  await open(page)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
  await expect(actions(page, 1)).toBeVisible()
  const row = await entry(page, 1).boundingBox()
  const control = await actions(page, 1).boundingBox()
  expect(row).not.toBeNull()
  expect(control).not.toBeNull()
  if (row !== null && control !== null) {
    expect(control.x).toBeGreaterThan(row.x)
    expect(control.x + control.width).toBeLessThanOrEqual(row.x + row.width + 1)
    expect(control.y).toBeGreaterThanOrEqual(row.y - 1)
    expect(control.y + control.height).toBeLessThanOrEqual(row.y + row.height + 1)
  }
  await actions(page, 1).click()
  await expect(item(page, /Duplicate/)).toContainText("Ctrl+D")
  await expect(item(page, /Duplicate/)).toHaveAttribute("aria-keyshortcuts", "Control+D Meta+D")
  await expect(item(page, /Delete/)).toContainText("Delete")
  await expect(item(page, /Delete/)).toBeDisabled()
  await expect(item(page, /Move up/)).toContainText("Alt+Up")
  await expect(item(page, /Move up/)).toBeDisabled()
  await expect(item(page, /Move down/)).toContainText("Alt+Down")
  await expect(item(page, /Move down/)).toBeDisabled()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("menu")).toHaveCount(0)
  await expect(entry(page, 1)).toBeFocused()
})

test("the menu duplicates, moves and deletes, and undo brings the deleted slide back", async ({ page }) => {
  await open(page)
  await page.getByRole("button", { name: "Add slide" }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await actions(page, 1).click()
  await item(page, /Move down/).click()
  await expect(entry(page, 2)).toContainText("Hello")
  await expect(entry(page, 1)).not.toContainText("Hello")
  await expect(entry(page, 2)).toBeFocused()
  await entry(page, 2).click({ button: "right" })
  await expect(item(page, /Move up/)).toBeEnabled()
  await expect(item(page, /Move down/)).toBeDisabled()
  await expect(item(page, /Delete/)).toBeEnabled()
  await item(page, /Move up/).click()
  await expect(entry(page, 1)).toContainText("Hello")
  await actions(page, 2).click()
  await item(page, /Duplicate/).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(3)
  await expect(entry(page, 3)).toBeFocused()
  await actions(page, 2).click()
  await item(page, /Delete/).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect(entry(page, 1)).toContainText("Hello")
  await page.getByRole("button", { name: "Undo delete slide" }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(3)
})

test("Shift+F10 opens the menu from the slide and Tab does not stop on its actions control", async ({ page }) => {
  await open(page)
  await page.getByRole("button", { name: "Add slide" }).click()
  await expect(entry(page, 2)).toBeFocused()
  await page.keyboard.press("Shift+F10")
  await expect(item(page, /Duplicate/)).toBeFocused()
  await page.keyboard.press("ArrowDown")
  await expect(item(page, /Delete/)).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(entry(page, 2)).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(actions(page, 2)).not.toBeFocused()
  await expect(page.locator("[data-slide-list] :focus")).toHaveCount(0)
  await entry(page, 1).focus()
  await page.keyboard.press("Control+d")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(3)
  await expect(entry(page, 2)).toContainText("Hello")
})
