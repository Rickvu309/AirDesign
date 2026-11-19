import path from "node:path"
import { expect } from "@playwright/test"
import { openDeck } from "../open-deck.mjs"
import { pictureCopy, pictureWords, transitionCopy } from "../../bin/product-copy.mjs"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures/picture-png.pptx"))
  await kit.page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const picture = kit.page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#4"]')
  await picture.click({ position: { x: 8, y: 8 } })
  const panel = kit.page.locator("[data-design-element]")
  await expect(panel).toBeVisible()
  await panel.getByRole("combobox", { name: pictureCopy.mode, exact: true }).click()
  await kit.page.getByRole("option", { name: pictureWords.crop, exact: true }).click()
  await picture.dblclick()
  await kit.page
    .locator("[data-crop-handle]")
    .first()
    .waitFor({ timeout: 3000 })
    .catch(() => undefined)
}

export default {
  name: "design-picture-crop",
  design: "/screens/s43-09-editor-tools-design-element",
  drive,
}
