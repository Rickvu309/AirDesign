import { join } from "node:path"
import { expect } from "@playwright/test"
import { test } from "./deck-test"

const heatPumps = join(process.cwd(), "scripts/pptx-fixtures/doe-heat-pumps.pptx")

test("opening a deck whose fonts fall back shows no notice", async ({ page, decks }) => {
  const asked: string[] = []
  await page.route("**/fonts/family?**", async (route) => {
    asked.push(new URL(route.request().url()).searchParams.get("family") ?? "")
    await route.fulfill({ status: 404, json: { ok: false, refusal: "unknown" } })
  })
  await decks.open(heatPumps)
  await expect.poll(() => asked.length).toBeGreaterThan(0)
  await decks.ready()
  expect(await page.locator("[data-sonner-toast]").count()).toBe(0)
  expect(await page.getByText(/fallback font/).count()).toBe(0)
})
