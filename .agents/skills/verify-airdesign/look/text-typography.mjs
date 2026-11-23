import { expect } from "@playwright/test"
import { designing, selectMany } from "./doom-design.mjs"

const opens = { fonts: "Fonts", style: "Text style", weight: "Weight" }

export async function textTypography(kit, control) {
  const { page } = kit
  await designing(kit, "text")
  await selectMany(page, ["w:1"])
  const panel = page.locator("[data-design-element]")
  const style = panel.getByRole("combobox", { name: "Text style", exact: true })
  await style.click()
  await page.getByRole("option", { name: /^Title\b/ }).click()
  await expect(style).toContainText("Title")
  if (control === "weight") {
    const font = panel.getByRole("textbox", { name: "Font", exact: true })
    const manifest = page.waitForResponse((response) => response.url().includes("family=Lato"))
    await font.fill("Lato")
    await manifest
    await font.press("Enter")
  }
  if (control === "sizes") await panel.getByRole("button", { name: "Font sizes", exact: true }).click()
  else await panel.getByRole("combobox", { name: opens[control], exact: true }).click()
}
