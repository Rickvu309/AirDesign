import { createRequire } from "node:module"
import path from "node:path"
import { expect } from "@playwright/test"

const require = createRequire(import.meta.url)
const { transitionCopy } = require("../../../../../apps/web/src/copy/transition-copy.ts")
const { chartCopy } = require("../../../../../apps/web/src/copy/chart-copy.ts")

const title = "Most people live in or near cities"

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.goto("/")
  await page
    .locator("input[type=file]")
    .setInputFiles(path.join(kit.repo, "scripts/pptx-fixtures/census-updating-spm.pptx"))
  await expect(page.locator("[data-slide-entry]")).toHaveCount(26, { timeout: 60_000 })
  await page.locator('[data-slide-entry="19"]').click()
  const pies = page.locator("[data-slide-paint] svg[data-chart=pie]")
  await expect(pies).toHaveCount(3)
  const spot = await pies.last().boundingBox()
  await page.mouse.click(spot.x + spot.width / 2, spot.y + spot.height / 2)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const settings = page.locator("[data-chart-settings]")
  const field = settings.getByRole("textbox", { name: chartCopy.title, exact: true })
  await field.fill(title)
  await field.press("Enter")
  await expect(page.locator("[data-slide-paint] [data-chart-text]").filter({ hasText: title })).toHaveCount(1)
  await settings.getByRole("combobox", { name: chartCopy.format, exact: true }).click()
  await page.getByRole("option", { name: chartCopy.formats["0.0%"], exact: true }).click()
  await expect(page.locator("[data-slide-paint] [data-chart-text]").filter({ hasText: "44.4%" })).toHaveCount(1)
  await page.waitForTimeout(500)
}

export default { name: "chart-imported-styled", design: "/screens/s43-09-editor-tools-design-element", drive }
