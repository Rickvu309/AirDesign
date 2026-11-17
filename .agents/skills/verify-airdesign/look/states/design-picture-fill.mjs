import path from "node:path"
import { expect } from "@playwright/test"
import { openDeck } from "../open-deck.mjs"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures/picture-png.pptx"))
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  await kit.page
    .locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#4"]')
    .click({ position: { x: 8, y: 8 } })
  await expect(kit.page.locator("[data-design-element]")).toBeVisible()
}

export default {
  name: "design-picture-fill",
  design: "/screens/s43-09-editor-tools-design-element",
  drive,
}
