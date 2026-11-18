import { pictureCopy, undoCopy } from "../../bin/product-copy.mjs"
import path from "node:path"
import { expect } from "@playwright/test"
import { openDeck } from "../open-deck.mjs"
import { unfold } from "../unfold.mjs"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures/picture-png.pptx"))
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  await kit.page
    .locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#4"]')
    .click({ position: { x: 8, y: 8 } })
  const panel = kit.page.locator("[data-design-element]")
  await expect(panel).toBeVisible()
  await unfold(panel, pictureCopy.section)
  const picture = panel
    .locator("section")
    .filter({ has: kit.page.getByRole("heading", { name: pictureCopy.section, exact: true }) })
  if ((await picture.count()) === 0) return
  await picture.getByRole("group", { name: "Recolor", exact: true }).getByRole("button", { name: "Grayscale" }).click()
  await expect(kit.page.getByRole("button", { name: undoCopy.undoNamed.picture, exact: true })).toBeVisible()
  await unfold(panel, "Name and alt text")
  await panel.getByRole("heading", { name: "Name and alt text", exact: true }).scrollIntoViewIfNeeded()
}

export default { name: "design-picture", design: "/screens/s43-09-editor-tools-design-element", drive }
