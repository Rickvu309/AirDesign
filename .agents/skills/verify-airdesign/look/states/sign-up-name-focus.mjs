import { expect } from "@playwright/test"
import { accountCopy } from "../../bin/product-copy.mjs"
import name from "./sign-up-name.mjs"

export default {
  name: "sign-up-name-focus",
  design: name.design,
  async drive(kit) {
    await name.drive(kit)
    await kit.page.keyboard.press("Tab")
    const input = kit.page.getByLabel(accountCopy.name, { exact: true })
    await input.focus()
    await expect(input).toBeFocused()
  },
}
