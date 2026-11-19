import { expect } from "@playwright/test"
import { transitionCopy } from "../../bin/product-copy.mjs"
import { selectSlides } from "../grid-selection.mjs"

async function drive(kit) {
  await selectSlides(kit)
  await kit.page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await kit.page.getByRole("tab", { name: transitionCopy.animate }).click()
  await expect(kit.page.locator("[data-animate-panel]")).toBeVisible()
}

export default { name: "grid-selection-animate", design: "/screens/s43-02-editor-tools-design-panel", drive }
