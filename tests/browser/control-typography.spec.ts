import { expect, test } from "@playwright/test"
import { placeholderRoles } from "../../apps/web/src/copy/placeholder-copy"
import { textCopy } from "../../apps/web/src/copy/text-copy"
import { designing, openDeck } from "./design-panel"

test("applying a template style names the style and repaints the text in its typeface", async ({ page }) => {
  await openDeck(page, "doe-heat-pumps.pptx")
  const element = page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#2"]')
  const panel = await designing(page, element)
  const style = panel.getByRole("combobox", { name: textCopy.style, exact: true })
  await style.click()
  await page.getByRole("option", { name: `${placeholderRoles.ctrTitle} · 44`, exact: true }).click()
  await expect(style).toContainText(placeholderRoles.ctrTitle)
  await expect(element.locator("[data-run]").first()).toHaveCSS("font-family", /Calibri Light/)
})
