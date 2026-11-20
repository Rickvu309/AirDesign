import { createRequire } from "node:module"
import { expect } from "@playwright/test"
import { newBlankDeck } from "../../bin/new-deck.mjs"

const require = createRequire(import.meta.url)
const { chartCopy } = require("../../../../../apps/web/src/copy/chart-copy.ts")
const { transitionCopy } = require("../../../../../apps/web/src/copy/transition-copy.ts")

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.goto("/")
  await newBlankDeck(page)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
  await page.getByRole("button", { name: chartCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: chartCopy.kinds.bar, exact: true }).click()
  const canvas = page.locator("[data-slide-paint]")
  await expect(canvas.locator("svg[data-chart]")).toHaveCount(1)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const settings = page.locator("[data-chart-settings]")
  const title = settings.getByRole("textbox", { name: chartCopy.title, exact: true })
  await title.fill("Revenue grows every quarter")
  await title.press("Enter")
  for (const [name, on] of [
    [chartCopy.labels, true],
    [chartCopy.axis, false],
    [chartCopy.gridlines, false],
  ]) {
    const box = settings.getByRole("checkbox", { name, exact: true })
    await box.click()
    await expect(box).toBeChecked({ checked: on })
  }
  await expect(canvas.locator("[data-chart-text]").filter({ hasText: "4.1" })).toHaveCount(1)
  const named = settings.getByRole("textbox", { name: chartCopy.categoryTitle, exact: true })
  await named.fill("Quarter")
  await named.press("Enter")
  await expect(canvas.locator("[data-chart-text]").filter({ hasText: "Quarter" })).toHaveCount(1)
  await settings.scrollIntoViewIfNeeded()
}

export default { name: "chart-settings-panel", design: "/screens/s43-09-editor-tools-design-element", drive }
