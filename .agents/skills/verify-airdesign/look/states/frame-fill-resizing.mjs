import { expect } from "@playwright/test"
import { frameCopy, layoutWords, transitionCopy } from "../../bin/product-copy.mjs"
import { editor } from "../editor-screen.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"
import { setPanelMode } from "../panel-mode.mjs"

const element = (shape) => `[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#${shape}"]`

async function drive(kit) {
  const { page } = kit
  await fixtureDeck(kit, "frame.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await setPanelMode(page, "design")
  const selection = page.locator("[data-slide-paint] [data-selection]")
  await page.locator(element(5)).click()
  await page.locator(element(5)).dblclick()
  await expect(selection).toHaveAttribute("data-selection", /\.5$/)
  await page.locator("[data-design-panel]").getByRole("combobox", { name: frameCopy.width, exact: true }).click()
  await page.getByRole("option", { name: layoutWords["width.fill"], exact: true }).click()
  await page.keyboard.press("Escape")
  await expect(selection).not.toHaveAttribute("data-selection", /\.5$/)
  const grip = await page.locator("[data-selection] [data-grip='right']").boundingBox()
  if (grip === null) throw new Error("no right grip")
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(grip.x + grip.width / 2 + 160, grip.y + grip.height / 2, { steps: 12 })
  await page.waitForTimeout(300)
}

export default { name: "frame-fill-resizing", design: editor, drive }
