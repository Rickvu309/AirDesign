import { expect } from "@playwright/test"
import { colorCopy } from "../../bin/product-copy.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit, "shapes-added.pptx")
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  await kit.page
    .locator("[data-design-panel]")
    .getByRole("button", { name: /^Background color/ })
    .click()
  await expect(kit.page.locator("[data-color-picker]").getByRole("group", { name: colorCopy.template })).toBeVisible()
}

export default { name: "color-picker-background", design: "/screens/s43-02-editor-tools-design-panel", drive }
