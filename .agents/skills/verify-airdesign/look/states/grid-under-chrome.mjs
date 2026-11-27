import { expect } from "@playwright/test"
import { slideListCopy } from "../../bin/product-copy.mjs"
import { editor } from "../editor-screen.mjs"
import { openDoomDeck } from "../doom-deck.mjs"
import { addSlides, entries } from "../doom-slides.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit)
  await addSlides(page, 5)
  await page.getByRole("button", { name: slideListCopy.gridView }).click()
  await expect(entries(page)).toHaveCount(6)
  const readout = page.locator("[data-zoom-readout]")
  const percent = async () => Number.parseInt((await readout.textContent()) ?? "0", 10)
  const viewport = page.locator("[data-grid-viewport]")
  await expect
    .poll(
      async () => {
        await viewport.dispatchEvent("wheel", { deltaY: -10, ctrlKey: true, clientX: 735, clientY: 470 })
        return percent()
      },
      { intervals: [50], timeout: 10_000 },
    )
    .toBeGreaterThanOrEqual(40)
  const first = page.locator('[data-editor-grid] [data-slide-entry="1"]')
  await page.mouse.move(735, 300)
  await expect
    .poll(
      async () => {
        const box = await first.boundingBox()
        const off = { x: box.x - 120, y: box.y - 48 }
        const placed = Math.abs(off.x) <= 1 && Math.abs(off.y) <= 1
        if (!placed) await page.mouse.wheel(off.x, off.y)
        return placed
      },
      { intervals: [100], timeout: 20_000 },
    )
    .toBe(true)
  await page.mouse.move(2, 2)
}

export default { name: "grid-under-chrome", design: editor, drive }
