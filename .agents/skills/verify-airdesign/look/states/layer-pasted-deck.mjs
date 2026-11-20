import path from "node:path"
import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { openDeck } from "../open-deck.mjs"

const picture = '[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#4"]'
const pasted = '[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#3"]'

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"])
  await page.goto(".")
  await openDeck(page, path.join(kit.repo, "scripts/pptx-fixtures/picture-png.pptx"))
  await page.locator(picture).click()
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveCount(1)
  await page.keyboard.press("ControlOrMeta+KeyC")
  await page.goto(".")
  await openDeck(page, path.join(kit.repo, "scripts/pptx-fixtures/clean.pptx"))
  await page.locator("[data-slide-paint]").focus()
  await page.keyboard.press("ControlOrMeta+KeyV")
  await page
    .locator(pasted)
    .waitFor({ timeout: 5_000 })
    .catch(() => undefined)
}

export default { name: "layer-pasted-deck", design: editor, drive }
