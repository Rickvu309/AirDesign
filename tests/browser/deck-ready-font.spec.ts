import { expect } from "@playwright/test"
import { cleanFixture, test } from "./deck-test"

test("a deck's text paints while a font is still arriving, and the deck is ready once the font is in", async ({
  page,
  decks,
}) => {
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
  const text = page.locator("[data-slide-paint] [data-run]").first()
  try {
    await page.goto("/")
    await page.locator("input[type=file]").setInputFiles(cleanFixture)
    await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
    await expect(text).toBeVisible()
    expect(asked).toBeGreaterThan(0)
    await expect(page.locator("[data-slide-paint] [data-fonts-pending]").first()).toBeAttached()
    expect(await decks.readiness()).toBeNull()
    release()
    expect(page.url()).toContain(await decks.ready())
    await expect(page.locator("[data-slide-paint] [data-fonts-pending]")).toHaveCount(0)
    await expect(text).toBeVisible()
    await expect(page.getByText(/fallback font/)).toHaveCount(0)
  } finally {
    release()
  }
})
