import { expect } from "@playwright/test"
import home from "./home-wide.mjs"

async function drive(kit) {
  await home.drive(kit)
  const field = kit.page.getByRole("searchbox")
  await kit.page.keyboard.press("Tab")
  await field.focus()
  await expect(field).toBeFocused()
}

export default { name: "decks-search-focus", design: home.design, drive }
