import { slideListCopy } from "../../bin/product-copy.mjs"
import { editor } from "../editor-screen.mjs"
import { hiddenGrid } from "./slide-grid-hidden.mjs"

export default {
  name: "slides-hidden",
  design: editor,
  async drive(kit) {
    await hiddenGrid(kit)
    await kit.page.getByRole("button", { name: slideListCopy.listName, exact: true }).click()
    await kit.expect(kit.page.locator("[data-editor-sidebar]")).toBeVisible()
  },
}
