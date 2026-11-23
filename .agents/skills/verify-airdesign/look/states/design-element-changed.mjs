import { group } from "../doom-deck.mjs"
import { frameCopy, layoutWords } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"
import { designing, element, selectMany } from "../doom-design.mjs"

async function drive(kit) {
  const { page } = kit
  await designing(kit, "text")
  await selectMany(page, ["w:1"])
  const panel = page.locator("[data-design-element]")
  await panel.getByRole("button", { name: "Bold", exact: true }).click()
  await panel.getByRole("group", { name: "Text color" }).getByRole("button").first().click()
  await group(page.locator("[data-color-picker]")).first().getByRole("button").nth(5).click()
  await page.keyboard.press("Escape")
  await group(panel, frameCopy.align).getByRole("button", { name: layoutWords["align.center"], exact: true }).click()
  await expect(panel.getByRole("button", { name: "Bold", exact: true })).toHaveAttribute("aria-pressed", "true")
  await expect(
    group(panel, frameCopy.align).getByRole("button", { name: layoutWords["align.center"], exact: true }),
  ).toHaveAttribute("aria-pressed", "true")
}

export default { name: "design-element-changed", design: element, drive }
