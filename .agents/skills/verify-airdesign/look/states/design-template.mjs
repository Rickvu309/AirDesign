import { expect } from "@playwright/test"
import { designing, slidePanel } from "../doom-design.mjs"

async function drive(kit) {
  await designing(kit)
  await expect(kit.page.getByRole("combobox", { name: /^Change theme/ })).toBeVisible()
}

export default { name: "design-template", design: slidePanel, drive }
