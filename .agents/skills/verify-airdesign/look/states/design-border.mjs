import { group } from "../doom-deck.mjs"
import { appearanceCopy, fillWords } from "../../bin/product-copy.mjs"
import { designing, element, selectMany } from "../doom-design.mjs"

export async function bordered(kit, kind = fillWords.solid) {
  const { page } = kit
  await designing(kit, "shape")
  await selectMany(page, ["w:2"])
  const panel = page.locator("[data-design-element]")
  await group(panel, appearanceCopy.border).getByRole("button", { name: kind, exact: true }).click()
  await panel.getByRole("heading", { name: appearanceCopy.border, exact: true }).scrollIntoViewIfNeeded()
}

export default { name: "design-border", design: element, drive: (kit) => bordered(kit) }
