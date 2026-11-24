import { expect } from "@playwright/test"
import { editorCopy } from "../../bin/product-copy.mjs"
import { accent, openDoomDeck, spot } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, [
    {
      id: "w:1",
      props: { name: "Block", box: spot(0, 0, 1920, 918), geometry: { kind: "rect" }, fills: accent },
    },
  ])
  await page.getByRole("button", { name: editorCopy.actions, exact: true }).click()
  await page.getByRole("combobox", { name: editorCopy.actionsSearch }).fill("rocket")
  await page.getByRole("option", { name: "rocket", exact: true }).click()
  await expect(page.locator("[data-selection-outline]")).toBeVisible()
  await page.mouse.move(4, 4)
}

export default { name: "icon-high-fill", design: null, drive }
