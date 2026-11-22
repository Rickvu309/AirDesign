import { expect, type Page } from "@playwright/test"
import { test } from "./deck-test"

test.use({ viewport: { width: 1470, height: 923 }, deviceScaleFactor: 2, reducedMotion: "reduce" })

async function shown(page: Page) {
  return page.evaluate(() => {
    const stage = document.querySelector("[data-canvas-stage]")?.getBoundingClientRect()
    const overlay = document.querySelector("[data-canvas-overlay]")?.getBoundingClientRect()
    const frame = document.querySelector("[data-selection]")?.getBoundingClientRect()
    const content = document.querySelector("[data-canvas-content]")
    if (!stage || !overlay || !frame || content === null) throw new Error("Canvas is not ready")
    return {
      dx: frame.left + frame.width / 2 - (stage.left + stage.width / 2),
      dy: frame.top + frame.height / 2 - (stage.top + (overlay.top - stage.top) / 2),
      margin: stage.width - frame.width,
      pad: Number.parseFloat(getComputedStyle(content).paddingTop),
    }
  })
}

test("a selection zoom stays centred when the notes overlay settles after it", async ({ page, decks }) => {
  await decks.open()
  await page.locator('[contenteditable="true"]').click()
  await expect(page.locator("[data-selection]")).toHaveCount(1)
  await page.keyboard.press("Shift+Digit2")
  await expect.poll(async () => Math.round((await shown(page)).margin)).toBeLessThanOrEqual(100)
  const placed = await shown(page)
  expect(Math.abs(placed.dx)).toBeLessThanOrEqual(1)
  expect(Math.abs(placed.dy)).toBeLessThanOrEqual(1)

  await page.getByRole("button", { name: "Collapse presenter notes" }).focus()
  await page.keyboard.press("End")
  await expect.poll(async () => (await shown(page)).pad).not.toBe(placed.pad)
  const resized = await shown(page)
  expect(Math.abs(resized.dx)).toBeLessThanOrEqual(1)
  expect(Math.abs(resized.dy)).toBeLessThanOrEqual(1)
})
