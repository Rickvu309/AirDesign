import { expect } from "@playwright/test"
import { openDoomDeck } from "./doom-deck.mjs"
import { addSlideStart, editNodes, entry, slideIds } from "./doom-slides.mjs"

const notes = "Open with the three numbers, then hand over to the chart. Keep it under a minute."

export async function presentState(kit, view = "audience") {
  const { page } = kit
  const opened = await openDoomDeck(kit)
  await addSlideStart(page, "KPIs")
  await addSlideStart(page, "Chart")
  await expect.poll(async () => (await slideIds(kit, opened)).length).toBe(3)
  const [, second] = await slideIds(kit, opened)
  await editNodes(kit, opened, [
    {
      node: second,
      prop: "notes",
      value: { chars: notes, spans: [], paras: [{}], style: "body", resize: "fixed", alignV: "top" },
    },
  ])
  await entry(page, 2).click()
  await page.locator("[data-notes-width]").getByText(notes).waitFor()
  await page.getByRole("button", { name: "Present", exact: true }).click()
  await page.locator('[data-present-show] [data-present-slide="2"]').waitFor()
  if (view === "presenter") {
    await page.keyboard.press("p")
    await page.locator("[data-presenter-view]").getByText(notes).waitFor()
  }
  await page.evaluate(() => document.fonts.ready)
}
