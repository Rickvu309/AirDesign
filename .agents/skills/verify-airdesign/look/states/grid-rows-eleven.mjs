import { expect } from "@playwright/test"
import { manySlides, rowSizes } from "../../../../../tests/browser/slide-grid-deck.ts"
import { openDeck } from "../open-deck.mjs"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, {
    name: "ten.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await manySlides(10, rowSizes(10)),
  })
  await kit.page.getByRole("button", { name: "Grid", exact: true }).click()
  await kit.page.locator('[data-slide-entry="10"]').hover()
  await kit.page.getByRole("button", { name: "Add slide after slide 10", exact: true }).click()
  await expect(kit.page.locator("[data-slide-entry]")).toHaveCount(11)
}
export default { name: "grid-rows-eleven", design: "/screens/s41-01-editor-grid-default", drive }
