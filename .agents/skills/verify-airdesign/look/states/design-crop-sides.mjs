import path from "node:path"
import { expect } from "@playwright/test"
import { openDeck } from "../open-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.goto("/")
  await openDeck(page, path.join(kit.repo, "scripts/pptx-fixtures/picture-png.pptx"))
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await page
    .locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#4"]')
    .click({ position: { x: 8, y: 8 } })
  const crop = page
    .locator("[data-design-element] section")
    .filter({ has: page.getByRole("heading", { name: "Crop", exact: true }) })
  const right = crop.getByRole("textbox", { name: "Right", exact: true })
  await crop.scrollIntoViewIfNeeded()
  await crop.getByRole("textbox", { name: "Left", exact: true }).focus()
  await page.keyboard.press("ControlOrMeta+A")
  await page.keyboard.type("10")
  await page.keyboard.press("Enter")
  await page.keyboard.press("Tab")
  await page.keyboard.press("Tab")
  await page.keyboard.press("ControlOrMeta+A")
  await page.keyboard.type("10")
  await page.keyboard.press("Enter")
  await expect(right).toHaveValue("10")
  await expect(page.getByRole("button", { name: "Undo crop", exact: true })).toBeVisible()
}

export default { name: "design-crop-sides", design: "/screens/s43-09-editor-tools-design-element", drive }
