import { productCopy } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  const button = kit.page.getByRole("button", { name: productCopy.newDeck, exact: true })
  await expect(button).toBeVisible()
  await button.focus()
  await kit.page.keyboard.press("Enter")
  await expect(kit.page.getByRole("menuitem", { name: productCopy.blankDeck, exact: true })).toBeFocused()
  await kit.page.keyboard.press("ArrowDown")
  await expect(kit.page.getByRole("menuitem", { name: "Import PowerPoint" })).toBeFocused()
}

export default { name: "new-deck-menu-focused", design: "/screens/s32-01-decks-new-deck-menu-open", drive }
