import { expect } from "@playwright/test"
import { toolbarWords } from "../../bin/color-words.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit)
  const menu = await toolbarWords(kit.repo, "clean.pptx")
  const text = kit.page.locator('[data-slide-paint] [contenteditable="true"]')
  await text.click()
  await text.press("ControlOrMeta+a")
  await kit.page.getByRole("button", { name: "Text color" }).click()
  await expect(
    kit.page.locator("[data-color-picker]").getByRole("button", { name: menu.accent1, exact: true }),
  ).toBeVisible()
}

export default { name: "text-format-color", design: "/screens/s43-08-editor-tools-text-format", drive }
