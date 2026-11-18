import { expect } from "@playwright/test"
import { fillCopy, fillWords } from "../../bin/product-copy.mjs"
import { reachPanel } from "../panel-kinds.mjs"

async function drive(kit) {
  await reachPanel(kit, "picture", "design")
  const { page } = kit
  const fill = page
    .locator("[data-design-element] section")
    .filter({ has: page.getByRole("heading", { name: fillCopy.section, exact: true }) })
  await fill.getByRole("button", { name: fillCopy.add, exact: true }).click()
  await page.getByRole("menuitem").filter({ hasText: fillWords.gradient }).click()
  const up = `${fillCopy.paint(0, 2)} ${fillWords.up.toLowerCase()}`
  await expect(fill.getByRole("button", { name: up, exact: true })).toBeVisible()
  await page.mouse.move(4, 4)
}

export default { name: "panel-picture-fills", design: null, drive }
