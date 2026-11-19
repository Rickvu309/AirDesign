import { fillWords } from "../../bin/product-copy.mjs"
import fill from "./design-fill.mjs"

async function drive(kit) {
  await fill.drive(kit)
  const panel = kit.page.locator("[data-design-element]")
  const type = panel.getByRole("combobox", { name: fillWords.shade, exact: true })
  if ((await type.count()) === 0) return
  await type.click()
  const option = kit.page.getByRole("option", { name: fillWords.diamond, exact: true })
  await option.click()
  await panel.locator("[data-gradient-preview]").scrollIntoViewIfNeeded()
}

export default { ...fill, name: "design-fill-diamond", drive }
