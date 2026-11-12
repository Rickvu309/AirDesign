import { expect } from "@playwright/test"
import { chooseRange, powerpoint } from "../export-dialog.mjs"

async function drive(kit) {
  const dialog = await chooseRange(kit, "doe-heat-pumps.pptx", "9", "4")
  await expect(dialog.getByRole("alert")).toBeVisible()
}

export default { name: "export-range-refused", design: powerpoint, drive }
