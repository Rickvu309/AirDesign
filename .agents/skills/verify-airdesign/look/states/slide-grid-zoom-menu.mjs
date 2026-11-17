import { createRequire } from "node:module"
import { expect } from "@playwright/test"
import slideGrid from "./slide-grid.mjs"

const { zoomCopy } = createRequire(import.meta.url)("../../../../../apps/web/src/copy/product-copy.ts")

async function drive(kit) {
  await slideGrid.drive(kit)
  await kit.page.locator("[data-editor-grid] [data-zoom-readout]").click()
  await expect(kit.page.getByRole("textbox", { name: zoomCopy.field })).toBeFocused()
}

export default { name: "slide-grid-zoom-menu", design: slideGrid.design, drive }
