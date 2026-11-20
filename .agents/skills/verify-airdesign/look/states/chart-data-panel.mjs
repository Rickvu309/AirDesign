import { createRequire } from "node:module"
import { expect } from "@playwright/test"
import { newBlankDeck } from "../../bin/new-deck.mjs"

const require = createRequire(import.meta.url)
const { chartCopy } = require("../../../../../apps/web/src/copy/chart-copy.ts")
const { transitionCopy } = require("../../../../../apps/web/src/copy/transition-copy.ts")

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await newBlankDeck(kit.page)
  await expect(kit.page.locator("[data-slide-entry]")).toHaveCount(1)
  await kit.page.getByRole("button", { name: chartCopy.tool, exact: true }).click()
  await kit.page.getByRole("button", { name: chartCopy.kinds.bar, exact: true }).click()
  await expect(kit.page.locator("[data-slide-paint] svg[data-chart]")).toHaveCount(1)
  await kit.page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const data = kit.page.locator("[data-chart-data]")
  const name = data.getByRole("textbox", { name: chartCopy.series(1), exact: true })
  await name.fill("Revenue")
  await name.press("Enter")
  await expect(kit.page.locator("[data-slide-paint] [data-chart-text]").filter({ hasText: "Revenue" })).toHaveCount(1)
}

export default { name: "chart-data-panel", design: "/screens/s43-09-editor-tools-design-element", drive }
