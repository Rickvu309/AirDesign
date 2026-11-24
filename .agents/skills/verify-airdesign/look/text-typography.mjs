import { expect } from "@playwright/test"
import { designing, selectMany } from "./doom-design.mjs"

const opens = { style: "Text style", weight: "Weight" }

export async function textTypography(kit, control) {
  const { page } = kit
  await designing(kit, "text")
  await selectMany(page, ["w:1"])
  const panel = page.locator("[data-design-element]")
  const style = panel.getByRole("combobox", { name: "Text style", exact: true })
  await style.click()
  await page.getByRole("option", { name: /^Title\b/ }).click()
  await expect(style).toContainText("Title")
  if (control === "sizes") await panel.getByRole("button", { name: "Font sizes", exact: true }).click()
  else await panel.getByRole("combobox", { name: opens[control], exact: true }).click()
}
