import { openRowDeck } from "./grid-row-add.mjs"

export async function gapAddState(kit, state) {
  const { page } = kit
  await openRowDeck(kit)
  await page.locator("[data-zoom-readout]").click()
  await page.locator("[data-zoom-field]").fill(state === "small" ? "10" : state === "end" ? "18" : "25")
  await page.keyboard.press("Enter")
  if (state === "between") await page.locator('[data-slide-entry="2"]').hover()
  if (state === "end") {
    await page.locator('[data-slide-entry="4"]').hover()
    await page.locator("[data-grid-viewport]").hover()
    await page.mouse.wheel(120, 0)
    await page.locator('[data-slide-entry="4"]').hover()
  }
  if (state === "end") await page.locator("[data-grid-card]").nth(3).locator("button").last().hover()
}
