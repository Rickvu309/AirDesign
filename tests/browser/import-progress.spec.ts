import { expect } from "@playwright/test"
import { test } from "./deck-test"
import { join } from "node:path"
import { store } from "./home-store.ts"
import { deckRoutes } from "../../apps/web/src/decks/deck-routes.ts"

test("Home keeps the import indicator running until the file is read", async ({ page }) => {
  await store(page, [])
  await page.goto("/")
  await page.evaluate(() => {
    File.prototype.arrayBuffer = () => new Promise(() => {})
  })
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.locator("input[type=file]").setInputFiles(join(process.cwd(), "scripts/pptx-fixtures/clean.pptx"))
  const progress = page.locator("[data-import-progress]")
  await expect(progress).toBeVisible()
  await expect(progress).toHaveCSS("animation-name", "import-sweep")
  await expect(progress).toHaveCSS("animation-timing-function", "linear")
  await expect(progress).toHaveCSS("animation-iteration-count", "infinite")
  await expect.poll(() => progress.evaluate((element) => element.getAnimations().length)).toBe(1)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await expect(progress).toHaveCSS("animation-name", "none")
  await expect(progress).toHaveCSS("transform", "none")
})

test("the import progress sweeps while work runs and holds still under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.goto(deckRoutes.importing)
  const progress = page.locator("[data-import-progress]")
  await expect(progress).toHaveCSS("animation-name", "import-sweep")
  await expect(progress).toHaveCSS("animation-iteration-count", "infinite")
  await page.emulateMedia({ reducedMotion: "reduce" })
  await expect(progress).toHaveCSS("animation-name", "none")
})
