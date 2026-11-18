import path from "node:path"
import { pathToFileURL } from "node:url"
import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  const { fillCopy, fillWords } = await import(
    pathToFileURL(path.join(kit.repo, "apps/web/src/copy/fill-copy.ts")).href
  )
  await fixtureDeck(kit)
  const { page } = kit
  await page.getByRole("button", { name: "Design", exact: true }).click()
  const element = page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#2"]')
  await element.click({ position: { x: 4, y: 4 } })
  const panel = page.locator("[data-design-element]")
  await panel
    .getByRole("group", { name: fillCopy.value, exact: true })
    .getByRole("button", { name: fillWords.gradient, exact: true })
    .click()
  await expect(element.locator("[data-run]").first()).toHaveCSS("background-clip", "text")
}

export default { name: "text-fill", design: "/screens/s43-09-editor-tools-design-element", drive }
