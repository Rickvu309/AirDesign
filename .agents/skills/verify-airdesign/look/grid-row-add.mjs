import { expect } from "@playwright/test"
import { manySlides, rowNumbers, rowSizes } from "../../../../tests/browser/slide-grid-deck.ts"
import { openDeck } from "./open-deck.mjs"

export const belowRow = (page, row = 1) =>
  page.getByRole("button", { name: `Add slide in a new slide group below slide group ${row}`, exact: true })

export { rowNumbers }

export async function openRowDeck(kit, count = 10, sections = rowSizes(count)) {
  const account = await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, {
    name: sections === true ? "sections.pptx" : "ten.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await manySlides(count, sections),
  })
  await kit.page.getByRole("button", { name: "Grid", exact: true }).click()
  return account
}

export async function rowAddState(kit, state) {
  const { page } = kit
  const count = state === "limit" ? 50 : state === "sections" ? 6 : 10
  await openRowDeck(kit, count, state === "sections" ? true : rowSizes(count))
  if (state === "limit") return
  await page.locator("[data-zoom-readout]").click()
  await page.locator("[data-zoom-field]").fill("25")
  await page.keyboard.press("Enter")
  const button = belowRow(page)
  if ((await button.count()) === 0) {
    if (state === "added" || state === "sections") {
      await page.locator('[data-slide-entry="4"]').hover()
      await page.getByRole("button", { name: "Add slide after slide 4", exact: true }).click()
      if (state === "sections") await page.keyboard.press("ControlOrMeta+0")
    }
    return
  }
  if (state === "keyboard") {
    await page.locator('[data-slide-entry="1"]').focus()
    await page.keyboard.press("Tab")
    await page.keyboard.press("Tab")
    await expect(button).toBeFocused()
  } else await button.hover()
  await expect(page.locator("[data-row-insertion-line]:visible")).toHaveCount(1)
  if (state === "added" || state === "sections") {
    await button.click()
    await page.mouse.move(1400, 90)
    await expect(page.locator("[data-slide-entry]")).toHaveCount(state === "sections" ? 7 : 11)
    if (state === "sections") await page.keyboard.press("ControlOrMeta+0")
  }
}
