import { expect } from "@playwright/test"
import { adjustToneCopy } from "../../bin/product-copy.mjs"
import element from "./design-element.mjs"

async function drive(kit) {
  await element.drive(kit)
  const { page } = kit
  await page.getByRole("button", { name: adjustToneCopy.title, exact: true }).click()
  const tone = page.getByRole("dialog", { name: adjustToneCopy.title })
  await expect(tone.getByRole("button", { name: adjustToneCopy.presets[0] })).toBeEnabled()
}

export default { name: "adjust-tone", design: element.design, drive, aira: true }
