import { createRequire } from "node:module"
import path from "node:path"
import { expect } from "@playwright/test"
import { toolbarWords } from "../../bin/color-words.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"
import { openDeck } from "../open-deck.mjs"
import { setPanelMode } from "../panel-mode.mjs"

const require = createRequire(import.meta.url)
const { fillCopy, fillWords } = require("../../../../../apps/web/src/copy/fill-copy.ts")
const { opacityCopy } = require("../../../../../apps/web/src/copy/opacity-copy.ts")

async function drive(kit) {
  const { page } = kit
  await fixtureDeck(kit, "shapes-added.pptx")
  const menu = await toolbarWords(kit.repo, "shapes-added.pptx")
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
  await setPanelMode(page, "design")
  const details = panel.locator("[data-fill-details]")
  const fold = details.getByRole("button").first()
  if ((await fold.getAttribute("aria-expanded")) !== "true") await fold.click()
  await panel.getByRole("button", { name: fillCopy.reset, exact: true }).click()
  await panel.getByRole("group", { name: fillWords.color, exact: true }).getByRole("button").first().click()
  await page.locator("[data-color-picker]").getByRole("button", { name: menu.accent2, exact: true }).click()
  await page.keyboard.press("Escape")
}

export default { name: "design-reset-fill-picked", design: "/screens/s43-09-editor-tools-design-element", drive }
