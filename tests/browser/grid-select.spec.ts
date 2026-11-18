import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { entry, manySlides, openFile, openGrid } from "./slide-grid-deck"

type ZipLibrary = {
  readonly ZipReader: new (reader: unknown) => {
    getEntries(): Promise<{ readonly filename: string }[]>
    close(): Promise<void>
  }
  readonly Uint8ArrayReader: new (bytes: Uint8Array) => unknown
}

const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as ZipLibrary

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

async function slidePartsOf(file: string): Promise<number> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const names = (await reader.getEntries()).map((each) => each.filename)
  await reader.close()
  return names.filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).length
}

function said(page: Page) {
  return page.locator("[data-editor-grid] [data-announcer]")
}

function selectedCount(page: Page) {
  return page.locator("[data-grid-selected]")
}

test("a person selects several slides with the mouse and the keyboard, and exports just those", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000)
  await openFile(page, { name: "six.pptx", mimeType: "application/octet-stream", buffer: await manySlides(6) })
  await openGrid(page)
  await expect(entry(page, 1)).toHaveAttribute("aria-current", "true")
  await entry(page, 3).click({ modifiers: ["ControlOrMeta"] })
  await expect(selectedCount(page)).toHaveText("2 slides selected")
  await expect(entry(page, 1)).toHaveAccessibleName("Slide 1 of 6, selected")
  await expect(entry(page, 3)).toHaveAccessibleName("Slide 3 of 6, selected")
  await expect(entry(page, 2)).toHaveAccessibleName("Slide 2 of 6")
  await expect(page.locator("[data-editor-grid]")).toBeVisible()
  await entry(page, 3).click({ modifiers: ["ControlOrMeta"] })
  await expect(selectedCount(page)).toHaveText("1 slide selected")
  await expect(entry(page, 1)).toHaveAccessibleName("Slide 1 of 6, selected")
  await expect(entry(page, 3)).toHaveAccessibleName("Slide 3 of 6")
  await entry(page, 3).click({ modifiers: ["ControlOrMeta"] })
  await entry(page, 5).click({ modifiers: ["Shift"] })
  await expect(selectedCount(page)).toHaveText("3 slides selected")
  await expect(entry(page, 4)).toHaveAccessibleName("Slide 4 of 6, selected")
  await expect(entry(page, 1)).toHaveAccessibleName("Slide 1 of 6")
  await page.keyboard.press("Escape")
  await expect(selectedCount(page)).toHaveCount(0)
  await entry(page, 2).focus()
  await page.keyboard.press("ArrowLeft")
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("Shift+ArrowRight")
  await page.keyboard.press("Shift+ArrowRight")
  await expect(entry(page, 4)).toBeFocused()
  await expect(selectedCount(page)).toHaveText("3 slides selected")
  await page.keyboard.press("ControlOrMeta+a")
  await expect(selectedCount(page)).toHaveText("6 slides selected")
  await page.locator("[data-slide-list]").click({ position: { x: 8, y: 8 } })
  await expect(selectedCount(page)).toHaveCount(0)
  await entry(page, 1).focus()
  await page.keyboard.press("ArrowRight")
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await entry(page, 5).click({ modifiers: ["ControlOrMeta"] })
  await expect(selectedCount(page)).toHaveText("2 slides selected")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Export" })
  await expect(dialog.getByRole("combobox", { name: "Slides" })).toContainText("2 selected slides")
  const saving = page.waitForEvent("download")
  await dialog.getByRole("button", { name: "Export" }).click()
  const file = testInfo.outputPath("selected.pptx")
  await (await saving).saveAs(file)
  expect(await slidePartsOf(file)).toBe(2)
})

test("a slide command acts on the slide remaining after a Ctrl or Cmd toggle", async ({ page }) => {
  await openFile(page, { name: "three.pptx", mimeType: "application/octet-stream", buffer: await manySlides(3) })
  await openGrid(page)
  await entry(page, 3).click({ modifiers: ["ControlOrMeta"] })
  await entry(page, 3).click({ modifiers: ["ControlOrMeta"] })
  await expect(entry(page, 1)).toHaveAccessibleName("Slide 1 of 3, selected")
  await page.keyboard.press("ControlOrMeta+d")
  await expect(said(page)).toHaveText("Duplicated slide 1. The copy is slide 2")
  await expect(page.locator("[data-editor-grid] [data-slide-entry]")).toHaveCount(4)
  await expect(selectedCount(page)).toHaveCount(0)
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
})

test("a slide taken out of the selection with Ctrl or Cmd does not stay the current slide", async ({ page }) => {
  await openFile(page, { name: "five.pptx", mimeType: "application/octet-stream", buffer: await manySlides(5) })
  await openGrid(page)
  await entry(page, 3).click({ modifiers: ["ControlOrMeta"] })
  await entry(page, 5).click({ modifiers: ["ControlOrMeta"] })
  await expect(selectedCount(page)).toHaveText("3 slides selected")
  await entry(page, 5).click({ modifiers: ["ControlOrMeta"] })
  await expect(selectedCount(page)).toHaveText("2 slides selected")
  await expect(entry(page, 3)).toHaveAttribute("aria-current", "true")
  await page.keyboard.press("Escape")
  await expect(entry(page, 3)).toHaveAttribute("aria-current", "true")
  await expect(entry(page, 5)).not.toHaveAttribute("aria-current", "true")
})
