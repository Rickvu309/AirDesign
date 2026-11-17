import { expect } from "@playwright/test"
import { productCopy } from "../../bin/product-copy.mjs"
import ask from "./account-delete-ask.mjs"

async function drive(kit) {
  await ask.drive(kit)
  const cancel = kit.page.getByRole("dialog").getByRole("button", { name: productCopy.cancel, exact: true })
  await expect(cancel).toBeFocused()
  const field = kit.page.getByRole("dialog").getByRole("textbox")
  await cancel.press("Shift+Tab")
  await expect(field).toBeFocused()
}

export default { name: "account-delete-focus", design: null, drive }
