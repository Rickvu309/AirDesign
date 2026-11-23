import { layoutWords } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"
import { openDesign, openDoomDeck, savedNode, selectNode } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  const opened = await openDoomDeck(kit)
  await openDesign(page)
  await selectNode(page, "s:4")
  await page
    .locator("[data-design-element]")
    .getByRole("button", { name: layoutWords["align.center"], exact: true })
    .click()
  await expect.poll(async () => (await savedNode(kit, opened, "s:4")).text.paras[0].align).toBe("center")
}

export default { name: "text-format-align", design: "/screens/s43-08-editor-tools-text-format", drive }
