import { createRequire } from "node:module"
import { expect } from "@playwright/test"
import { newBlankDeck } from "../../bin/new-deck.mjs"

const require = createRequire(import.meta.url)
const { chartCopy } = require("../../../../../apps/web/src/copy/chart-copy.ts")
const { transitionCopy } = require("../../../../../apps/web/src/copy/transition-copy.ts")
const { boxCopy } = require("../../../../../apps/web/src/copy/box-copy.ts")
const { shortcutCopy } = require("../../../../../apps/web/src/copy/shortcut-copy.ts")

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.goto("/")
  await newBlankDeck(page)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
  const charts = page.locator("[data-slide-paint] svg[data-chart]")
  await page.getByRole("button", { name: chartCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: chartCopy.kinds.bar, exact: true }).click()
  await expect(charts).toHaveCount(1)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await page.getByRole("button", { name: shortcutCopy.gestures["design-mode"], exact: true }).click()
  await page.getByRole("button", { name: boxCopy.section, exact: true }).click()
  const x = page.getByRole("textbox", { name: /^X/ }).first()
  await x.fill("36")
  await x.press("Enter")
  await page.getByRole("button", { name: chartCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: chartCopy.kinds.line, exact: true }).click()
  await expect(charts).toHaveCount(2)
}

export default { name: "chart-placed-beside", design: "/screens/s43-09-editor-tools-design-element", drive }
