import { expect } from "@playwright/test"
import { designing } from "../doom-design.mjs"

async function drive(kit) {
  await designing(kit, "text", "shape")
  await kit.page.getByRole("combobox", { name: /^Change theme/ }).press("Enter")
  await expect(kit.page.getByRole("listbox")).toBeVisible()
}

export default { name: "design-theme-options", design: null, drive }
