import path from "node:path"
import { expect } from "@playwright/test"
import { openExportDialog, powerpoint } from "../export-dialog.mjs"
import { openDeck } from "../open-deck.mjs"
import { holdDevice, holdableDevice } from "../../../../../tests/browser/slow-device.ts"

async function drive(kit) {
  await holdableDevice(kit.page)
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures/nasa-1d-cnn.pptx"))
  await holdDevice(kit.page)
  const notes = kit.page.getByRole("textbox", { name: "Speaker notes", exact: true })
  if (!(await notes.isVisible())) await kit.page.getByRole("button", { name: "Expand speaker notes" }).first().click()
  await notes.fill("Held note")
  const dialog = await openExportDialog(kit)
  await kit.page.keyboard.press("Enter")
  await expect(dialog.getByRole("button", { name: "Exporting…" })).toBeVisible()
}

export default { name: "export-exporting", design: powerpoint, drive }
