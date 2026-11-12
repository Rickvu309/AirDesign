import path from "node:path"
import { expect } from "@playwright/test"

const powerpoint = "/screens/s61-01-export-export-powerpoint-options"
const pdf = "/screens/s61-02-export-export-pdf-options"

async function exportDialog(kit, deck = "clean.pptx") {
  const { openDeck } = await import("./states.mjs")
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures", deck))
  await kit.page.getByRole("button", { name: "Export", exact: true }).click()
  const dialog = kit.page.getByRole("dialog", { name: "Export" })
  await expect(dialog.getByRole("button", { name: "Export" })).toBeFocused()
  return dialog
}

async function choose(kit, dialog, field, option) {
  await dialog.getByRole("combobox", { name: field }).click()
  await kit.page.getByRole("option", { name: option, exact: true }).click()
  await expect(dialog.getByRole("combobox", { name: field })).toContainText(option)
}

async function choosing(kit) {
  await exportDialog(kit)
}

async function choosingPdf(kit) {
  const dialog = await exportDialog(kit)
  await choose(kit, dialog, "File type", "PDF")
}

async function range(kit) {
  const dialog = await exportDialog(kit, "doe-heat-pumps.pptx")
  await choose(kit, dialog, "Slides", "Range")
  await dialog.getByRole("spinbutton", { name: "First slide" }).fill("3")
  await dialog.getByRole("spinbutton", { name: "Last slide" }).fill("7")
}

async function rangeRefused(kit) {
  const dialog = await exportDialog(kit, "doe-heat-pumps.pptx")
  await choose(kit, dialog, "Slides", "Range")
  await dialog.getByRole("spinbutton", { name: "First slide" }).fill("9")
  await dialog.getByRole("spinbutton", { name: "Last slide" }).fill("4")
  await expect(dialog.getByRole("alert")).toBeVisible()
}

async function exporting(kit) {
  const { openDeck } = await import("./states.mjs")
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures/nasa-1d-cnn.pptx"))
  await kit.page.route("**/decks/commit", () => undefined)
  const notes = kit.page.getByRole("textbox", { name: "Speaker notes", exact: true })
  if (!(await notes.isVisible())) await kit.page.getByRole("button", { name: "Expand speaker notes" }).first().click()
  await notes.fill("Held note")
  await kit.page.getByRole("button", { name: "Export", exact: true }).click()
  const dialog = kit.page.getByRole("dialog", { name: "Export" })
  await expect(dialog.getByRole("button", { name: "Export" })).toBeFocused()
  await kit.page.keyboard.press("Enter")
  await expect(dialog.getByRole("button", { name: "Exporting…" })).toBeVisible()
}

export const exportStates = [
  { name: "export-choosing", design: powerpoint, drive: choosing },
  { name: "export-choosing-pdf", design: pdf, drive: choosingPdf },
  { name: "export-range", design: powerpoint, drive: range },
  { name: "export-range-refused", design: powerpoint, drive: rangeRefused },
  { name: "export-exporting", design: powerpoint, drive: exporting },
]
