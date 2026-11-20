import { expect } from "@playwright/test"
import { newBlankDeck } from "../../bin/new-deck.mjs"

const sheet = [
  "Criterion\tVendor A\tVendor B\tVendor C",
  "License cost (5 yr)\t$4.2M\t$3.1M\t$5.0M",
  "Implementation time\t18 months\t12 months\t24 months",
  "Cloud native\tYes\tPartial\tYes",
].join("\n")

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.goto("/")
  await newBlankDeck(page)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
  const surface = page.locator("[data-slide-paint]")
  await surface.focus()
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"])
  await page.evaluate((text) => navigator.clipboard.writeText(text), sheet)
  await page.keyboard.press("ControlOrMeta+KeyV")
  await page.waitForTimeout(800)
}

export default { name: "table-pasted", design: null, drive }
