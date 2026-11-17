import { productCopy } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await expect(kit.page.getByRole("button", { name: productCopy.newDeck })).toBeVisible()
  for (let press = 0; press < 12; press += 1) {
    await kit.page.keyboard.press("Tab")
    const name = await kit.page.evaluate(() => document.activeElement?.textContent?.trim() ?? "")
    if (name === productCopy.newDeck) return
  }
  throw new Error("New deck never took focus")
}

export default { name: "focus-home", design: null, drive }
