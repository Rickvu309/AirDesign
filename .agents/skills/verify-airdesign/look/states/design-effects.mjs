import { group } from "../doom-deck.mjs"
import { appearanceCopy, effectsWords } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"
import { designing, element, selectMany } from "../doom-design.mjs"

async function drive(kit) {
  const { page } = kit
  await designing(kit, "shape")
  await selectMany(page, ["w:2"])
  const panel = page.locator("[data-design-element]")
  const shadow = group(panel, appearanceCopy.shadowPreset)
  await shadow.getByRole("button", { name: effectsWords["shadow.medium"], exact: true }).click()
  await expect(shadow.getByRole("button", { name: effectsWords["shadow.medium"], exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await panel.getByRole("heading", { name: effectsWords["add.shadow"], exact: true }).scrollIntoViewIfNeeded()
}

export default { name: "design-effects", design: element, drive }
