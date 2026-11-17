import { expectNoticeTint } from "./notice-tint"
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

function item(page: Page, name: RegExp) {
  return page.getByRole("menuitem", { name })
}

test("one slide can be duplicated from its menu, and move and delete are unavailable", async ({ page }) => {
  await open(page)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
  await expect(page.getByRole("button", { name: /Slide \d+ actions/ })).toHaveCount(0)
  await entry(page, 1).click({ button: "right" })
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
  await entry(page, 1).click({ button: "right" })
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
  await entry(page, 2).click({ button: "right" })
  await item(page, /Duplicate/).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(3)
  await expect(entry(page, 3)).toBeFocused()
  await entry(page, 2).click({ button: "right" })
  await item(page, /Delete/).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect(entry(page, 1)).toContainText("Hello")
  await page.getByRole("button", { name: "Undo delete slide" }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(3)
})

test("Shift+F10 opens the menu from the slide and Tab leaves the slide list", async ({ page }) => {
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
  await expect(page.locator("[data-slide-list] :focus")).toHaveCount(0)
  await entry(page, 1).focus()
  await page.keyboard.press("Control+d")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(3)
  await expect(entry(page, 2)).toContainText("Hello")
})

test("deleting a slide shows a toast whose Undo brings the slide back at its place, one step", async ({ page }) => {
  await open(page)
  await page.getByRole("button", { name: "Add slide" }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await entry(page, 1).click({ button: "right" })
  await item(page, /Delete/).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
  const deleted = page.locator("[data-slide-toast]")
  await expect(deleted).toContainText("Slide 1 deleted")
  const undo = deleted.getByRole("button", { name: "Undo" })
  await undo.hover()
  await expectNoticeTint(undo, 26)
  await page.mouse.down()
  await expectNoticeTint(undo, 38)
  await page.mouse.up()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect(entry(page, 1)).toContainText("Hello")
  await expect(entry(page, 2)).not.toContainText("Hello")
  await expect(deleted).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Undo new slide" })).toBeEnabled()
})

test("the delete toast leaves once another step is on top, so its Undo never takes back that step", async ({
  page,
}) => {
  await open(page)
  await page.getByRole("button", { name: "Add slide" }).click()
  await expect(entry(page, 2)).toBeFocused()
  await page.keyboard.press("Delete")
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
  const deleted = page.locator("[data-slide-toast]")
  await expect(deleted).toContainText("Slide 2 deleted")
  await page.getByRole("button", { name: "Add slide" }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expect(deleted).toHaveCount(0)
})

test("right-click opens the menu after scrolling to the last slide", async ({ page }) => {
  await open(page)
  for (let count = 2; count <= 8; count += 1) {
    await page.getByRole("button", { name: "Add slide" }).click()
    await expect(page.locator("[data-slide-entry]")).toHaveCount(count)
  }
  await entry(page, 1).scrollIntoViewIfNeeded()
  await entry(page, 8).scrollIntoViewIfNeeded()
  await entry(page, 8).click({ button: "right" })
  await expect(item(page, /Duplicate/)).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(entry(page, 8)).toBeFocused()
})
