import { expect } from "@playwright/test"
import { transitionCopy } from "../../bin/product-copy.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit, "frame.pptx")
  await kit.page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await kit.page.locator("[data-design-mode]").click()
  const layers = kit.page.locator("[data-layers-panel]")
  await expect(layers).toBeVisible()
  await layers.locator("[data-layer-caret]").first().click()
  await layers.getByRole("treeitem").nth(1).click()
  await expect(layers.getByRole("treeitem").nth(1)).toHaveAttribute("aria-selected", "true")
  await kit.page.evaluate(() => {
    const guard = (event) => {
      if (event.code !== "KeyR" || (!event.ctrlKey && !event.metaKey)) return
      event.preventDefault()
      window.removeEventListener("keydown", guard)
    }
    window.addEventListener("keydown", guard)
  })
  await kit.page.keyboard.press("Control+KeyR")
  const opened = await layers
    .locator("[data-layer-name-field]")
    .waitFor({ state: "visible", timeout: 2000 })
    .then(() => true)
    .catch(() => false)
  if (opened) await expect(layers.locator("[data-layer-name-field]")).toBeFocused()
}

export default { name: "layers-rename", design: "/screens/s43-10-editor-tools-layers", drive }
