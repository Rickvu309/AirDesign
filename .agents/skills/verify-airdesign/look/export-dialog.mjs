import path from "node:path"
import { expect } from "@playwright/test"
import { openDeck } from "./open-deck.mjs"

export const powerpoint = "/screens/s61-01-export-export-powerpoint-options"
export const pdf = "/screens/s61-02-export-export-pdf-options"

export async function exportDialog(kit, deck = "clean.pptx") {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures", deck))
  return openExportDialog(kit)
}

export async function openExportDialog(kit) {
  await kit.page.getByRole("button", { name: "Export", exact: true }).click()
  const dialog = kit.page.getByRole("dialog", { name: "Export" })
  await expect(dialog.getByRole("button", { name: "Export" })).toBeFocused()
  return dialog
}

export async function choose(kit, dialog, field, option) {
  await dialog.getByRole("combobox", { name: field }).click()
  await kit.page.getByRole("option", { name: option, exact: true }).click()
  await expect(dialog.getByRole("combobox", { name: field })).toContainText(option)
}

export async function chooseRange(kit, deck, first, last) {
  const dialog = await exportDialog(kit, deck)
  await choose(kit, dialog, "Slides", "Range")
  await dialog.getByRole("spinbutton", { name: "First slide" }).fill(first)
  await dialog.getByRole("spinbutton", { name: "Last slide" }).fill(last)
  return dialog
}
