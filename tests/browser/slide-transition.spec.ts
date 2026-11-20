import { copyFile, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { expect } from "@playwright/test"
import { presentCopy } from "../../apps/web/src/copy/present-copy"
import { transitionCopy } from "../../apps/web/src/copy/transition-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
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
const exportName = "exported-slide-transition.pptx"
const fixture = join(process.cwd(), "scripts/pptx-fixtures/blank.pptx")
const judged = join(process.cwd(), "tests/browser", exportName)
const written =
  '<p:transition xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" spd="fast" p14:dur="500"><p:fade/></p:transition>'

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

test("a person sets how a slide arrives, presents it, undoes it, and the export writes that transition @export", async ({
  page,
  decks,
}, testInfo) => {
  await rm(judged, { force: true })
  await decks.open(fixture)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await page.getByRole("tab", { name: transitionCopy.animate }).click()
  const panel = page.locator("[data-animate-panel]")
  await expect(panel.getByText(transitionCopy.transition, { exact: true })).toBeVisible()
  await panel.getByRole("combobox", { name: transitionCopy.style }).click()
  await page.getByRole("option", { name: transitionCopy.styles.dissolve, exact: true }).click()
  await expect(panel.getByRole("combobox", { name: transitionCopy.style })).toContainText(
    transitionCopy.styles.dissolve,
  )
  await page.getByRole("button", { name: undoCopy.undoNamed.transition, exact: true }).click()
  await expect(panel.getByRole("combobox", { name: transitionCopy.style })).toContainText(transitionCopy.styles.none)
  await page.getByRole("button", { name: undoCopy.redoNamed.transition, exact: true }).click()
  await expect(panel.getByRole("combobox", { name: transitionCopy.style })).toContainText(
    transitionCopy.styles.dissolve,
  )
  await page.getByRole("button", { name: presentCopy.present, exact: true }).click()
  await expect(page.locator("[data-present-show]")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.locator("[data-present-show]")).toHaveCount(0)
  await page.reload()
  await decks.ready()
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await page.getByRole("tab", { name: transitionCopy.animate }).click()
  await expect(
    page.locator("[data-animate-panel]").getByRole("combobox", { name: transitionCopy.style }),
  ).toContainText(transitionCopy.styles.dissolve)
  const saving = page.waitForEvent("download")
  await exportFromDialog(page)
  const download = testInfo.outputPath(exportName)
  await (await saving).saveAs(download)
  const saved = await partsOf(download)
  expect(saved.get(slidePart)?.toString("utf8")).toContain(written)
  await copyFile(download, judged)
})
