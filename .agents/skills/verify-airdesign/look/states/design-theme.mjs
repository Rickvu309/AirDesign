import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit, "clean.pptx")
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  await expect(kit.page.locator("[data-design-panel]")).toBeVisible()
  const theme = kit.page.locator("[data-design-theme]")
  if ((await theme.count()) === 0) return
  await theme.getByLabel("Accent 1", { exact: true }).fill("#c00000")
  await expect(kit.page.getByRole("button", { name: "Undo theme color", exact: true })).toBeVisible()
  await theme.scrollIntoViewIfNeeded()
}

export default { name: "design-theme", design: "/screens/s43-02-editor-tools-design-panel", drive }
