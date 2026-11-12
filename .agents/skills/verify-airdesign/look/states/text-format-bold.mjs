import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit)
  const text = kit.page.locator('[data-slide-paint] [contenteditable="true"]')
  await text.click()
  await text.press("ControlOrMeta+a")
  await text.pressSequentially("Hello world")
  await text
    .locator("[data-run]")
    .first()
    .evaluate((run) => {
      const words = run.firstChild
      if (words !== null) window.getSelection()?.setBaseAndExtent(words, 6, words, 11)
    })
  const bold = kit.page.getByRole("group", { name: "Text format" }).getByRole("button", { name: "Bold" })
  await bold.click()
  await expect(bold).toHaveAttribute("aria-pressed", "true")
}

export default { name: "text-format-bold", design: "/screens/s43-08-editor-tools-text-format", drive }
