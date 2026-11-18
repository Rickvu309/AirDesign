import { productCopy } from "../../apps/web/src/copy/product-copy"
import { themeCopy } from "../../apps/web/src/copy/theme-copy"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { appearanceCopy } from "../../apps/web/src/copy/appearance-copy"
import { expect, test } from "@playwright/test"
import { openDeck } from "./design-panel"

test.use({ viewport: { width: 1470, height: 923 } })

test("template colors stay named and reachable at narrow editor widths", async ({ page }) => {
  await openDeck(page, "clean.pptx")
  await page.getByRole("button", { name: "Design", exact: true }).click()
  for (const width of [220, 240, 440]) {
    const resize = page.getByRole("separator")
    await resize.focus()
    await resize.press("Home")
    for (let at = 220; at < width; at += 10) await resize.press("ArrowLeft")
    await page.getByRole("button", { name: designCopy.editTemplateStyle, exact: true }).click()
    const dialog = page.locator("[data-design-theme]")
    for (const slot of ["dk1", "accent1", "accent6"] as const) {
      const swatch = dialog.getByRole("button", { name: themeCopy[slot], exact: true })
      await expect(swatch).toBeVisible()
      await expect(swatch).toHaveAttribute("title", new RegExp(themeCopy[slot]))
    }
    await dialog.getByRole("button", { name: productCopy.close, exact: true }).click()
  }
})

test("the Border preset glyphs render at the segment size", async ({ page }) => {
  await openDeck(page, "shapes-added.pptx")
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await page
    .locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#4"]')
    .click({ position: { x: 4, y: 4 } })
  const sizes = await page
    .getByRole("group", { name: appearanceCopy.border, exact: true })
    .locator("svg")
    .evaluateAll((icons) => icons.map((icon) => icon.getBoundingClientRect().width))
  expect(sizes).toEqual([16, 16, 16, 16])
})
