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
  await page.getByRole("button", { name: chartCopy.kinds.waterfall, exact: true }).click()
  const canvas = page.locator("[data-slide-paint]")
  await expect(canvas.locator("svg[data-chart]")).toHaveCount(1)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const title = page.locator("[data-chart-settings]").getByRole("textbox", { name: chartCopy.title, exact: true })
  await title.fill("Price and volume outgrow churn")
  await title.press("Enter")
  await expect(canvas.locator("[data-chart-text]").filter({ hasText: /^-14$/ })).toHaveCount(1)
  await expect(
    page.locator("[data-chart-data]").getByRole("checkbox", { name: chartCopy.totalRow(6), exact: true }),
  ).toBeChecked()
}

export default { name: "chart-waterfall-bridge", design: "/screens/s43-09-editor-tools-design-element", drive }
