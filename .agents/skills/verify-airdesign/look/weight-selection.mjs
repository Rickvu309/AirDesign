import path from "node:path"
import { createRequire } from "node:module"
import { readFile } from "node:fs/promises"
import { expect } from "@playwright/test"
import { openDeck } from "./open-deck.mjs"

export async function titleOpened(kit) {
  const { page, repo } = kit
  const require = createRequire(import.meta.url)
  const { textCopy } = require(path.join(repo, "apps/web/src/copy/text-copy.ts"))
  const { transitionCopy } = require(path.join(repo, "apps/web/src/copy/transition-copy.ts"))
  await kit.signIn()
  await page.goto("/")
  await openDeck(page, {
    name: "Weights.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await readFile(path.join(repo, "scripts/pptx-fixtures/doe-heat-pumps.pptx")),
  })
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const canvas = page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#2"]')
  await canvas.click({ position: { x: 4, y: 4 } })
  const panel = page.locator("[data-design-element]")
  const font = panel.getByRole("textbox", { name: textCopy.font, exact: true })
  const weight = panel.getByRole("combobox", { name: textCopy.weight, exact: true })
  const fonts = panel.getByRole("combobox", { name: textCopy.fonts, exact: true })
  const shows = (name) => expect(weight).toHaveText(new RegExp(`^${name}\\W*$`))
  const typed = async (name) => {
    const manifest = page.waitForResponse((response) => response.url().includes(`family=${name}`))
    await font.fill(name)
    await manifest
    await font.press("Enter")
  }
  const listed = async (name) => {
    await fonts.click()
    await page.getByRole("option", { name, exact: true }).click()
  }
  const pick = async (name) => {
    await weight.click()
    await page.getByRole("option", { name, exact: true }).click()
  }
  return { canvas, weight, shows, typed, listed, pick, textCopy }
}

export async function selectedWordWeight(kit) {
  const { page } = kit
  const opened = await titleOpened(kit)
  await opened.typed("Inter")
  await opened.canvas.dblclick()
  const text = opened.canvas.locator('[contenteditable="true"]')
  await expect(text).toBeFocused()
  await page.keyboard.press("ControlOrMeta+Home")
  await page.keyboard.press("Shift+ControlOrMeta+ArrowRight")
  await page.keyboard.press("Control+Alt+Shift+Period")
  await page.keyboard.press("Control+Alt+Shift+Period")
  await opened.shows("SemiBold")
  return { ...opened, text }
}
