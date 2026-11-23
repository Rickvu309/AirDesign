import { geometryCopy } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"
import { designing, dropPicture, element, selectMany } from "../doom-design.mjs"

async function drive(kit) {
  await designing(kit)
  await selectMany(kit.page, [await dropPicture(kit)])
  await expect(
    kit.page.locator("[data-design-element]").getByRole("textbox", { name: geometryCopy.corners, exact: true }),
  ).toBeVisible()
}

export default { name: "design-corners-picture", design: element, drive }
