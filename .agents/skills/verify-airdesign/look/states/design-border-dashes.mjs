import { borderCopy } from "../../bin/product-copy.mjs"
import border from "./design-border.mjs"

async function drive(kit) {
  await border.drive(kit)
  const menu = kit.page.getByRole("combobox", { name: borderCopy.dash, exact: true })
  await menu.click()
  const custom = kit.page.getByRole("option", { name: borderCopy.custom, exact: true })
  if (!(await custom.isVisible())) return
  await custom.click()
  const dashes = kit.page.getByRole("textbox", { name: borderCopy.dashes, exact: true })
  await dashes.fill("16, 8, 4, 8")
  await dashes.press("Enter")
  await dashes.scrollIntoViewIfNeeded()
}

export default { ...border, name: "design-border-dashes", drive }
