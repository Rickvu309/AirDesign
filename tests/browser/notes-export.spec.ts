import { copyFile } from "node:fs/promises"
import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { notesExports } from "../../scripts/notes-export.mjs"
import { exportFromDialog } from "./export-dialog"

const duplicate = process.platform === "darwin" ? "Meta+d" : "Control+d"
const [blankNotes, importedNotes] = notesExports

test.use({ viewport: { width: 1600, height: 1000 } })

async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

function entry(page: Page, number: number) {
  return page.locator(`[data-slide-entry="${number}"]`)
}

function field(page: Page) {
  return page.getByRole("textbox", { name: "Speaker notes", exact: true })
}

async function opened(page: Page) {
  if ((await field(page).count()) === 0)
    await page.getByRole("button", { name: "Expand speaker notes" }).first().click()
  await expect(field(page)).toBeEditable()
  return field(page)
}

async function write(page: Page, text: string): Promise<void> {
  const notes = await opened(page)
  await notes.fill(text)
  await expect(notes).toHaveValue(text)
}

async function shown(page: Page, number: number, text: string): Promise<void> {
  await entry(page, number).click()
  await expect(entry(page, number)).toHaveAttribute("aria-current", "true")
  await expect(await opened(page)).toHaveValue(text)
}

async function exported(page: Page, file: string, name: string): Promise<string> {
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  await (await saving).saveAs(file)
  await copyFile(file, join(process.cwd(), "tests/browser", name))
  return file
}

async function imported(page: Page, file: string): Promise<void> {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
}

test("first speaker notes on a blank deck, a new slide and a copy survive a reload, the export and a re-import @export", async ({
  page,
}, testInfo) => {
  if (blankNotes === undefined) throw new Error("notes export")
  const [first, copy, added] = blankNotes.notes
  await page.goto("/")
  await page.getByRole("button", { name: "New deck", exact: true }).click()
  await page.getByRole("button", { name: "Blank deck", exact: true }).click()
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await write(page, first)
  await page.getByRole("button", { name: "Add slide" }).click()
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await expect(await opened(page)).toHaveValue("")
  await write(page, added)
  await entry(page, 1).click()
  await expect(await opened(page)).toHaveValue(first)
  await entry(page, 1).focus()
  await page.keyboard.press(duplicate)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(3)
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await expect(await opened(page)).toHaveValue(first)
  await write(page, copy)
  await page.reload()
  await settled(page)
  for (const [index, text] of blankNotes.notes.entries()) await shown(page, index + 1, text)
  const file = await exported(page, testInfo.outputPath(blankNotes.exported), blankNotes.exported)
  await imported(page, file)
  for (const [index, text] of blankNotes.notes.entries()) await shown(page, index + 1, text)
})

test("a first speaker note on an imported slide and a note on a copy of a slide with notes export and re-import @export", async ({
  page,
}, testInfo) => {
  if (importedNotes === undefined) throw new Error("notes export")
  const [first, copy, second] = importedNotes.notes
  await imported(page, join(process.cwd(), "scripts/pptx-fixtures", importedNotes.original))
  await shown(page, 2, "")
  await write(page, second)
  await entry(page, 1).focus()
  await page.keyboard.press(duplicate)
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await expect(await opened(page)).toHaveValue(first)
  await write(page, copy)
  await page.reload()
  await settled(page)
  for (const [index, text] of importedNotes.notes.entries()) await shown(page, index + 1, text)
  const file = await exported(page, testInfo.outputPath(importedNotes.exported), importedNotes.exported)
  await imported(page, file)
  for (const [index, text] of importedNotes.notes.entries()) await shown(page, index + 1, text)
})
