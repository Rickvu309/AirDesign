import { expect } from "@playwright/test"
import { readPictureToolCopy } from "../../bin/product-copy.mjs"
import element from "./design-element.mjs"

async function drive(kit) {
  await element.drive(kit)
  await kit.page.getByRole("button", { name: readPictureToolCopy().addIcon, exact: true }).click()
  const field = kit.page.getByRole("searchbox")
  await kit.page.keyboard.press("Tab")
  await field.focus()
  await expect(field).toBeFocused()
}

export default { name: "icon-search-focus", design: null, drive }
