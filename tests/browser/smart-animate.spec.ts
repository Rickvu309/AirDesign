import { copyFile, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { presentCopy } from "../../apps/web/src/copy/present-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { exportFromDialog } from "./export-dialog"
import { test } from "./deck-test"

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
const slidePart = "ppt/slides/slide1.xml"
const exportName = "exported-smart-animate.pptx"
const fixture = join(process.cwd(), "scripts/pptx-fixtures/blank.pptx")
const judged = join(process.cwd(), "tests/browser", exportName)
const duplicate = process.platform === "darwin" ? "Meta+d" : "Control+d"

async function partsOf(file: string): Promise<Map<string, Buffer>> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(await readFile(file))))
  const parts = new Map<string, Buffer>()
  for (const entry of await reader.getEntries()) {
    if (!entry.directory) parts.set(entry.filename, Buffer.from(await entry.getData(new zip.Uint8ArrayWriter())))
  }
  await reader.close()
  return parts
}

test.use({ viewport: { width: 1600, height: 1000 } })

function entry(page: Page, number: number) {
  return page.locator(`[data-slide-entry="${number}"]`)
}

test("Smart animate exports as PowerPoint's Morph and moves the layer two slides share in Present @export", async ({
  page,
  decks,
}, testInfo) => {
  await rm(judged, { force: true })
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await decks.open(fixture)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await page.getByRole("tab", { name: transitionCopy.animate }).click()
  const panel = page.locator("[data-animate-panel]")
  const style = panel.getByRole("combobox", { name: transitionCopy.style })
  await style.click()
  await page.getByRole("option", { name: transitionCopy.styles.smartAnimate, exact: true }).click()
  await expect(style).toContainText(transitionCopy.styles.smartAnimate)
  await expect(panel.getByRole("group", { name: transitionCopy.direction })).toHaveCount(0)
  const duration = panel.getByLabel(transitionCopy.duration)
  await duration.fill("3")
  await duration.press("Enter")
  await expect(duration).toHaveValue("3")
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const download = testInfo.outputPath(exportName)
  await (await saving).saveAs(download)
  const saved = (await partsOf(download)).get(slidePart)?.toString("utf8") ?? ""
  expect(saved).toContain('<p159:morph option="byObject"/>')
  expect(saved).toContain('<mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback>')
  await copyFile(download, judged)

  await entry(page, 1).click()
  await page.keyboard.press(duplicate)
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  const title = page.locator("[data-slide-paint] [data-canvas-element]").first()
  await title.click()
  for (let step = 0; step < 12; step += 1) await page.keyboard.press("Shift+ArrowDown")
  await page.keyboard.press("Escape")
  await entry(page, 1).click()
  await page.getByRole("button", { name: presentCopy.present, exact: true }).click()
  const shown = page.locator("[data-present-show] [data-present-slide]")
  await expect(shown).toHaveAttribute("data-present-slide", "1")
  await page.keyboard.press("ArrowRight")
  await expect(page.locator("[data-present-moving]").first()).toBeVisible()
  await expect(shown).toHaveAttribute("data-present-slide", "2")
  await expect(page.locator("[data-present-moving]")).toHaveCount(0, { timeout: 6000 })
})
