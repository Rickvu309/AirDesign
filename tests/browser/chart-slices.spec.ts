import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { chartCopy } from "../../apps/web/src/copy/chart-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { openDeck, typeColor } from "./design-panel"
import { test } from "./deck-test"

const census = join(process.cwd(), "scripts/pptx-fixtures/census-updating-spm.pptx")
const navy = "1F4E79"

test.use({ viewport: { width: 1600, height: 1000 } })

async function design(page: Page) {
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  return page.locator("[data-chart-settings]")
}

test("recolours one slice of an imported pie and keeps it through a reload", async ({ page, decks }) => {
  await decks.open(census)
  await page.locator('[data-slide-entry="19"]').click()
  const pies = page.locator("[data-slide-paint] svg[data-chart=pie]")
  await expect(pies).toHaveCount(3)
  const spot = await pies.last().boundingBox()
  if (spot === null) throw new Error("no pie")
  await page.mouse.click(spot.x + spot.width / 2, spot.y + spot.height / 2)
  const settings = await design(page)
  const slice = settings.getByLabel("Inside principal cities", { exact: true })
  await typeColor(page, slice.getByRole("button").first(), navy)
  await expect(page.locator(`[data-slide-paint] svg[data-chart=pie] [fill="#${navy}"]`)).toHaveCount(1)
  await page.reload()
  await decks.ready()
  await page.locator('[data-slide-entry="19"]').click()
  await expect(page.locator(`[data-slide-paint] svg[data-chart=pie] [fill="#${navy}"]`)).toHaveCount(1)
})

test("names a new bar chart's axes and keeps the titles through a reload", async ({ page, decks }) => {
  await openDeck(page, "blank.pptx")
  await page.getByRole("button", { name: chartCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: chartCopy.kinds.bar, exact: true }).click()
  const canvas = page.locator("[data-slide-paint]")
  await expect(canvas.locator("svg[data-chart]")).toHaveCount(1)
  const settings = await design(page)
  for (const [name, text] of [
    [chartCopy.valueTitle, "Revenue ($M)"],
    [chartCopy.categoryTitle, "Quarter"],
  ] as const) {
    const field = settings.getByRole("textbox", { name, exact: true })
    await field.fill(text)
    await field.press("Enter")
    await expect(canvas.locator("[data-chart-text]").filter({ hasText: text })).toHaveCount(1)
  }
  await page.reload()
  await decks.ready()
  await expect(canvas.locator("[data-chart-text]").filter({ hasText: "Revenue ($M)" })).toHaveCount(1)
  await expect(canvas.locator("[data-chart-text]").filter({ hasText: "Quarter" })).toHaveCount(1)
})
