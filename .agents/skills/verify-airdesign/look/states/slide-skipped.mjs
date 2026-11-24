import { expect } from "@playwright/test"
import { slideListCopy } from "../../bin/product-copy.mjs"
import { editor } from "../editor-screen.mjs"
import { threeSlideDeck } from "../three-slide-deck.mjs"

async function drive(kit) {
  await threeSlideDeck(kit)
  const page = kit.page
  const entry = page.locator('[data-slide-entry="2"]')
  await entry.click({ button: "right" })
  const item = page.getByRole("menuitem", { name: slideListCopy.skip })
  await expect(item).toBeVisible()
  await item.click()
  await expect(entry).toHaveAttribute("data-slide-skipped", /.*/)
  await expect(page.getByRole("menu")).toBeHidden()
}

export default { name: "slide-skipped", design: editor, drive }
