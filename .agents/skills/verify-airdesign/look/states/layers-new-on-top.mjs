import path from "node:path"
import { expect } from "@playwright/test"
import { shapeCopy, transitionCopy } from "../../bin/product-copy.mjs"
import { openDeck } from "../open-deck.mjs"

const rectangle = '[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#2"]'
const words = "Market grows 12% a year"

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"])
  await page.goto(".")
  await openDeck(page, path.join(kit.repo, "scripts/pptx-fixtures/sections-before.pptx"))
  const selection = page.locator("[data-slide-paint] [data-selection]")
  await page.locator(rectangle).click()
  await expect(selection).toHaveAttribute("data-selection", "256.2")
  await page.keyboard.press("ControlOrMeta+KeyC")
  await page.getByRole("button", { name: "Add slide", exact: true }).click()
  const entry = page.locator('[data-slide-entry="2"]')
  await expect(entry).toHaveAttribute("aria-current", "true")
  await page.locator("[data-slide-paint]").focus()
  await page.keyboard.press("ControlOrMeta+KeyV")
  await expect(selection).toHaveAttribute("data-selection", "258.2")
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: shapeCopy.shapes.square, exact: true }).click()
  await expect(page.locator("[data-shape-tray]")).toHaveCount(0)
  await page.getByRole("button", { name: "Add text", exact: true }).click()
  const slide = await page.locator("[data-slide-paint]").boundingBox()
  if (slide === null) throw new Error("no slide")
  await page.mouse.click(slide.x + slide.width * 0.3, slide.y + slide.height * 0.85)
  await expect(page.locator('[data-slide-paint] [contenteditable="true"]:focus')).toHaveCount(1)
  await page.keyboard.type(words)
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await page.locator("[data-design-mode]").click()
  const layers = page.locator("[data-layers-panel]")
  await expect(layers.getByRole("treeitem")).toHaveCount(3)
  await expect(layers.getByRole("treeitem").first()).toHaveAccessibleName(words)
}

export default { name: "layers-new-on-top", design: "/screens/s43-10-editor-tools-layers", drive }
