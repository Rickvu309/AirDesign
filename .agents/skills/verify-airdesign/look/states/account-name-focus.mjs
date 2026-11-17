import { expect } from "@playwright/test"
import { accountCopy } from "../../bin/product-copy.mjs"
import { openAccount } from "../open-account.mjs"

export default {
  name: "account-name-focus",
  design: "/screens/s81-03-settings-settings-account-tab",
  async drive(kit) {
    await openAccount(kit)
    await kit.page.keyboard.press("Tab")
    const input = kit.page.getByLabel(accountCopy.name, { exact: true })
    await input.focus()
    await expect(input).toBeFocused()
  },
}
