import { presentCopy } from "../../apps/web/src/copy/present-copy.ts"
import { copyFile, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { inflateSync } from "node:zlib"
import { expect, test, type Page } from "@playwright/test"
import {
  blankRangeExportName,
  currentSlideExportName,
  currentSlideOriginalName,
  currentSlidePart,
} from "../../scripts/slide-subset.mjs"
import { newBlankDeck } from "./new-deck"
import { holdDevice, holdableDevice, openDevice } from "./slow-device"

type ZipEntry = {
  readonly filename: string
  readonly directory: boolean
  getData(writer: unknown): Promise<Uint8Array>
}

type ZipLibrary = {
  readonly ZipReader: new (reader: unknown) => { getEntries(): Promise<ZipEntry[]>; close(): Promise<void> }
  readonly Uint8ArrayReader: new (bytes: Uint8Array) => unknown
  readonly Uint8ArrayWriter: new () => unknown
}

const zip = createRequire(join(process.cwd(), "packages/pptx/package.json"))("@zip.js/zip.js") as ZipLibrary
const fixtures = join(process.cwd(), "scripts/pptx-fixtures")
const slideName = /^ppt\/slides\/slide\d+\.xml$/

async function partsOf(file: string): Promise<Map<string, Buffer>> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const parts = new Map<string, Buffer>()
  for (const entry of await reader.getEntries()) {
    if (!entry.directory) parts.set(entry.filename, Buffer.from(await entry.getData(new zip.Uint8ArrayWriter())))
  }
  await reader.close()
  return parts
}

function slideParts(parts: ReadonlyMap<string, Buffer>): string[] {
  return [...parts.keys()].filter((name) => slideName.test(name))
}

async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

async function openFile(page: Page, file: string): Promise<void> {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
}

function entry(page: Page, number: number) {
  return page.locator(`[data-slide-entry="${number}"]`)
}

function dialog(page: Page) {
  return page.getByRole("dialog", { name: "Export" })
}

async function openDialog(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(dialog(page).getByRole("button", { name: "Export" })).toBeFocused()
}

async function choose(page: Page, field: "File type" | "Slides", option: string): Promise<void> {
  await dialog(page).getByRole("combobox", { name: field }).click()
  await page.getByRole("option", { name: option, exact: true }).click()
  await expect(dialog(page).getByRole("combobox", { name: field })).toContainText(option)
}

function pdfPages(pdf: Buffer): string[] {
  const text = pdf.toString("latin1")
  const pages = [...text.matchAll(/\/Type\s*\/Page(?![s\w])[\s\S]*?\/Contents\s+(\d+)\s+0\s+R/g)]
  return pages.map((page) => {
    const start = text.indexOf(`\n${page[1]} 0 obj`)
    const from = text.indexOf("stream", start) + "stream".length
    const body = pdf.subarray(text[from] === "\r" ? from + 2 : from + 1, text.indexOf("endstream", from))
    return inflateSync(body).toString("latin1")
  })
}

test.use({ viewport: { width: 1600, height: 1000 } })

test("Export opens the dialog on PowerPoint and all slides, and Enter exports the whole deck as before", async ({
  page,
}, testInfo) => {
  const original = join(fixtures, "tall-glyph-before.pptx")
  await openFile(page, original)
  await openDialog(page)
  await expect(dialog(page).getByRole("combobox", { name: "File type" })).toContainText("PowerPoint")
  await expect(dialog(page).getByRole("combobox", { name: "Slides" })).toContainText("All slides")
  const saving = page.waitForEvent("download")
  await page.keyboard.press("Enter")
  const file = testInfo.outputPath("whole.pptx")
  await (await saving).saveAs(file)
  await expect(dialog(page)).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Export", exact: true })).toBeFocused()
  const before = await partsOf(original)
  const after = await partsOf(file)
  expect(slideParts(after)).toEqual(slideParts(before))
  for (const name of slideParts(before)) expect(after.get(name)?.equals(before.get(name) ?? Buffer.from(""))).toBe(true)
})

test("the current slide of an imported deck exports as a one-slide deck that imports again @export", async ({
  page,
}, testInfo) => {
  const judged = join(process.cwd(), "tests/browser", currentSlideExportName)
  await rm(judged, { force: true })
  const original = join(fixtures, currentSlideOriginalName)
  await openFile(page, original)
  await entry(page, 7).click()
  await expect(entry(page, 7)).toHaveAttribute("aria-current", "true")
  const shown = (await entry(page, 7).locator("[data-thumb-paint]").innerText()).trim().slice(0, 24)
  await openDialog(page)
  await choose(page, "Slides", "Current slide")
  const saving = page.waitForEvent("download")
  await dialog(page).getByRole("button", { name: "Export" }).click()
  const file = testInfo.outputPath(currentSlideExportName)
  await (await saving).saveAs(file)
  const before = await partsOf(original)
  const after = await partsOf(file)
  expect(slideParts(after)).toEqual([currentSlidePart])
  expect(after.get(currentSlidePart)?.equals(before.get(currentSlidePart) ?? Buffer.from(""))).toBe(true)
  await copyFile(file, judged)
  await openFile(page, file)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
  await expect(entry(page, 1).locator("[data-thumb-paint]")).toContainText(shown)
  await openFile(page, original)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(41)
})

test("a range of a blank deck's slides exports only those slides @export", async ({ page }, testInfo) => {
  const judged = join(process.cwd(), "tests/browser", blankRangeExportName)
  await rm(judged, { force: true })
  await page.goto("/")
  await newBlankDeck(page)
  await settled(page)
  await page.getByRole("button", { name: "Add slide" }).click()
  await page.getByRole("button", { name: "Add slide" }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(3)
  await openDialog(page)
  await choose(page, "Slides", "Range")
  await dialog(page).getByRole("spinbutton", { name: "First slide" }).fill("4")
  await expect(dialog(page).getByRole("alert")).toHaveText("Choose slides from 1 to 3, first slide before last.")
  await expect(dialog(page).getByRole("button", { name: "Export" })).toBeDisabled()
  await dialog(page).getByRole("spinbutton", { name: "First slide" }).fill("2")
  await expect(dialog(page).getByRole("alert")).toHaveCount(0)
  const saving = page.waitForEvent("download")
  await dialog(page).getByRole("spinbutton", { name: "Last slide" }).press("Enter")
  const file = testInfo.outputPath(blankRangeExportName)
  await (await saving).saveAs(file)
  expect(slideParts(await partsOf(file))).toHaveLength(2)
  await copyFile(file, judged)
  await openFile(page, file)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
})

for (const format of ["PowerPoint", "PDF"]) {
  test(`${format} range fields describe the error until the range is corrected`, async ({ page }) => {
    await page.goto("/")
    await newBlankDeck(page)
    await settled(page)
    await page.getByRole("button", { name: "Add slide" }).click()
    await page.getByRole("button", { name: "Add slide" }).click()
    await expect(page.locator("[data-slide-entry]")).toHaveCount(3)
    await openDialog(page)
    await choose(page, "File type", format)
    await choose(page, "Slides", "Range")
    const first = dialog(page).getByRole("spinbutton", { name: "First slide" })
    const last = dialog(page).getByRole("spinbutton", { name: "Last slide" })
    const action = dialog(page).getByRole("button", { name: "Export" })
    for (const value of ["4", "", "0"]) {
      await first.fill(value)
      for (const field of [first, last]) {
        await field.focus()
        await expect(field).toHaveAttribute("aria-invalid", "true")
        await expect(field).toHaveAccessibleDescription("Choose slides from 1 to 3, first slide before last.")
      }
      await expect(action).toBeDisabled()
    }
    await first.fill("3")
    await last.fill("2")
    for (const field of [first, last]) {
      await expect(field).toHaveAccessibleDescription("Choose slides from 1 to 3, first slide before last.")
    }
    await first.fill("1")
    for (const field of [first, last]) {
      await expect(field).toHaveAttribute("aria-invalid", "false")
      await expect(field).toHaveAccessibleDescription("")
    }
    await expect(dialog(page).getByRole("alert")).toHaveCount(0)
    await expect(action).toBeEnabled()
  })
}

test("the dialog keeps focus inside, Escape closes it and focus returns to Export", async ({ page }) => {
  await openFile(page, join(fixtures, "clean.pptx"))
  await openDialog(page)
  for (let step = 0; step < 6; step += 1) {
    await page.keyboard.press("Tab")
    await expect.poll(() => dialog(page).evaluate((node) => node.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press("Escape")
  await expect(dialog(page)).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Export", exact: true })).toBeFocused()
})

test("Cancel while exporting closes the dialog and downloads nothing", async ({ page }) => {
  await holdableDevice(page)
  await openFile(page, join(fixtures, "nasa-1d-cnn.pptx"))
  await expect(page.getByRole("textbox", { name: presentCopy.notes, exact: true })).toBeVisible()
  await holdDevice(page)
  await page.getByRole("textbox", { name: presentCopy.notes, exact: true }).fill("Held note")
  let downloads = 0
  page.on("download", () => {
    downloads += 1
  })
  await openDialog(page)
  await page.keyboard.press("Enter")
  await expect(dialog(page).getByRole("button", { name: "Exporting…" })).toBeDisabled()
  await dialog(page).getByRole("button", { name: "Cancel" }).click()
  await expect(dialog(page)).toHaveCount(0)
  await openDevice(page)
  await page.waitForTimeout(500)
  expect(downloads).toBe(0)
})

test("PDF prints every chosen slide on its own page, painted, through the browser's print window", async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { printed: 0 })
    window.print = () => {
      Object.assign(window, { printed: (window as unknown as { printed: number }).printed + 1 })
    }
  })
  await openFile(page, join(fixtures, "tall-glyph-before.pptx"))
  await openDialog(page)
  await choose(page, "File type", "PDF")
  await expect(dialog(page)).toContainText("Your browser's print window opens next. Choose Save as PDF there.")
  await dialog(page).getByRole("button", { name: "Export" }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1)
  await expect(dialog(page)).toHaveCount(0)
  await expect(page.locator("[data-print-sheet] [data-print-page]")).toHaveCount(2)
  await expect(page.locator("[data-print-sheet] [data-print-page]").first()).toContainText("Hello")
  const pages = pdfPages(await page.pdf({ preferCSSPageSize: true, printBackground: true }))
  expect(pages).toHaveLength(2)
  expect(pages[0]).toMatch(/\bBT\b[\s\S]*\bT[jJ]\b/)
})

type Motion = { property: string; duration: string; running: number }

function motionOf(page: Page, selector: string): Promise<Motion> {
  return page.locator(selector).evaluate((node) => {
    const style = getComputedStyle(node)
    return {
      property: style.transitionProperty,
      duration: style.transitionDuration,
      running: node.getAnimations().length,
    }
  })
}

function boxOf(page: Page) {
  return dialog(page).evaluate((node) => {
    const box = node.getBoundingClientRect()
    return {
      width: Math.round(box.width * 10) / 10,
      centerX: Math.round(box.left + box.width / 2),
      centerY: Math.round(box.top + box.height / 2),
      opacity: getComputedStyle(node).opacity,
    }
  })
}

test("the dialog fades and scales in from the middle of the window and fades out", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.goto("/")
  await newBlankDeck(page)
  await settled(page)
  const client = await page.context().newCDPSession(page)
  await client.send("Animation.enable")
  await client.send("Animation.setPlaybackRate", { playbackRate: 0 })
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(dialog(page)).toHaveAttribute("data-open", "")
  await expect.poll(() => dialog(page).evaluate((node) => node.getAnimations().length)).toBe(2)
  const popup = await motionOf(page, "[data-export-dialog]")
  expect(popup.property).toBe("opacity, scale")
  expect(popup.duration).toBe("0.2s")
  const overlay = await motionOf(page, "[data-slot=dialog-overlay]")
  expect(overlay.property).toBe("opacity")
  expect(overlay.duration).toBe("0.15s")
  expect(
    await page.locator("[data-slot=dialog-overlay]").evaluate((node) => getComputedStyle(node).backdropFilter),
  ).toBe("none")
  expect(await boxOf(page)).toEqual({ width: 460.8, centerX: 800, centerY: 500, opacity: "0" })
  await dialog(page).evaluate((node) => {
    for (const animation of node.getAnimations()) animation.currentTime = 100
  })
  const middle = await boxOf(page)
  expect(middle.centerX).toBe(800)
  expect(middle.centerY).toBe(500)
  expect(middle.width).toBeGreaterThan(460.8)
  expect(middle.width).toBeLessThan(480)
  await client.send("Animation.setPlaybackRate", { playbackRate: 1 })
  await expect.poll(() => boxOf(page)).toEqual({ width: 480, centerX: 800, centerY: 500, opacity: "1" })
  await client.send("Animation.setPlaybackRate", { playbackRate: 0 })
  await page.keyboard.press("Escape")
  await expect(dialog(page)).toHaveAttribute("data-ending-style", "")
  expect((await motionOf(page, "[data-export-dialog]")).duration).toBe("0.15s")
  await client.send("Animation.setPlaybackRate", { playbackRate: 1 })
  await expect(dialog(page)).toHaveCount(0)
})

test("the dialog can close while opening and open again", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.goto("/")
  await newBlankDeck(page)
  await settled(page)
  const client = await page.context().newCDPSession(page)
  await client.send("Animation.enable")
  await client.send("Animation.setPlaybackRate", { playbackRate: 0 })
  const trigger = page.locator("#root").getByRole("button", { name: "Export", exact: true })
  await trigger.click()
  await expect.poll(() => dialog(page).evaluate((node) => node.getAnimations().length)).toBe(2)
  await dialog(page).evaluate((node) => {
    for (const animation of node.getAnimations()) animation.currentTime = 60
  })
  const entering = await boxOf(page)
  expect(Number(entering.opacity)).toBeGreaterThan(0)
  expect(Number(entering.opacity)).toBeLessThan(1)
  await page.keyboard.press("Escape")
  await expect(dialog(page)).toHaveAttribute("data-ending-style", "")
  const leaving = await boxOf(page)
  expect(Number(leaving.opacity)).toBeCloseTo(Number(entering.opacity), 2)
  expect(leaving.centerX).toBe(800)
  expect(leaving.centerY).toBe(500)
  await client.send("Animation.setPlaybackRate", { playbackRate: 1 })
  await trigger.click()
  await expect(dialog(page)).toHaveAttribute("data-open", "")
  await expect(dialog(page).getByRole("button", { name: "Export", exact: true })).toBeFocused()
  await expect.poll(() => boxOf(page)).toEqual({ width: 480, centerX: 800, centerY: 500, opacity: "1" })
  await page.keyboard.press("Escape")
  await expect(dialog(page)).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test("with reduced motion the dialog opens and closes in its finished state", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  await newBlankDeck(page)
  await settled(page)
  await openDialog(page)
  expect(await motionOf(page, "[data-export-dialog]")).toEqual({
    property: "opacity, scale",
    duration: "0s",
    running: 0,
  })
  expect(await motionOf(page, "[data-slot=dialog-overlay]")).toEqual({
    property: "opacity",
    duration: "0s",
    running: 0,
  })
  await page.keyboard.press("Escape")
  await expect(dialog(page)).toHaveCount(0)
})

for (const afterprint of [true, false]) {
  test(`PDF uses the deck file name and restores the tab title ${afterprint ? "on afterprint" : "on cancel without afterprint"}`, async ({
    page,
  }) => {
    await openFile(page, join(fixtures, "clean.pptx"))
    await page.getByRole("button", { name: "Rename deck: clean" }).click()
    await page.getByRole("textbox", { name: "Deck name" }).fill("Q3 / Board: final.")
    await page.getByRole("textbox", { name: "Deck name" }).press("Enter")
    await expect(page).toHaveTitle("Q3 / Board: final. - AirDesign")
    await page.evaluate((sendAfterprint) => {
      window.print = () => {
        document.body.dataset.printTitle = document.title
        if (sendAfterprint) window.dispatchEvent(new Event("afterprint"))
        document.body.dataset.afterPrintTitle = document.title
      }
    }, afterprint)
    await openDialog(page)
    await choose(page, "File type", "PDF")
    await dialog(page).getByRole("button", { name: "Export" }).click()
    await expect(page.locator("body")).toHaveAttribute("data-print-title", "Q3 Board final")
    await expect(page).toHaveTitle("Q3 / Board: final. - AirDesign")
    if (afterprint) {
      await expect(page.locator("body")).toHaveAttribute("data-after-print-title", "Q3 / Board: final. - AirDesign")
      await expect(page.locator("[data-print-sheet]")).toHaveCount(0)
    }
    await expect(dialog(page)).toHaveCount(0)
    const saving = page.waitForEvent("download")
    await openDialog(page)
    await dialog(page).getByRole("button", { name: "Export" }).click()
    expect((await saving).suggestedFilename()).toBe("Q3 Board final.pptx")
  })
}
