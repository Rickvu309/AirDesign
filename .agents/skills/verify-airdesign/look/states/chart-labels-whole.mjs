import { createRequire } from "node:module"
import { expect } from "@playwright/test"
import { newBlankDeck } from "../../bin/new-deck.mjs"

const require = createRequire(import.meta.url)
const { chartCopy } = require("../../../../../apps/web/src/copy/chart-copy.ts")
const { transitionCopy } = require("../../../../../apps/web/src/copy/transition-copy.ts")

const market = ["12", "25", "31", "40"]

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
  const data = page.locator("[data-chart-data]")
  const name = data.getByRole("textbox", { name: chartCopy.series(1), exact: true })
  await name.fill("Market ($B)")
  await name.press("Enter")
  for (const [row, typed] of market.entries()) {
    const cell = data.getByRole("textbox", { name: chartCopy.value(row + 1, 1), exact: true })
    await cell.fill(typed)
    await cell.press("Enter")
    await expect(cell).not.toHaveValue("")
  }
  const labels = page.locator("[data-chart-settings]").getByRole("checkbox", { name: chartCopy.labels, exact: true })
  await labels.click()
  await expect(labels).toBeChecked()
  await expect(canvas.locator("[data-chart-text]").filter({ hasText: /^31/ })).toHaveCount(1)
  await data.scrollIntoViewIfNeeded()
}

export default { name: "chart-labels-whole", design: "/screens/s43-09-editor-tools-design-element", drive }
