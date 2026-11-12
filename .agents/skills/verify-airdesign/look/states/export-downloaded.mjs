import { expect } from "@playwright/test"
import { openExportDialog } from "../export-dialog.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit)
  const saving = kit.page.waitForEvent("download")
  await openExportDialog(kit)
  await kit.page.keyboard.press("Enter")
  await saving
  await expect(kit.page.getByText("clean.pptx downloaded", { exact: true })).toBeVisible()
}

export default { name: "export-downloaded", design: "/screens/s61-03-export-export-downloaded-toast", drive }
