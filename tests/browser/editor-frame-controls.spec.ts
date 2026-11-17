import { presentCopy } from "../../apps/web/src/copy/present-copy"
import { join } from "node:path"
import { expect, test } from "@playwright/test"

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

test("names zoom, offers its real shortcuts and keeps the slide above notes at maximum scroll", async ({ page }) => {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(join(process.cwd(), "scripts/pptx-fixtures/nasa-1d-cnn.pptx"))
  const readout = page.getByRole("button", { name: /^Zoom \d+%$/ })
  await expect(readout).toBeVisible()
  await readout.click()
  await expect(page.getByRole("menuitemradio", { name: /Fit.*Ctrl\+0/ })).toBeVisible()
  await page.getByRole("menuitem", { name: /Zoom in.*Ctrl\+=/ }).click()
  await expect(readout).toHaveText(/\d+%/)
  await readout.click()
  await expect(page.getByRole("menuitem", { name: /Zoom out.*Ctrl\+-/ })).toBeVisible()
  await page.getByRole("menuitemradio", { name: "200%", exact: true }).click()
  for (const open of [false, true]) {
    if (open) {
      await page.getByRole("button", { name: "Expand speaker notes" }).click()
      await page.getByRole("textbox", { name: presentCopy.notes, exact: true }).evaluate((element) => {
        element.style.height = "240px"
      })
    }
    const stage = page.locator("[data-canvas-stage]")
    await expect
      .poll(async () => {
        await stage.evaluate((element) => {
          element.scrollTop = element.scrollHeight
        })
        const slide = await page.locator("[data-slide-paint]").boundingBox()
        const notes = await page.locator("[data-notes-bar]").boundingBox()
        return slide !== null && notes !== null && slide.y + slide.height <= notes.y
      })
      .toBe(true)
    if (open) {
      const close = page.getByRole("button", { name: "Collapse speaker notes" })
      await expect(close).toBeInViewport()
      const field = page.getByRole("textbox", { name: presentCopy.notes, exact: true })
      await field.press("Escape")
      await expect(page.getByRole("button", { name: "Expand speaker notes" })).toBeFocused()
    }
  }
})
