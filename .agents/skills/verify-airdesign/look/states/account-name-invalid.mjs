import { expect } from "@playwright/test"
import { accountCopy } from "../../bin/product-copy.mjs"
import focus from "./account-name-focus.mjs"

export default {
  name: "account-name-invalid",
  design: focus.design,
  async drive(kit) {
    await focus.drive(kit)
    const input = kit.page.getByLabel(accountCopy.name, { exact: true })
    await input.fill("   ")
    await input.press("Enter")
    await expect(kit.page.getByRole("alert")).toHaveText(accountCopy.nameInvalid)
  },
}
