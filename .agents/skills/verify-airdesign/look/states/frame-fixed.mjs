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
  await page.locator(element(4)).click()
  const width = page.locator("[data-design-panel]").getByRole("combobox", { name: frameCopy.width, exact: true })
  await expect(width).toBeVisible()
  const hugging = (await width.textContent()) ?? ""
  const grip = await page.locator("[data-selection] [data-grip='right']").boundingBox()
  if (grip === null) throw new Error("no right grip")
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(grip.x + grip.width / 2 + 160, grip.y + grip.height / 2, { steps: 12 })
  await page.mouse.up()
  await expect(width).not.toHaveText(hugging)
  await page
    .locator("[data-design-panel]")
    .getByRole("button", { name: layoutWords["layout.align.top"], exact: true })
    .click()
  await page.mouse.move(4, 4)
}

export default { name: "frame-fixed", design: editor, drive }
