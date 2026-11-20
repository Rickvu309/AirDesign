import { createRequire } from "node:module"
import { expect } from "@playwright/test"
import { newBlankDeck } from "../../bin/new-deck.mjs"

const require = createRequire(import.meta.url)
const { chartCopy } = require("../../../../../apps/web/src/copy/chart-copy.ts")
const { transitionCopy } = require("../../../../../apps/web/src/copy/transition-copy.ts")

const ranked = [
  ["Price", "42"],
  ["Service", "31"],
  ["Range", "18"],
  ["Brand", "9"],
]

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.goto("/")
  await newBlankDeck(page)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
  await page.getByRole("button", { name: chartCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: chartCopy.kinds.horizontal, exact: true }).click()
  const canvas = page.locator("[data-slide-paint]")
  await expect(canvas.locator("svg[data-chart]")).toHaveAttribute("data-chart", "bar")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const data = page.locator("[data-chart-data]")
  await data.getByRole("button", { name: chartCopy.removeSeries(2), exact: true }).click()
  const name = data.getByRole("textbox", { name: chartCopy.series(1), exact: true })
  await name.fill("Buyers (%)")
  await name.press("Enter")
  for (const [row, [label, value]] of ranked.entries()) {
    const category = data.getByRole("textbox", { name: chartCopy.category(row + 1), exact: true })
    await category.fill(label)
    await category.press("Enter")
    const cell = data.getByRole("textbox", { name: chartCopy.value(row + 1, 1), exact: true })
    await cell.fill(value)
    await cell.press("Enter")
  }
  const settings = page.locator("[data-chart-settings]")
  const title = settings.getByRole("textbox", { name: chartCopy.title, exact: true })
  await title.fill("Price decides most purchases")
  await title.press("Enter")
  for (const [box, on] of [
    [chartCopy.labels, true],
    [chartCopy.axis, false],
    [chartCopy.gridlines, false],
  ]) {
    const check = settings.getByRole("checkbox", { name: box, exact: true })
    await check.click()
    await expect(check).toBeChecked({ checked: on })
  }
  await expect(canvas.locator("[data-chart-text]").filter({ hasText: /^42(\.0)?$/ })).toHaveCount(1)
  await expect(canvas.locator("[data-chart-text]").filter({ hasText: /^Brand$/ })).toHaveCount(1)
}

export default { name: "chart-horizontal-ranked", design: "/screens/s43-09-editor-tools-design-element", drive }
