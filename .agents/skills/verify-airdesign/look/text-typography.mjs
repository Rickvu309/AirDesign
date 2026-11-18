import path from "node:path"
import { createRequire } from "node:module"
import { expect } from "@playwright/test"
import { openDeck } from "./open-deck.mjs"
import { readFile } from "node:fs/promises"

export async function textTypography(kit, control) {
  const { page, repo } = kit
  const require = createRequire(import.meta.url)
  const { textCopy } = require(path.join(repo, "apps/web/src/copy/text-copy.ts"))
  const { placeholderRoles } = require(path.join(repo, "apps/web/src/copy/placeholder-copy.ts"))
  await kit.signIn()
  await page.goto("/")
  await openDeck(page, {
    name: "Text.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await readFile(path.join(repo, "scripts/pptx-fixtures/doe-heat-pumps.pptx")),
  })
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await page
    .locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#2"]')
    .click({ position: { x: 4, y: 4 } })
  const panel = page.locator("[data-design-element]")
  const style = panel.getByRole("combobox", { name: textCopy.style, exact: true })
  await style.click()
  await page.getByRole("option", { name: `${placeholderRoles.ctrTitle} · 44`, exact: true }).click()
  await expect(style).toContainText(placeholderRoles.ctrTitle)
  if (control === "weight") {
    const font = panel.getByRole("textbox", { name: textCopy.font, exact: true })
    await font.fill("Lato")
    await font.press("Enter")
  }
  if (control === "sizes") await panel.getByRole("button", { name: textCopy.sizes, exact: true }).click()
  else await panel.getByRole("combobox", { name: textCopy[control], exact: true }).click()
}
