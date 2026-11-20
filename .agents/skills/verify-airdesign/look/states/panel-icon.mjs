import { expect } from "@playwright/test"
import { readPictureToolCopy, transitionCopy } from "../../bin/product-copy.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"
import { setPanelMode } from "../panel-mode.mjs"

async function drive(kit) {
  await fixtureDeck(kit, "picture-png.pptx")
  const { page } = kit
  const tools = readPictureToolCopy()
  await page.getByRole("button", { name: tools.addIcon, exact: true }).click()
  await page.locator("[data-icon-tool]").getByRole("searchbox", { name: tools.search }).fill("rocket")
  await page.locator("[data-icon-tool]").getByRole("button", { name: "rocket", exact: true }).click()
  const icon = page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#5"]')
  await expect.poll(() => icon.evaluate((node) => getComputedStyle(node).backgroundImage)).toContain("url(")
  const design = page.getByRole("button", { name: transitionCopy.design, exact: true })
  if ((await design.getAttribute("aria-pressed")) !== "true") await design.click()
  await setPanelMode(page, "slides")
  await icon.click()
  await expect(page.locator("[data-design-element]")).toHaveAttribute("data-design-element", /\.5$/)
  await page.mouse.move(4, 4)
  await page.locator("[data-design-panel]").evaluate((panel) => {
    panel.scrollTop = 0
  })
}

export default { name: "panel-icon", design: null, drive }
