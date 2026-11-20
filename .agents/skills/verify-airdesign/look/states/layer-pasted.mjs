import path from "node:path"
import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { openDeck } from "../open-deck.mjs"

const rectangle = '[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#2"]'
const pasted = '[data-slide-paint] [data-canvas-element="ppt/slides/slide2.xml#9"]'

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"])
  await page.goto(".")
  await openDeck(page, path.join(kit.repo, "scripts/pptx-fixtures/sections-before.pptx"))
  await page.locator(rectangle).click()
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveCount(1)
  await page.keyboard.press("ControlOrMeta+KeyC")
  const entry = page.locator('[data-slide-entry="2"]')
  await entry.click()
  await expect(entry).toHaveAttribute("aria-current", "true")
  await page.locator("[data-slide-paint]").focus()
  await page.keyboard.press("ControlOrMeta+KeyV")
  await page
    .locator(pasted)
    .waitFor({ timeout: 5_000 })
    .catch(() => undefined)
}

export default { name: "layer-pasted", design: editor, drive }
