import { expect } from "@playwright/test"
import { frameCopy } from "../../bin/product-copy.mjs"
import { reachPanel } from "../panel-kinds.mjs"

const shape = (number) => `[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#${number}"]`

async function drive(kit) {
  const { page } = kit
  await reachPanel(kit, "frame", "slides")
  const panel = page.locator("[data-design-panel]")
  await panel.getByRole("button", { name: frameCopy.removeAutoLayout }).click()
  await expect(panel.getByText(frameCopy.frame, { exact: true })).toBeVisible()
  await page.locator(shape(5)).click({ position: { x: 8, y: 8 } })
  await expect(page.locator("[data-slide-paint] [data-grip]").first()).toBeVisible()
  await page.mouse.move(4, 4)
}

export default { name: "frame-child", design: null, drive }
