import { fillCopy, fillWords } from "../../../../../apps/web/src/copy/fill-copy.ts"
import { formatCopy } from "../../../../../apps/web/src/copy/format-copy.ts"
import { opacityCopy } from "../../../../../apps/web/src/copy/opacity-copy.ts"
import path from "node:path"
import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"
import { openDeck } from "../open-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await fixtureDeck(kit, "shapes-added.pptx")
  await page.getByRole("button", { name: "Design", exact: true }).click()
  const shape = page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#4"]')
  await shape.click({ position: { x: 4, y: 4 } })
  const panel = page.locator("[data-design-element]")
  const opacity = panel.getByRole("textbox", { name: opacityCopy.label, exact: true })
  await opacity.fill("60")
  await opacity.press("Enter")
  await expect(opacity).toHaveValue("60")
  const saving = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export" }).click()
  const file = path.join(kit.out, "own-alpha.pptx")
  await (await saving).saveAs(file)
  await page.goto("/")
  await openDeck(page, file)
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await shape.click({ position: { x: 4, y: 4 } })
  await panel.getByRole("button", { name: fillCopy.reset, exact: true }).click()
  await panel.getByRole("group", { name: fillWords.color, exact: true }).getByRole("button").first().click()
  await page
    .locator("[data-color-picker]")
    .getByRole("button", { name: formatCopy.colors.accent2, exact: true })
    .click()
  await page.keyboard.press("Escape")
  const fold = panel.getByRole("heading", { name: opacityCopy.label, exact: true }).getByRole("button")
  await fold.click()
  await fold.click()
}

export default { name: "design-reset-fill-picked", design: "/screens/s43-09-editor-tools-design-element", drive }
