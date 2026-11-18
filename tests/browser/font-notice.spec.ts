import { join } from "node:path"
import { expect, test } from "@playwright/test"
import { settled } from "./design-panel"

const heatPumps = join(process.cwd(), "scripts/pptx-fixtures/doe-heat-pumps.pptx")

test("opening a deck whose fonts fall back shows no notice", async ({ page }) => {
  const asked: string[] = []
  await page.route("**/fonts/family?**", async (route) => {
    asked.push(new URL(route.request().url()).searchParams.get("family") ?? "")
    await route.fulfill({ status: 404, json: { ok: false, refusal: "unknown" } })
  })
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(heatPumps)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await expect.poll(() => asked.length).toBeGreaterThan(0)
  await page.evaluate(() => document.fonts.ready.then(() => new Promise((done) => setTimeout(done, 500))))
  expect(await page.locator("[data-sonner-toast]").count()).toBe(0)
  expect(await page.getByText(/fallback font/).count()).toBe(0)
})
