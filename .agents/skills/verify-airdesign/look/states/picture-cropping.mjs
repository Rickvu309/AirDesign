import path from "node:path"
import { expect } from "@playwright/test"
import { openDeck } from "../open-deck.mjs"
import { pictureCopy, pictureWords, transitionCopy } from "../../bin/product-copy.mjs"

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.goto("/")
  await openDeck(page, path.join(kit.repo, "scripts/pptx-fixtures/picture-png.pptx"))
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const picture = page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#4"]')
  await picture.click({ position: { x: 8, y: 8 } })
  const mode = page.locator("[data-design-element]").getByRole("combobox", { name: pictureCopy.mode, exact: true })
  await expect(mode).toContainText(pictureWords.fill)
  const box = await picture.boundingBox()
  await page.mouse.move(box.x + box.width, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width + 250, box.y + box.height / 2, { steps: 8 })
  await page.mouse.up()
  const wide = await picture.boundingBox()
  await picture.dblclick({ position: { x: wide.width / 2, y: wide.height / 2 } })
  await page.waitForFunction(() => document.activeElement !== document.body)
}

export default { name: "picture-cropping", design: "/screens/s43-09-editor-tools-design-element", drive }
