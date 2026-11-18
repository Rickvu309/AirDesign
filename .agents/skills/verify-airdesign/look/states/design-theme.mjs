import { templateCopy, formatCopy } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"
import { colorCopy } from "../../bin/product-copy.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit, "clean.pptx")
  await kit.page.getByRole("button", { name: "Design", exact: true }).click()
  await expect(kit.page.locator("[data-design-panel]")).toBeVisible()
  const settings = kit.page.getByRole("button", { name: templateCopy.editTemplateStyle, exact: true })
  if (await settings.count()) await settings.click()
  else if (await kit.page.locator("[data-template-style]").count())
    await kit.page.locator("[data-template-style]").click()
  const theme = kit.page.locator("[data-template-style-dialog]")
  if ((await theme.count()) === 0) return
  await theme.getByRole("button", { name: formatCopy.colors.accent1, exact: true }).click()
  const picker = kit.page.locator("[data-color-picker]")
  await picker.getByRole("button", { name: colorCopy.add, exact: true }).click()
  const hex = picker.getByRole("textbox", { name: colorCopy.hex, exact: true })
  await hex.fill("#c00000")
  await hex.press("Enter")
  await kit.page.keyboard.press("Escape")
  await expect(theme.getByRole("button", { name: formatCopy.colors.accent1, exact: true })).toHaveAttribute(
    "title",
    /#C00000/i,
  )
  await theme.scrollIntoViewIfNeeded()
}

export default { name: "design-theme", design: "/screens/s43-02-editor-tools-design-panel", drive }
