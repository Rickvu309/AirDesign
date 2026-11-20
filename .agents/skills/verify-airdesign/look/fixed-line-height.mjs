import path from "node:path"
import { createRequire } from "node:module"
import { expect } from "@playwright/test"
import { transitionCopy } from "../bin/product-copy.mjs"
import { fixtureDeck } from "./fixture-deck.mjs"

export async function lineHeightField(kit) {
  const { page, repo } = kit
  const { textCopy } = createRequire(import.meta.url)(path.join(repo, "apps/web/src/copy/text-copy.ts"))
  await fixtureDeck(kit)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await page
    .locator("[data-slide-paint] [data-canvas-element]")
    .first()
    .click({ position: { x: 4, y: 4 } })
  return page.locator("[data-design-element]").getByRole("textbox", { name: textCopy.lineHeight, exact: true })
}

export async function fixedLineHeight(kit) {
  const line = await lineHeightField(kit)
  await line.fill("24pt")
  await line.press("Enter")
  await expect(line).toHaveValue("24")
}
