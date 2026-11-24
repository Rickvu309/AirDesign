import { editorCopy } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"
import { openDoomDeck } from "../doom-deck.mjs"
import { addSlideStart } from "../doom-slides.mjs"

async function drive(kit) {
  await openDoomDeck(kit)
  await addSlideStart(kit.page, editorCopy.slideStarts.chart)
  await expect(kit.page.locator("[data-slide-box] svg").first()).toBeVisible()
  await kit.page.evaluate(() => document.fonts.ready)
}

export default { name: "slide-chart", design: null, drive }
