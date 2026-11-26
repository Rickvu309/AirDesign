import { expect } from "@playwright/test"
import { test } from "./deck-test"

test("an empty menu opened from the keyboard never rings as a whole", async ({ page }) => {
  await page.goto("/screens/s42-02-editor-agent-run-complete")
  const chats = page.locator("[data-aira-history]")
  await page.keyboard.press("Tab")
  await chats.focus()
  await expect(chats).toHaveCSS("outline-style", "solid")
  await page.keyboard.press("Enter")
  const menu = page.locator("[data-aira-chats]")
  await expect(menu).toBeFocused()
  await expect(menu).toHaveCSS("outline-style", "none")
})

test("an arrow key rings the shape it reaches", async ({ page }) => {
  await page.goto("/screens/s43-05-editor-tools-shapes-expanded")
  const shapes = page.locator("[data-shape-grid] button")
  await page.keyboard.press("Tab")
  await shapes.first().focus()
  await page.keyboard.press("ArrowRight")
  await expect(shapes.nth(1)).toBeFocused()
  await expect(shapes.nth(1)).toHaveCSS("outline-style", "solid")
})
