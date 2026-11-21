import { expect } from "@playwright/test"
import { test } from "./deck-test"

test("product chrome loads Inter while slide text keeps its font and fallback", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator("body")).toHaveCSS("font-family", '"Inter Variable", system-ui, sans-serif')
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready
    return [...document.fonts].some((face) => face.family === "Inter Variable" && face.status === "loaded")
  })
  expect(loaded).toBe(true)
  await page.locator("input[type=file]").setInputFiles("scripts/pptx-fixtures/clean.pptx")
  const paint = page.locator("[data-slide-paint]")
  await expect(paint).toBeVisible()
  await expect(paint).toHaveCSS("font-family", '"Geist Variable", system-ui, sans-serif')
  await expect(page.locator("[data-thumb-paint]").first()).toHaveCSS(
    "font-family",
    '"Geist Variable", system-ui, sans-serif',
  )
  await expect(paint.locator("[data-run]").first()).toHaveCSS("font-family", /Arial/)
})
