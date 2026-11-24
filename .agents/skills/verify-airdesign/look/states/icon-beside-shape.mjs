import { expect } from "@playwright/test"
import { editorCopy } from "../../bin/product-copy.mjs"
import { accent, openDoomDeck, spot } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, [
    {
      id: "w:1",
      props: { name: "Block", box: spot(0, 0, 1400, 1080), geometry: { kind: "rect" }, fills: accent },
    },
  ])
  await page.getByRole("button", { name: editorCopy.actions, exact: true }).click()
  await page.getByRole("option", { name: "rocket", exact: true }).click()
  await expect(page.locator("[data-selection-outline]")).toBeVisible()
  await page.mouse.move(4, 4)
}

export default { name: "icon-beside-shape", design: null, drive }
