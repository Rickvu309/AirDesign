import { expect } from "@playwright/test"

export async function openDeck(page, file, slide) {
  await page.locator("input[type=file]").setInputFiles(file)
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
  if (slide === undefined) return
  const entry = page.locator(`[data-slide-entry="${Number(slide)}"]`)
  await entry.click()
  await expect(entry).toHaveAttribute("aria-current", "true")
}
