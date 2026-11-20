import { expect } from "@playwright/test"
import { chartCopy } from "../../bin/product-copy.mjs"
import { designElementAt } from "../element-window.mjs"

async function drive(kit) {
  await designElementAt(kit, { width: 1470, height: 923 })
  await kit.page.locator('[data-slide-paint] [contenteditable="true"]').click()
  await expect(kit.page.locator("[data-editor-toolbar]").getByRole("button", { name: chartCopy.tool })).toBeVisible()
}

export default { name: "text-toolbar-design", design: null, drive }
