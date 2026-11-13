import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { threeSlideDeck } from "../three-slide-deck.mjs"

async function drive(kit) {
  await threeSlideDeck(kit)
  const actions = kit.page.getByRole("button", { name: "Slide 2 actions" })
  if ((await actions.count()) === 0) return
  await actions.click()
  await expect(kit.page.getByRole("menu")).toBeVisible()
}

export default { name: "slide-actions-menu", design: editor, drive }
