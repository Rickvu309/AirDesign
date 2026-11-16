import { expect } from "@playwright/test"
import { textToolbarAt } from "../element-window.mjs"

async function drive(kit) {
  await textToolbarAt(kit, { width: 1470, height: 923 })
  await kit.page.getByRole("button", { name: "Shapes", exact: true }).click()
  const line = kit.page.locator("[data-shape-tray]").getByRole("button", { name: "Line", exact: true })
  await line.focus()
  await expect(line).toBeFocused()
}

export default { name: "shape-tray-text-focused", design: null, drive }
