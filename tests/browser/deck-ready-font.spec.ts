import { join } from "node:path"
import { expect, test } from "@playwright/test"

const fixture = join(process.cwd(), "scripts/pptx-fixtures/clean.pptx")

test("a deck is ready and its text is painted while a font is still arriving", async ({ page }) => {
  let release = () => {}
  const held = new Promise<void>((done) => {
    release = done
  })
  let asked = 0
  await page.route("**/fonts/family*", async (route) => {
    asked += 1
    await held
    await route.fulfill({ status: 404, body: "" }).catch(() => undefined)
  })
  const ready = page.locator(".thin-page")
  const text = page.locator("[data-slide-paint] [data-run]").first()
  try {
    await page.goto("/")
    await page.locator("input[type=file]").setInputFiles(fixture)
    await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
    await expect(ready).toHaveAttribute("data-deck-ready", /.+/)
    await expect(text).toBeVisible()
    expect(asked).toBeGreaterThan(0)
    await expect(page.locator("[data-slide-paint] [data-fonts-pending]").first()).toBeAttached()
    const deck = await ready.getAttribute("data-deck-ready")
    release()
    await expect(page.locator("[data-slide-paint] [data-fonts-pending]")).toHaveCount(0)
    await expect(text).toBeVisible()
    await expect(ready).toHaveAttribute("data-deck-ready", deck ?? "")
    await expect(page.getByText("The slide uses a fallback font.").first()).toBeVisible()
  } finally {
    release()
  }
})
