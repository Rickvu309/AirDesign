import { expect } from "@playwright/test"
import { test } from "./deck-test"
import { productCopy } from "../../apps/web/src/copy/product-copy"

test("each Account preference names its choice by its row", async ({ page }) => {
  await page.goto("/screens/s81-03-settings-settings-account-tab")
  await expect(page.getByRole("combobox", { name: "Language" })).toMatchAriaSnapshot('- combobox "Language": English')
  await expect(page.getByRole("combobox", { name: "Slide size" })).toMatchAriaSnapshot('- combobox "Slide size": 16:9')
})

test("the warning dialog's Close sits at the same inset as its warning tile", async ({ page }) => {
  await page.goto("/screens/s33-03-decks-trash-empty-trash-confirm")
  const dialog = page.getByRole("dialog")
  const close = dialog.getByRole("button", { name: productCopy.close })
  const frame = await dialog.boundingBox()
  const button = await close.boundingBox()
  if (!frame || !button) throw new Error("the dialog or its Close has no box")
  expect(button.y - frame.y).toBe(24)
  expect(frame.x + frame.width - (button.x + button.width)).toBe(24)
})
