import { createRequire } from "node:module"
import { expect } from "@playwright/test"
import { newBlankDeck } from "../../bin/new-deck.mjs"

const require = createRequire(import.meta.url)
const { chartCopy } = require("../../../../../apps/web/src/copy/chart-copy.ts")
const { transitionCopy } = require("../../../../../apps/web/src/copy/transition-copy.ts")

const block = ["2022\t38\t21\t12", "2023\t42\t24\t15", "2024\t47\t26\t19", "2025\t53\t29\t24"].join("\n")

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.goto("/")
  await newBlankDeck(page)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
  await page.getByRole("button", { name: chartCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: chartCopy.kinds.bar, exact: true }).click()
  await expect(page.locator("[data-slide-paint] svg[data-chart]")).toHaveCount(1)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const label = page.locator("[data-chart-data]").getByRole("textbox", { name: chartCopy.category(1), exact: true })
  await label.focus()
  await label.evaluate((node, text) => {
    const data = new DataTransfer()
    data.setData("text/plain", text)
    node.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }))
  }, block)
  await label.blur()
  await page.waitForTimeout(800)
}

export default { name: "chart-data-pasted", design: "/screens/s43-09-editor-tools-design-element", drive }
