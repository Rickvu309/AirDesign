import { expect } from "@playwright/test"
import { editorCopy } from "../../bin/product-copy.mjs"
import { accent, openDoomDeck, spot } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, [
    {
      id: "w:1",
      props: { name: "Block", box: spot(0, 0, 1824, 1080), geometry: { kind: "rect" }, fills: accent },
    },
  ])
  await page.getByRole("button", { name: editorCopy.actions, exact: true }).click()
  await page.getByRole("option", { name: editorCopy.chartKinds.column, exact: true }).click()
  await expect(page.locator("[data-slide-box] svg").first()).toBeVisible()
  await page.mouse.move(4, 4)
}

export default { name: "chart-high-fill", design: null, drive }
