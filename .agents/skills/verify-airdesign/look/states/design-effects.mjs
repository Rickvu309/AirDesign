import path from "node:path"
import { expect } from "@playwright/test"
import { openDeck } from "../open-deck.mjs"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures/corpus/nasa-cots-electronics.pptx"), 7)
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  await kit.page
    .locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide7.xml#4"]')
    .click({ position: { x: 4, y: 4 } })
  const panel = kit.page.locator("[data-design-element]")
  await expect(panel).toBeVisible()
  const effects = panel
    .locator("section")
    .filter({ has: kit.page.getByRole("heading", { name: "Effects", exact: true }) })
  if ((await effects.count()) === 0) return
  await effects.getByRole("group", { name: "Glow", exact: true }).getByRole("button", { name: "Glow" }).click()
  await expect(kit.page.getByRole("button", { name: "Undo effects", exact: true })).toBeVisible()
  await effects.getByRole("heading", { name: "Effects", exact: true }).scrollIntoViewIfNeeded()
}

export default { name: "design-effects", design: "/screens/s43-09-editor-tools-design-element", drive }
