import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { threeSlideDeck } from "../three-slide-deck.mjs"

async function drive(kit) {
  await threeSlideDeck(kit)
  await kit.page.locator("[data-zoom-readout]").click()
  await expect(kit.page.getByRole("menuitemradio").first()).toBeVisible()
}

export default { name: "zoom-menu", design: editor, drive }
