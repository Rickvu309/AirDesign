import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { store } from "./home-store.ts"
import { covers } from "./gesture"

const clean = join(process.cwd(), "scripts/pptx-fixtures/clean.pptx")

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

test("New deck opens a menu that takes the focus, moves by arrow and gives the focus back on Escape", async ({
  page,
}) => {
  await store(page)
  await page.goto("/")
  const button = page.getByRole("button", { name: "New deck", exact: true })
  await expect(button).toBeVisible()
  await button.focus()
  await page.keyboard.press("Enter")
  const menu = page.getByRole("menu", { name: "New deck" })
  await expect(menu).toBeVisible()
  const blank = menu.getByRole("menuitem", { name: "Blank deck", exact: true })
  const importing = menu.getByRole("menuitem", { name: "Import PowerPoint", exact: true })
  await expect(blank).toBeFocused()
  await page.keyboard.press("ArrowDown")
  await expect(importing).toBeFocused()
  await page.keyboard.press("ArrowUp")
  await expect(blank).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(menu).toHaveCount(0)
  await expect(button).toBeFocused()
})

test("Tab goes from Grid view and List view to the next control, not into New deck's items", async ({ page }) => {
  await store(page)
  await page.goto("/")
  const button = page.getByRole("button", { name: "New deck", exact: true })
  await expect(button).toBeVisible()
  await button.focus()
  await page.keyboard.press("Tab")
  await expect(page.getByRole("link", { name: "Grid view" })).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(page.getByRole("link", { name: "List view" })).toBeFocused()
})

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

async function percent(page: Page): Promise<number> {
  const text = (await page.locator("[data-zoom-readout]").textContent()) ?? ""
  return Number(text.replace("%", ""))
}

test("Ctrl+= and Ctrl+- zoom the canvas and Ctrl+0 returns to Fit", async ({ page }) => {
  covers("zoom-in", "zoom-out", "zoom-fit")
  await open(page)
  const fit = await percent(page)
  await page.locator("[data-canvas-stage]").click({ position: { x: 5, y: 5 } })
  await page.keyboard.press("ControlOrMeta+=")
  await expect.poll(() => percent(page)).toBeGreaterThan(fit)
  const bigger = await percent(page)
  await page.keyboard.press("ControlOrMeta+=")
  await expect.poll(() => percent(page)).toBeGreaterThan(bigger)
  await page.keyboard.press("ControlOrMeta+-")
  await expect.poll(() => percent(page)).toBe(bigger)
  await page.keyboard.press("ControlOrMeta+0")
  await expect.poll(() => percent(page)).toBe(fit)
  await page.locator("[data-zoom-readout]").click()
  await expect(page.getByRole("menuitemradio", { name: `Fit (${String(fit)}%)` })).toBeChecked()
})

test("the zoom menu names its first item Fit with its percent", async ({ page }) => {
  await open(page)
  const fit = await percent(page)
  await page.locator("[data-zoom-readout]").click()
  const items = page.getByRole("menuitemradio")
  await expect(items.first()).toHaveText(`Fit (${String(fit)}%)`)
  await expect(items.nth(1)).toHaveText("50%")
})

test("Ctrl+= inside a text box is left to the browser", async ({ page }) => {
  await open(page)
  const fit = await percent(page)
  await page.locator("[data-slide-entry='1']").click()
  const title = page.locator('[contenteditable="true"]').first()
  await title.focus()
  await page.keyboard.press("ControlOrMeta+=")
  expect(await percent(page)).toBe(fit)
})

test("Expand speaker notes is one tab stop", async ({ page }) => {
  await open(page)
  const expand = page.getByRole("button", { name: "Expand speaker notes" })
  await expect(expand).toHaveCount(1)
  await expand.focus()
  await page.keyboard.press("Tab")
  await expect(expand).not.toBeFocused()
  expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).not.toBe("Expand speaker notes")
})
