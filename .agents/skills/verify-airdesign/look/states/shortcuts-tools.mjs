import { expect } from "@playwright/test"
import { shortcutCopy } from "../../bin/product-copy.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit)
  await kit.page.keyboard.press("Control+Shift+?")
  const panel = kit.page.getByRole("region", { name: shortcutCopy.title, exact: true })
  await expect(panel).toBeVisible()
  await panel.getByRole("button", { name: shortcutCopy.groups.tools, exact: true }).click()
}

export default { name: "shortcuts-tools", design: "/screens/s43-11-editor-tools-keyboard-shortcuts", drive }
